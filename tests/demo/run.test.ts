import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { CASE } from "../../src/demo/evidence.ts";
import { configuredOrigin, DemoRunner, readConfig } from "../../src/demo/run.ts";
import { DEFAULT_DEMO_PORT, recentRunIds, startDemo } from "../../src/demo/server.ts";

const execute = promisify(execFile);

test("Demo configuration is bounded before JSON parsing", async () => {
  const root = await mkdtemp(join(tmpdir(), "reprolock-demo-config-"));
  try {
    const oversized = join(root, "oversized.json");
    await writeFile(oversized, Buffer.alloc(262_145, 123));
    await assert.rejects(readConfig(oversized), /regular file at most 256 KiB/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Demo configuration rejects misspelled, extra and empty target fields", async () => {
  const root = await mkdtemp(join(tmpdir(), "reprolock-demo-config-"));
  try {
    const config = join(root, "demo.json");
    for (const value of [
      { targets: { "pre-fix": "pre", "post-fix": "post" }, timeOutMs: 1 },
      { targets: { "pre-fix": "pre", "post-fix": "post", extra: "target" } },
      { targets: { "pre-fix": " ", "post-fix": "post" } },
    ]) {
      await writeFile(config, JSON.stringify(value));
      await assert.rejects(readConfig(config));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Demo history keeps only the newest 30 valid run directories", async () => {
  const root = await mkdtemp(join(tmpdir(), "reprolock-demo-history-"));
  try {
    const ids = Array.from(
      { length: 35 },
      (_, index) =>
        `20260905T${String(index).padStart(6, "0")}Z-${index.toString(16).padStart(8, "0")}`,
    );
    await Promise.all(ids.map((id) => mkdir(join(root, id))));
    await mkdir(join(root, "not-a-run"));
    await writeFile(join(root, "99999999T999999Z-deadbeef"), "not a directory");
    assert.deepEqual(await recentRunIds(root), [...ids].sort().reverse().slice(0, 30));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Demo reads the repository-local origin without global URL rewrites", async () => {
  const root = await mkdtemp(join(tmpdir(), "reprolock-demo-origin-"));
  const repo = join(root, "repo");
  const home = join(root, "home");
  const originalHome = process.env.HOME;
  const originalProfile = process.env.USERPROFILE;
  try {
    await mkdir(repo);
    await mkdir(home);
    await execute("git", ["-C", repo, "init"]);
    await execute("git", ["-C", repo, "remote", "add", "origin", CASE.repository]);
    await writeFile(
      join(home, ".gitconfig"),
      '[url "ssh://mirror.invalid/"]\n\tinsteadOf = https://github.com/\n',
    );
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    assert.equal(await configuredOrigin(repo), CASE.repository);
  } finally {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = originalProfile;
    await rm(root, { recursive: true, force: true });
  }
});

test("Demo defaults to the AlvenX 7872 port and reports an occupied port", async () => {
  const root = await mkdtemp(join(tmpdir(), "reprolock-demo-port-"));
  const config = join(root, "demo.json");
  await writeFile(
    config,
    JSON.stringify({
      targets: {
        "pre-fix": join(root, "missing-pre"),
        "post-fix": join(root, "missing-post"),
      },
    }),
  );
  let demo: Awaited<ReturnType<typeof startDemo>> | null = null;
  try {
    demo = await startDemo({ configPath: config });
    assert.equal(demo.address, `http://127.0.0.1:${DEFAULT_DEMO_PORT}`);
    await assert.rejects(
      startDemo({ configPath: config }),
      new RegExp(`Demo UI port ${DEFAULT_DEMO_PORT} is already in use`, "u"),
    );
  } finally {
    await demo?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("cancel during initialization is retained, with no attempted target execution", {
  timeout: 15_000,
}, async () => {
  const root = await mkdtemp(join(tmpdir(), "reprolock-early-cancel-"));
  const runner = new DemoRunner(root, {
    targets: { "pre-fix": join(root, "missing-pre"), "post-fix": join(root, "missing-post") },
    timeoutMs: 10_000,
  });
  try {
    await cp(
      "spikes/local-functional-regression/generated",
      join(root, "spikes/local-functional-regression/generated"),
      { recursive: true },
    );
    await mkdir(join(root, "src/demo"), { recursive: true });
    for (const name of ["run.ts", "reporter.ts", "evidence.ts", "process.ts"])
      await cp(join("src/demo", name), join(root, "src/demo", name));
    for (const stop of [
      () => {
        runner.cancel();
        runner.cancel();
      },
      () => runner.shutdown(),
    ]) {
      const pending = runner.start();
      assert.equal(runner.active, true);
      const stopping = stop();
      const id = await pending;
      await stopping;
      const until = Date.now() + 10_000;
      while (runner.active && Date.now() < until) await delay(10);
      assert.equal(runner.active, false);
      const final = JSON.parse(await readFile(join(root, "output/demo", id, "final.json"), "utf8"));
      assert.equal(final.run.status, "cancelled");
      assert.deepEqual(final.run.executions, []);
      assert.deepEqual(final.attempts, []);
      assert.equal(final.verification.integrity, true);
      assert.equal(final.verification.consistent, true);
      assert.equal(final.verification.differential, false);
    }
  } finally {
    await runner.shutdown();
    await rm(root, { recursive: true, force: true });
  }
});
