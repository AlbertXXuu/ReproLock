import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { OwnedProcess } from "../../src/demo/process.ts";

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
