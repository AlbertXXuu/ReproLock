import assert from "node:assert/strict";
import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyBundle } from "../src/verify/evidence.ts";

const path = resolve("spikes/local-candidate-verification/drawdb-687/evidence/reprolock.json");
const input = await lstat(path);
assert.ok(
  input.isFile() && !input.isSymbolicLink() && input.size <= 8_388_608,
  "Recorded evidence must be a regular non-symlink file at most 8 MiB",
);
const bytes = await readFile(path);
assert.ok(bytes.length <= 8_388_608, "Recorded evidence changed or exceeds 8 MiB");
const result = verifyBundle(JSON.parse(bytes.toString("utf8")));
const counts = (values) =>
  Object.fromEntries(
    [...new Set(values)]
      .sort()
      .map((value) => [value, values.filter((item) => item === value).length]),
  );
console.log(
  JSON.stringify({
    case: "DrawDB #687",
    differential: result.differential,
    preFix: counts(result.outcomes[0] ?? []),
    postFix: counts(result.outcomes[1] ?? []),
    issues: result.issues,
    evidence: "spikes/local-candidate-verification/drawdb-687/evidence/reprolock.json",
  }),
);
process.exitCode = result.differential ? 0 : 2;
