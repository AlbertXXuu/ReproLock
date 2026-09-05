import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  truncate,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { childEnvironment } from "../../src/demo/process.ts";
import { serializeCanonicalJson } from "../../src/evidence/canonical-json.ts";
import { configurationDigest, hash, verifyBundle } from "../../src/verify/evidence.ts";
import { check, playwrightShimSource, readConfig, run } from "../../src/verify/cli.ts";

const execute = promisify(execFile);
const sourceRoot = process.cwd();
const cli = join(sourceRoot, "src/verify/cli.ts");
const requireFromHere = createRequire(import.meta.url);
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

test("verify rejects an oversized export before JSON parsing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "reprolock-oversized-export-"));
  try {
    const exportPath = join(directory, "export.json");
    await writeFile(exportPath, "{}");
    await truncate(exportPath, 8_388_609);
    await assert.rejects(
      execute(process.execPath, [cli, "verify", exportPath], {
        timeout: 10_000,
        windowsHide: true,
        env: childEnvironment(),
      }),
      /regular non-symlink file at most 8 MiB/u,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Playwright shim preserves CommonJS, ESM named and ESM default imports", async () => {
  const directory = await mkdtemp(join(tmpdir(), "reprolock-shim-"));
  const shim = join(directory, "node_modules", "@playwright", "test");
  try {
    await mkdir(shim, { recursive: true });
    await writeFile(join(shim, "package.json"), '{"type":"commonjs","exports":"./index.cjs"}\n');
    await writeFile(join(shim, "index.cjs"), playwrightShimSource());
    await writeFile(
      join(directory, "probe.cjs"),
      "const api=require('@playwright/test');process.stdout.write(JSON.stringify([typeof api,typeof api.test,typeof api.expect,api===api.test]));\n",
    );
    await writeFile(
      join(directory, "probe.mjs"),
      "import defaultTest,{test,expect} from '@playwright/test';process.stdout.write(JSON.stringify([typeof defaultTest,typeof test,typeof expect,defaultTest===test]));\n",
    );
    const env = childEnvironment({
      REPROLOCK_PLAYWRIGHT_MODULE_PATH: requireFromHere.resolve("@playwright/test"),
    });
    const [commonJs, module] = await Promise.all([
      execute(process.execPath, [join(directory, "probe.cjs")], { cwd: directory, env }),
      execute(process.execPath, [join(directory, "probe.mjs")], { cwd: directory, env }),
    ]);
    assert.deepEqual(JSON.parse(commonJs.stdout), ["function", "function", "function", true]);
    assert.deepEqual(JSON.parse(module.stdout), ["function", "function", "function", true]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

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
    await writeFile(join(repo, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    await writeFile(join(repo, ".gitignore"), "dist/\n");
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
    await mkdir(join(repo, "dist"));
    await mkdir(join(post, "dist"));
    await writeFile(join(repo, "dist", "runtime.txt"), "pre-fix build\n");
    await writeFile(join(post, "dist", "runtime.txt"), "post-fix build\n");
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
      start: { nodeScript: "server.mjs", args: [String(port), "SENTINEL_START_ARGUMENT"] },
      servedPaths: ["dist"],
      origin: `http://127.0.0.1:${port}`,
      readyPath: "/",
      resetDescription:
        "Fresh browser context and navigation; independently assert initial counter zero",
      repetitions: 2,
      timeoutMs: 90_000,
      testTimeoutMs: 10_000,
      outputRoot: "./runs",
    };
    const configPath = join(directory, "config.json");
    await writeFile(configPath, JSON.stringify(config));
    const hiddenSource = join(post, "server.mjs");
    const originalHiddenSource = await readFile(hiddenSource, "utf8");
    await execute("git", ["-C", post, "update-index", "--assume-unchanged", "server.mjs"]);
    await writeFile(hiddenSource, "// hidden working-tree change\n");
    await assert.rejects(check(await readConfig(configPath)), /assume-unchanged or skip-worktree/u);
    await writeFile(hiddenSource, originalHiddenSource);
    await execute("git", ["-C", post, "update-index", "--no-assume-unchanged", "server.mjs"]);
    await git("config", "status.showUntrackedFiles", "no");
    await writeFile(join(post, "must-be-detected.tmp"), "untracked\n");
    await assert.rejects(check(await readConfig(configPath)), /Target must be clean/u);
    await rm(join(post, "must-be-detected.tmp"));
    await writeFile(join(directory, "runs"), "not a directory");
    await assert.rejects(
      check(await readConfig(configPath)),
      /Existing outputRoot must be a real directory/u,
    );
    await rm(join(directory, "runs"));
    const cancelledCheck = new AbortController();
    cancelledCheck.abort();
    await assert.rejects(check(await readConfig(configPath), cancelledCheck.signal), {
      name: "AbortError",
    });
    await execute(process.execPath, [cli, "check", configPath], {
      timeout: 30_000,
      windowsHide: true,
      env: childEnvironment(),
    });
    const firstCheck = await check(await readConfig(configPath));
    await writeFile(join(post, "dist", "runtime.txt"), "changed ignored build\n");
    const changedCheck = await check(await readConfig(configPath));
    assert.notEqual(firstCheck.fingerprints[1], changedCheck.fingerprints[1]);
    await writeFile(join(post, "dist", "runtime.txt"), "post-fix build\n");
    const invoke = async (): Promise<{
      directory: string | null;
      status: string;
      differential: boolean;
      exitCode: number;
    }> => {
      const result = await execute(process.execPath, [cli, "run", configPath], {
        timeout: 120_000,
        windowsHide: true,
        env: childEnvironment(),
      }).then(
        (success) => ({ stdout: success.stdout, exitCode: 0 }),
        (error: { code?: unknown; stdout?: unknown }) => {
          if (typeof error.stdout === "string" && error.stdout.trim().startsWith("{"))
            return { stdout: error.stdout, exitCode: Number(error.code) };
          throw error;
        },
      );
      const resultValue = JSON.parse(result.stdout.trim());
      if (typeof resultValue.directory === "string") runs.push(resultValue.directory);
      return { ...resultValue, exitCode: result.exitCode };
    };
    const successful = await invoke();
    assert.ok(successful.directory);
    const exportPath = join(successful.directory, "export.json");
    const exportText = await readFile(exportPath, "utf8");
    const bundle = JSON.parse(exportText);
    assert.equal(
      successful.differential,
      true,
      JSON.stringify({ successful, executions: bundle.executions }),
    );
    const localConfig = await readFile(join(successful.directory, "local-config.json"), "utf8");
    assert.doesNotMatch(localConfig, /SENTINEL_START_ARGUMENT|reprolock-verifier-/u);
    assert.doesNotMatch(exportText, /SENTINEL_START_ARGUMENT|reprolock-verifier-/u);
    assert.ok((await readdir(successful.directory)).every((name) => !name.endsWith(".log")));
    for (const side of [0, 1]) {
      const artifacts = await readdir(join(successful.directory, `local-artifacts-${side}`), {
        recursive: true,
      }).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return [];
        throw error;
      });
      assert.ok(
        artifacts.every((name) => name === ".last-run.json"),
        "Playwright page snapshots and attachments must not persist",
      );
    }
    assert.deepEqual(verifyBundle(bundle).outcomes, [
      ["functional-failure", "functional-failure"],
      ["pass", "pass"],
    ]);
    await execute(process.execPath, [cli, "verify", exportPath], {
      timeout: 10_000,
      windowsHide: true,
    });
    let offOriginHits = 0;
    const offOrigin = createServer((_request, response) => {
      offOriginHits++;
      response.end("unexpected request");
    });
    await new Promise<void>((accept) => offOrigin.listen(0, "127.0.0.1", accept));
    const offOriginAddress = offOrigin.address();
    assert.ok(offOriginAddress && typeof offOriginAddress !== "string");
    try {
      await writeFile(
        spec,
        candidate.replace(
          "test('a cleared counter",
          `test.use({ baseURL: 'http://127.0.0.1:${offOriginAddress.port}' });\ntest('a cleared counter`,
        ),
      );
      const guarded = await invoke();
      assert.equal(guarded.differential, false);
      assert.equal(offOriginHits, 0, "Candidate baseURL must not replace the exact-origin guard");
    } finally {
      await new Promise<void>((accept) => offOrigin.close(() => accept()));
      await writeFile(spec, candidate);
    }
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
      (b) => {
        b.fingerprints.push("0".repeat(64));
      },
      (b) => {
        b.unexpectedPrivateValue = "must be rejected";
      },
      (b) => {
        b.executions[0].extra = "must be rejected";
      },
      (b) => {
        b.executions[0].report.extra = "must be rejected";
      },
      (b) => {
        b.executions[0].report.observations[0].extra = "must be rejected";
      },
      (b) => {
        b.executions[0].report.observations[0].steps[0].extra = "must be rejected";
      },
    ];
    for (const mutate of mutations) {
      const changed = structuredClone(bundle);
      mutate(changed);
      for (const e of changed.executions) e.reportSha256 = hash(serializeCanonicalJson(e.report));
      assert.equal(verifyBundle(changed).differential, false);
    }
    const extraSource = structuredClone(bundle);
    extraSource.sourceHashes.extra = "0".repeat(64);
    for (const execution of extraSource.executions)
      execution.configurationSha256 = configurationDigest(extraSource);
    assert.equal(verifyBundle(extraSource).differential, false);
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
    assert.ok(misleading.directory);
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
    assert.ok(closed.directory);
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
    const runRoot = join(directory, "runs");
    const previous = new Set(await readdir(runRoot));
    const abort = new AbortController();
    const running = run(await readConfig(configPath), abort.signal);
    let observed = false;
    try {
      const until = Date.now() + 40_000;
      while (!observed && Date.now() < until) {
        for (const name of (await readdir(runRoot)).filter((name) => !previous.has(name))) {
          try {
            const report = JSON.parse(
              await readFile(join(runRoot, name, "report-0.json.partial-1"), "utf8"),
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
    const cancelledDirectory = (await running).directory;
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
    config.timeoutMs = 20_000;
    await writeFile(configPath, JSON.stringify(config));
    const partialTimeout = await invoke();
    assert.equal(partialTimeout.status, "timeout");
    assert.equal(partialTimeout.exitCode, 124);
    assert.ok(partialTimeout.directory);
    const partialBundle = JSON.parse(
      await readFile(join(partialTimeout.directory, "export.json"), "utf8"),
    );
    assert.equal(partialBundle.status, "timeout");
    assert.equal(partialBundle.executions[0].cleanup, true);
    assert.ok(
      partialBundle.executions[0].report.observations.length >= 1 &&
        partialBundle.executions[0].report.observations.length < 20,
    );
    assert.equal(verifyBundle(partialBundle).differential, false);
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
    assert.equal(timed.exitCode, 124);
    assert.equal(timed.directory, null);
    assert.equal(await git("status", "--porcelain"), "");
  } finally {
    await git("worktree", "remove", post).catch(() => {});
    for (const run of runs) {
      const resolved = resolve(run),
        output = resolve(directory, "runs");
      assert.ok(relative(output, resolved).startsWith("run-") && resolved.startsWith(output + sep));
      await rm(resolved, { recursive: true, force: true });
    }
    assert.ok(directory.startsWith(base + sep));
    await rm(directory, { recursive: true, force: true });
  }
});
