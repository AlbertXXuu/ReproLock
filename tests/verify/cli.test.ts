import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { childEnvironment } from "../../src/demo/process.ts";
import { serializeCanonicalJson } from "../../src/evidence/canonical-json.ts";
import { hash, verifyBundle } from "../../src/verify/evidence.ts";
import { readConfig, run } from "../../src/verify/cli.ts";

const execute = promisify(execFile);
const sourceRoot = process.cwd();
const cli = join(sourceRoot, "src/verify/cli.ts");
const candidate = `import { test, expect } from '@playwright/test';
test('a cleared counter can be incremented', async ({ page }) => {
  await test.step('reset', async () => {
    await page.goto('/');
    expect(await page.getByRole('status').textContent()).toBe('0');
  });
  await page.getByRole('button', {name:'Increment'}).click();
  await test.step('outcome', async () => {
    expect(await page.getByRole('status').textContent()).toBe('1');
  });
});`;
async function freePort(): Promise<number> {
  const s = createServer();
  await new Promise<void>((done) => s.listen(0, "127.0.0.1", done));
  const address = s.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((done) => s.close(() => done()));
  return address.port;
}
test("real CLI proves a local differential and rejects inconsistent or non-business evidence", {
  timeout: 180_000,
}, async () => {
  const base = await realpath(tmpdir());
  const directory = await mkdtemp(join(base, "reprolock-verifier-"));
  const repo = join(directory, "repo"),
    post = join(directory, "post");
  const git = async (...args: string[]): Promise<string> =>
    (
      await execute("git", ["-C", repo, ...args], {
        timeout: 10_000,
        windowsHide: true,
        env: childEnvironment(),
      })
    ).stdout.trim();
  const runs: string[] = [];
  try {
    await mkdir(repo);
    await git("init");
    await git("config", "user.name", "ReproLock fixture");
    await git("config", "user.email", "fixture@example.invalid");
    await writeFile(
      join(repo, "package.json"),
      JSON.stringify({ private: true, type: "module", scripts: { start: "node server.mjs" } }),
    );
    await writeFile(
      join(repo, "package-lock.json"),
      JSON.stringify({ name: "disposable-fixture", lockfileVersion: 3, packages: {} }),
    );
    const server = (value: number): string =>
      `import {createServer} from 'node:http'; createServer((_,r)=>{r.setHeader('content-type','text/html');r.end(${JSON.stringify(`<button onclick="document.querySelector('[role=status]').textContent='${value}'">Increment</button><p role="status">0</p>`)});}).listen(Number(process.argv[2]),'127.0.0.1');`;
    await writeFile(join(repo, "server.mjs"), server(0));
    await git("add", ".");
    await git("commit", "-m", "fixture: broken increment");
    const preSha = await git("rev-parse", "HEAD");
    await writeFile(join(repo, "server.mjs"), server(1));
    await git("add", ".");
    await git("commit", "-m", "fixture: restore increment");
    const postSha = await git("rev-parse", "HEAD");
    await git("worktree", "add", "--detach", post, postSha);
    await git("checkout", "--detach", preSha);
    const spec = join(directory, "candidate.spec.ts");
    await writeFile(spec, candidate);
    const port = await freePort();
    const config = {
      schemaVersion: 1,
      candidate: spec,
      targets: [
        { path: repo, revision: preSha },
        { path: post, revision: postSha },
      ],
      start: { nodeScript: "server.mjs", args: [String(port)] },
      origin: `http://127.0.0.1:${port}`,
      readyPath: "/",
      resetDescription:
        "Fresh browser context and navigation; independently assert initial counter zero",
      repetitions: 2,
      timeoutMs: 90_000,
      testTimeoutMs: 10_000,
    };
    const configPath = join(directory, "config.json");
    await writeFile(configPath, JSON.stringify(config));
    await execute(process.execPath, [cli, "check", configPath], {
      timeout: 30_000,
      windowsHide: true,
      env: childEnvironment(),
    });
    const invoke = async (): Promise<{
      directory: string;
      status: string;
      differential: boolean;
    }> => {
      const result = await execute(process.execPath, [cli, "run", configPath], {
        timeout: 120_000,
        windowsHide: true,
        env: childEnvironment(),
      }).catch((error) => {
        if (typeof error.stdout === "string" && error.stdout.trim().startsWith("{"))
          return error as { stdout: string };
        throw error;
      });
      const resultValue = JSON.parse(result.stdout.trim());
      runs.push(resultValue.directory);
      return resultValue;
    };
    const successful = await invoke();
    assert.equal(successful.differential, true, JSON.stringify(successful));
    const exportPath = join(successful.directory, "export.json");
    const bundle = JSON.parse(await readFile(exportPath, "utf8"));
    assert.deepEqual(verifyBundle(bundle).outcomes, [
      ["functional-failure", "functional-failure"],
      ["pass", "pass"],
    ]);
    await execute(process.execPath, [cli, "verify", exportPath], {
      timeout: 10_000,
      windowsHide: true,
    });
    const mutations: ((b: typeof bundle) => void)[] = [
      (b) => {
        b.executions[1].exitCode = 1;
      },
      (b) => {
        b.executions[0].cleanup = false;
      },
      (b) => {
        b.executions[0].cleanAfter = false;
      },
      (b) => {
        b.executions[1].report.observations[0].expectedStatus = "failed";
      },
      (b) => {
        b.executions[1].report.observations[0].repetition = 1;
      },
      (b) => {
        b.executions[0].report.observations[0].steps.find(
          (s: { label: string }) => s.label === "reset",
        ).label = "other";
      },
      (b) => {
        b.executions[0].report.observations[0].steps.find(
          (s: { comparison: unknown }) => s.comparison,
        ).comparison = null;
      },
      (b) => {
        b.executions[0].revision = b.executions[1].revision;
      },
      (b) => {
        b.executions[1].fingerprintAfter = "0".repeat(64);
      },
      (b) => {
        b.settings.origin = "http://127.0.0.1:9999";
      },
      (b) => {
        b.executions[1].report.observations[0].steps = [];
      },
      (b) => {
        b.candidate += "\n// changed";
      },
    ];
    for (const mutate of mutations) {
      const changed = structuredClone(bundle);
      mutate(changed);
      for (const e of changed.executions) e.reportSha256 = hash(serializeCanonicalJson(e.report));
      assert.equal(verifyBundle(changed).differential, false);
    }
    // Same error wording in ordinary user code is not evidence of a native assertion failure.
    await writeFile(
      spec,
      candidate.replace(
        "expect(await page.getByRole('status').textContent()).toBe('1');",
        "throw new Error('expect(received).toBe(expected) Expected: 1 Received: 0');",
      ),
    );
    const misleading = await invoke();
    assert.equal(misleading.differential, false);
    const negative = JSON.parse(await readFile(join(misleading.directory, "export.json"), "utf8"));
    assert.deepEqual(verifyBundle(negative).outcomes, [
      ["inconclusive", "inconclusive"],
      ["inconclusive", "inconclusive"],
    ]);
    // Test timeout is operational; even the pre-fix side cannot count as a functional failure.
    await writeFile(
      spec,
      candidate.replace(
        "expect(await page.getByRole('status').textContent()).toBe('1');",
        "await page.close(); await expect(page.getByRole('status')).toHaveText('1');",
      ),
    );
    const closed = await invoke();
    assert.equal(closed.differential, false);
    const closedBundle = JSON.parse(await readFile(join(closed.directory, "export.json"), "utf8"));
    assert.ok(
      verifyBundle(closedBundle)
        .outcomes.flat()
        .every((v) => v === "inconclusive"),
    );
    // Cancel after an observed attempt; completed observations must survive terminating the worker.
    const slow = candidate.replace(
      "async ({ page }) => {",
      "async ({ page }, info) => { if (info.repeatEachIndex > 0) await new Promise(resolve => setTimeout(resolve, 15000));",
    );
    await writeFile(spec, slow);
    config.repetitions = 20;
    await writeFile(configPath, JSON.stringify(config));
    const previous = new Set(await readdir(join(sourceRoot, "output/verify")));
    const abort = new AbortController();
    const running = run(await readConfig(configPath), abort.signal);
    let observed = false;
    try {
      const until = Date.now() + 40_000;
      while (!observed && Date.now() < until) {
        for (const name of (await readdir(join(sourceRoot, "output/verify"))).filter(
          (name) => !previous.has(name),
        )) {
          try {
            const report = JSON.parse(
              await readFile(
                join(sourceRoot, "output/verify", name, "report-0.json.partial-1"),
                "utf8",
              ),
            );
            observed = report.observations.length === 1;
          } catch {
            /* Wait for the first immutable observation. */
          }
        }
        if (!observed) await delay(50);
      }
    } finally {
      abort.abort();
    }
    const cancelledDirectory = await running;
    runs.push(cancelledDirectory);
    assert.equal(observed, true, "First attempt was not persisted within the bounded wait");
    const cancelled = JSON.parse(await readFile(join(cancelledDirectory, "export.json"), "utf8"));
    assert.equal(cancelled.status, "cancelled");
    assert.ok(
      cancelled.executions[0].report.observations.length >= 1 &&
        cancelled.executions[0].report.observations.length < 20,
    );
    assert.equal(cancelled.executions[0].cleanup, true);
    assert.equal(verifyBundle(cancelled).differential, false);
    // Dirty targets are rejected by preflight before any application starts.
    await writeFile(join(repo, "untracked.txt"), "temporary fixture change");
    await assert.rejects(
      execute(process.execPath, [cli, "check", configPath], {
        timeout: 30_000,
        windowsHide: true,
        env: childEnvironment(),
      }),
    );
    await rm(join(repo, "untracked.txt"));
    await writeFile(spec, candidate);
    config.timeoutMs = 1;
    await writeFile(configPath, JSON.stringify(config));
    const timed = await invoke();
    assert.equal(timed.status, "timeout");
    assert.equal(timed.differential, false);
    assert.equal(await git("status", "--porcelain"), "");
  } finally {
    await git("worktree", "remove", post).catch(() => {});
    for (const run of runs) {
      const resolved = resolve(run),
        output = resolve(sourceRoot, "output/verify");
      assert.ok(relative(output, resolved).startsWith("run-") && resolved.startsWith(output + sep));
      await rm(resolved, { recursive: true, force: true });
    }
    assert.ok(directory.startsWith(base + sep));
    await rm(directory, { recursive: true, force: true });
  }
});
