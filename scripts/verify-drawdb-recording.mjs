import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { serializeCanonicalJson } from "../src/evidence/canonical-json.ts";
import { hash, verifyBundle } from "../src/verify/evidence.ts";

const caseRoot = resolve("spikes/local-candidate-verification/drawdb-687");
const comparisonBytes = await readFile(`${caseRoot}/evidence/comparison.json`);
const comparison = JSON.parse(comparisonBytes.toString("utf8"));
const exportBytes = await readFile(`${caseRoot}/evidence/reprolock.json`);
const bundle = JSON.parse(exportBytes.toString("utf8"));
const candidate = await readFile(`${caseRoot}/candidate.spec.ts`, "utf8");
const portableConfig = await readFile(`${caseRoot}/playwright.config.ts`);
const sha = /^[a-f0-9]{64}$/u;

assert.equal(comparison.schemaVersion, 1);
assert.equal(comparison.caseId, "drawdb-687");
assert.equal(comparison.candidate.sha256, hash(candidate));
assert.equal(bundle.candidate, candidate);
assert.equal(bundle.candidateSha256, comparison.candidate.sha256);
assert.deepEqual(bundle.revisions, [
  "da0f084d47cd5cb4992df6d3a23707543338e796",
  "9df18ecc272caf5c2368fc305ae40788103fd0d0",
]);
const result = verifyBundle(bundle);
assert.equal(result.differential, true);
assert.deepEqual(result.issues, []);
assert.deepEqual(
  result.outcomes.map((rows) =>
    rows.reduce((counts, value) => {
      counts[value] = (counts[value] ?? 0) + 1;
      return counts;
    }, {}),
  ),
  [{ "functional-failure": 20 }, { pass: 20 }],
);
assert.equal(comparison.formal.reprolock.exportSha256, hash(exportBytes));
assert.equal(
  comparison.formal.ordinaryPlaywright.portableConfigurationSha256,
  hash(portableConfig),
);
assert.deepEqual(comparison.formal.before, comparison.formal.after);
assert.deepEqual(comparison.parameters, {
  browser: "chromium",
  capture: "off",
  globalTimeoutMs: 600_000,
  headless: true,
  repetitions: 20,
  retries: 0,
  serviceWorkers: "block",
  testTimeoutMs: 20_000,
  viewport: { height: 720, width: 1280 },
  workers: 1,
});

assert.equal(comparison.builds.length, 2);
for (const [index, build] of comparison.builds.entries()) {
  assert.equal(build.side, index === 0 ? "pre" : "post");
  assert.equal(build.revision, bundle.revisions[index]);
  assert.ok(sha.test(build.digest));
  assert.ok(Array.isArray(build.files) && build.files.length === 28);
  const paths = build.files.map((file) => file.path);
  assert.equal(new Set(paths).size, paths.length);
  assert.deepEqual(
    paths,
    [...paths].sort((a, b) => a.localeCompare(b, "en")),
  );
  for (const file of build.files) {
    assert.ok(
      typeof file.path === "string" &&
        !file.path.startsWith("/") &&
        !file.path.includes("\\") &&
        !file.path.split("/").includes(".."),
    );
    assert.ok(Number.isInteger(file.bytes) && file.bytes >= 0 && file.bytes <= 20_000_000);
    assert.ok(sha.test(file.sha256));
  }
  assert.equal(build.digest, hash(serializeCanonicalJson(build.files)));
  assert.equal(comparison.formal.before[index].buildSha256, build.digest);
  assert.equal(comparison.formal.before[index].revision, build.revision);
  assert.equal(comparison.formal.before[index].clean, true);
  assert.ok(sha.test(comparison.formal.before[index].targetFingerprint));
}

assert.equal(comparison.preliminary.status, "error");
assert.deepEqual(comparison.preliminary.cleanup, [true, false]);
assert.match(comparison.preliminary.excludedReason, /not verified/u);
assert.deepEqual(comparison.preliminary.outcomes, [{ "functional-failure": 20 }, { pass: 20 }]);
assert.equal(comparison.formal.reprolock.exitCode, 0);
assert.equal(comparison.formal.reprolock.cleanup.verified, true);
assert.equal(comparison.formal.reprolock.cleanup.survivors, 0);
assert.deepEqual(comparison.formal.reprolock.outcomes, [
  { "functional-failure": 20 },
  { pass: 20 },
]);

const arms = comparison.formal.ordinaryPlaywright.executions;
assert.equal(comparison.formal.ordinaryPlaywright.version, "1.62.1");
assert.equal(arms.length, 2);
assert.deepEqual(
  arms.map((arm) => ({ side: arm.side, exitCode: arm.exitCode, statistics: arm.statistics })),
  [
    {
      side: "pre",
      exitCode: 1,
      statistics: { expected: 0, flaky: 0, skipped: 0, unexpected: 20 },
    },
    {
      side: "post",
      exitCode: 0,
      statistics: { expected: 20, flaky: 0, skipped: 0, unexpected: 0 },
    },
  ],
);
const ids = arms[0].observations.map((row) => row.testId);
assert.equal(new Set(ids).size, 20);
for (const [index, arm] of arms.entries()) {
  assert.equal(arm.revision, bundle.revisions[index]);
  assert.equal(arm.rawReportLocalOnly, true);
  assert.ok(sha.test(arm.rawReportSha256));
  assert.ok(arm.durationMs > 0 && arm.durationMs <= 600_000);
  assert.ok(arm.runnerDurationMs > 0 && arm.runnerDurationMs <= arm.durationMs);
  assert.ok(
    arm.cleanup.length === 2 &&
      arm.cleanup.every((cleanup) => cleanup.verified && cleanup.survivors === 0),
  );
  assert.equal(arm.observations.length, 20);
  assert.deepEqual(
    arm.observations.map((row) => row.testId),
    ids,
  );
  for (const [ordinal, row] of arm.observations.entries()) {
    assert.equal(row.ordinal, ordinal);
    assert.equal(row.status, index === 0 ? "failed" : "passed");
    assert.ok(row.durationMs > 0 && row.durationMs <= 20_000);
    assert.ok(row.resetDurationMs > 0 && row.resetDurationMs < row.durationMs);
    assert.ok(row.outcomeDurationMs >= 0 && row.outcomeDurationMs < row.durationMs);
    if (index === 0) {
      assert.deepEqual(row.outcome, {
        checkpoint: "back-returns-home",
        matcher: "toBe",
        expected: "/",
        received: "/editor",
        line: 54,
        column: 75,
        errorMessageSha256: row.outcome.errorMessageSha256,
      });
      assert.ok(sha.test(row.outcome.errorMessageSha256));
      assert.deepEqual(row.omittedAttachments, [
        { contentType: "text/markdown", name: "error-context" },
      ]);
    } else {
      assert.equal(row.outcome, undefined);
      assert.equal(row.omittedAttachments, undefined);
    }
  }
}

const serialized = comparisonBytes.toString("utf8");
assert.doesNotMatch(serialized, /[A-Z]:\\|Users\\|\.Development\\/u);
assert.equal(comparison.limits.length, 5);
console.log(
  `DrawDB #687 recorded evidence passed (${hash(comparisonBytes)}, ${hash(exportBytes)})`,
);
