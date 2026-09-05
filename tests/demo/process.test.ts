import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { OwnedProcess, restrictedChildEnvironment } from "../../src/demo/process.ts";

test("restricted child environments exclude Git identity overrides", () => {
  const values = {
    GIT_DIR: "wrong-git-directory",
    GIT_WORK_TREE: "wrong-worktree",
    GIT_CONFIG_COUNT: "1",
  };
  Object.assign(process.env, values);
  try {
    const child = restrictedChildEnvironment();
    for (const key of Object.keys(values)) assert.equal(child[key], undefined);
  } finally {
    for (const key of Object.keys(values)) delete process.env[key];
  }
});

test("owned processes receive the restricted environment by default", {
  timeout: 30_000,
}, async () => {
  const key = "REPROLOCK_TEST_PARENT_SECRET";
  process.env[key] = "must-not-cross-boundary";
  const restricted = new OwnedProcess(
    process.execPath,
    ["-e", `process.stdout.write(process.env.${key} ?? 'hidden');setInterval(()=>{},1000)`],
    process.cwd(),
    { REPROLOCK_EXPLICIT_VALUE: "allowed" },
  );
  const explicit = new OwnedProcess(
    process.execPath,
    [
      "-e",
      "process.stdout.write(process.env.REPROLOCK_EXPLICIT_VALUE ?? 'missing');setInterval(()=>{},1000)",
    ],
    process.cwd(),
    { REPROLOCK_EXPLICIT_VALUE: "allowed" },
  );
  try {
    const readyBy = Date.now() + 10_000;
    while (
      (!restricted.output.includes("hidden") || !explicit.output.includes("allowed")) &&
      Date.now() < readyBy
    )
      await delay(25);
    assert.equal(restricted.output, "hidden");
    assert.equal(explicit.output, "allowed");
  } finally {
    delete process.env[key];
    await restricted.stop();
    await explicit.stop();
  }
});

test("owned process tree is observed and terminated without touching an unrelated process", {
  timeout: 35_000,
}, async () => {
  const unrelated = new OwnedProcess(
    process.execPath,
    ["-e", "setInterval(()=>{},1000)"],
    process.cwd(),
  );
  const owned = new OwnedProcess(
    process.execPath,
    [
      "-e",
      "const {spawn}=require('node:child_process');spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});process.stdout.write('child-ready');setInterval(()=>{},1000)",
    ],
    process.cwd(),
  );
  try {
    const readyBy = Date.now() + 10_000;
    while (!owned.output.includes("child-ready") && Date.now() < readyBy && !owned.exited)
      await delay(25);
    assert.match(owned.output, /child-ready/u);
    await owned.observe();
    const cleanup = await owned.stop();
    assert.ok(cleanup.observed >= 2);
    assert.equal(cleanup.survivors, 0);
    assert.equal(cleanup.verified, true);
    assert.ok(unrelated.child.pid);
    assert.doesNotThrow(() => process.kill(unrelated.child.pid as number, 0));
  } finally {
    await owned.stop();
    await unrelated.stop();
  }
});

test("inventory failure does not skip termination of the owned child", {
  timeout: 30_000,
}, async () => {
  const owned = new OwnedProcess(
    process.execPath,
    ["-e", "setInterval(()=>{},1000)"],
    process.cwd(),
  );
  owned.observe = async () => {
    throw new Error("inventory unavailable");
  };
  const cleanup = await owned.stop();
  assert.equal(owned.exited, true);
  assert.equal(cleanup.verified, false);
});
