import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { DemoRunner } from "../../src/demo/run.ts";

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
