import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { verifyDemoExport } from "../src/demo/evidence.ts";

// Pin the expected outcomes of these particular recordings. A valid cancellation must not
// silently replace the complete-run acceptance evidence while still passing ordinary verification.
for (const status of ["completed", "cancelled", "timeout"]) {
  const path = new URL(`../docs/demo-evidence/${status}.json`, import.meta.url);
  const bundle = JSON.parse(await readFile(path, "utf8"));
  const result = verifyDemoExport(bundle);
  assert.equal(JSON.parse(bundle.files["run.json"]).status, status);
  assert.equal(result.integrity, true);
  assert.equal(result.consistent, true);
  assert.equal(result.differential, status === "completed");
  console.log(JSON.stringify({ recording: status, ...result }));
}
