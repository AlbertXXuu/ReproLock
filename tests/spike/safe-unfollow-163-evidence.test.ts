import assert from "node:assert/strict";
import test from "node:test";

import {
  type AttemptRecord,
  assertPortableRelativePath,
  canonicalizeAttemptRecords,
  createManifestEntries,
  EvidenceValidationError,
  parsePlaywrightJsonReport,
  serializeAttemptsJsonl,
  verifyManifestEntries,
  verifyRepetitionGate,
} from "../../spikes/local-functional-regression/tools/evidence.ts";

const preFixRevision = "64c8a1d0f4c1a9a4ffbab2ea319d89bcab21ad47";
const postFixRevision = "ab55329e354dfb121486d7ff1f7daa2fa2e2e5fa";
const specSha256 = "d750b422a2452e1fe299ee893f65e673831e4b51085d9e4a8590772c830280ad";

function playwrightReport(results: readonly unknown[]): unknown {
  return {
    suites: [
      {
        specs: [
          {
            file: "generated/safe-unfollow-163.spec.ts",
            tests: [
              {
                projectName: "chromium",
                results,
              },
            ],
            title: "recovers the upload page after interrupted local analysis",
          },
        ],
        suites: [],
        title: "safe-unfollow-163.spec.ts",
      },
    ],
  };
}

function attemptRecord(
  side: "pre-fix" | "post-fix",
  attempt: number,
  overrides: Partial<AttemptRecord> = {},
): AttemptRecord {
  const isPreFix = side === "pre-fix";
  return {
    attempt,
    caseId: "safe-unfollow-163",
    classification: isPreFix ? "functional-failure" : "pass",
    firstFailedCheckpoint: isPreFix ? "processing-cleared" : null,
    modelCalls: 0,
    playwrightStatus: isPreFix ? "failed" : "passed",
    retry: 0,
    revision: isPreFix ? preFixRevision : postFixRevision,
    schemaVersion: 1,
    side,
    specSha256,
    ...overrides,
  };
}

function passingGate(): AttemptRecord[] {
  const attempts: AttemptRecord[] = [];
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    attempts.push(attemptRecord("pre-fix", attempt));
    attempts.push(attemptRecord("post-fix", attempt));
  }
  return attempts;
}

test("Playwright JSON results are classified only from status and stable checkpoint tags", () => {
  const parsed = parsePlaywrightJsonReport(
    playwrightReport([
      { duration: 12, errors: [], retry: 0, status: "passed" },
      {
        duration: 10_000,
        error: {
          message:
            "Error: [functional-checkpoint:processing-cleared]\nExpected element to be hidden",
        },
        errors: [],
        retry: 0,
        status: "failed",
      },
      {
        duration: 5,
        errors: [{ message: "[reset-checkpoint:origin-storage-cleared] expected empty" }],
        retry: 0,
        status: "failed",
      },
      {
        errors: [{ message: "[setup-checkpoint:upload-page-ready] heading was not visible" }],
        retry: 0,
        status: "failed",
      },
      {
        errors: [{ message: "browser process exited unexpectedly" }],
        retry: 0,
        status: "interrupted",
      },
      {
        errors: [{ message: "[target-startup-checkpoint:server-ready] refused connection" }],
        retry: 0,
        status: "failed",
      },
      {
        errors: [{ message: "[functional-checkpoint:processing-cleared] timeout" }],
        retry: 0,
        status: "timedOut",
      },
      {
        errors: [{ message: "[functional-checkpoint:processing-cleared] interrupted" }],
        retry: 0,
        status: "interrupted",
      },
      { errors: [], retry: 0, status: "skipped" },
    ]),
  );

  assert.deepEqual(
    parsed.map((result) => [result.classification, result.firstFailedCheckpoint]),
    [
      ["pass", null],
      ["functional-failure", "processing-cleared"],
      ["reset-error", "origin-storage-cleared"],
      ["inconclusive", "upload-page-ready"],
      ["browser-runtime-error", null],
      ["target-startup-error", "server-ready"],
      ["browser-runtime-error", null],
      ["browser-runtime-error", null],
      ["inconclusive", null],
    ],
  );
  assert.equal(parsed[0]?.durationMs, 12);
  assert.equal(parsed[0]?.file, "generated/safe-unfollow-163.spec.ts");
  assert.deepEqual(parsed[1]?.errorMessages, [
    "Error: [functional-checkpoint:processing-cleared]\nExpected element to be hidden",
  ]);
  assert.deepEqual(parsed[0]?.titlePath, [
    "safe-unfollow-163.spec.ts",
    "recovers the upload page after interrupted local analysis",
  ]);
});

test("hostile and malformed Playwright reports fail closed with typed validation errors", () => {
  const accessorReport = {};
  Object.defineProperty(accessorReport, "suites", {
    enumerable: true,
    get: () => {
      throw new Error("must not execute");
    },
  });
  assert.throws(() => parsePlaywrightJsonReport(accessorReport), EvidenceValidationError);

  const inheritedReport = Object.create({ suites: [] }) as { suites?: unknown };
  inheritedReport.suites = [];
  assert.throws(() => parsePlaywrightJsonReport(inheritedReport), EvidenceValidationError);

  assert.throws(
    () => parsePlaywrightJsonReport(playwrightReport([{ retry: 0, status: "flaky" }])),
    /status: expected one of/u,
  );
  assert.throws(
    () =>
      parsePlaywrightJsonReport(playwrightReport([{ errors: [17], retry: 0, status: "failed" }])),
    /errors\[0\]: expected an object/u,
  );
  assert.throws(() => parsePlaywrightJsonReport({}), /report\.suites: expected an array/u);
});

test("attempt records receive stable ordering and canonical JSONL without a blank line", () => {
  const unsorted = [
    attemptRecord("post-fix", 2),
    attemptRecord("pre-fix", 2),
    attemptRecord("post-fix", 1),
    attemptRecord("pre-fix", 1),
  ];

  assert.deepEqual(
    canonicalizeAttemptRecords(unsorted).map((attempt) => `${attempt.side}/${attempt.attempt}`),
    ["pre-fix/1", "pre-fix/2", "post-fix/1", "post-fix/2"],
  );

  const jsonl = serializeAttemptsJsonl(unsorted);
  assert.equal(jsonl.endsWith("\n"), false);
  const lines = jsonl.split("\n");
  assert.equal(lines.length, 4);
  assert.equal(
    lines[0]?.startsWith(
      '{"attempt":1,"caseId":"safe-unfollow-163","classification":"functional-failure"',
    ),
    true,
  );
  assert.equal(JSON.parse(lines[3] ?? "{}").side, "post-fix");
  assert.equal(jsonl.includes("Expected element to be hidden"), false);

  assert.throws(
    () => canonicalizeAttemptRecords([attemptRecord("pre-fix", 1), attemptRecord("pre-fix", 1)]),
    /Duplicate attempt record/u,
  );
  assert.throws(
    () =>
      canonicalizeAttemptRecords([
        attemptRecord("pre-fix", 3, {
          classification: "pass",
          firstFailedCheckpoint: null,
        }),
      ]),
    /pass classification and passed Playwright status must agree/u,
  );
});

test("manifest entries are portable, sorted, and verified against exact bytes", () => {
  const artifacts = [
    { contents: new Uint8Array([0, 1, 2]), path: "z/binary.bin" },
    { contents: "hello", path: "a/report.txt" },
  ];
  const entries = createManifestEntries(artifacts);

  assert.deepEqual(entries, [
    {
      bytes: 5,
      path: "a/report.txt",
      sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    },
    {
      bytes: 3,
      path: "z/binary.bin",
      sha256: "ae4b3280e56e2faf83f414a6e3dabe9d5fbe18976544c05fed121accb85b53fc",
    },
  ]);
  assert.deepEqual(verifyManifestEntries(entries, artifacts), { issues: [], ok: true });

  const reportEntry = entries[0];
  const binaryEntry = entries[1];
  assert.ok(reportEntry);
  assert.ok(binaryEntry);

  const invalid = verifyManifestEntries(
    [
      { ...binaryEntry, bytes: 4 },
      { ...reportEntry, sha256: "0".repeat(64) },
      { bytes: -1, path: "extra.json", sha256: "not-a-digest" },
    ],
    artifacts,
  );
  assert.equal(invalid.ok, false);
  assert.deepEqual(
    new Set(invalid.issues.map((entry) => entry.code)),
    new Set(["manifest-order", "manifest-bytes", "manifest-sha256", "manifest-unexpected-entry"]),
  );

  for (const path of ["../escape.json", "C:/absolute.json", "nested\\file.json", "CON.txt"]) {
    assert.throws(() => assertPortableRelativePath(path), EvidenceValidationError);
  }
});

test("the repetition gate accepts exactly twenty expected failures and twenty passes", () => {
  const result = verifyRepetitionGate(passingGate(), {
    expectedCaseId: "safe-unfollow-163",
    postFixRevision,
    preFixRevision,
    specSha256,
  });
  assert.deepEqual(result, { issues: [], ok: true });
});

test("the repetition gate exposes count, hash, retry, model, classification, and checkpoint faults", () => {
  const attempts = passingGate().slice(1);
  attempts[0] = attemptRecord("post-fix", 1, { modelCalls: 1 });
  attempts[1] = attemptRecord("pre-fix", 2, {
    classification: "reset-error",
    firstFailedCheckpoint: "origin-storage-cleared",
    retry: 1,
    specSha256: "0".repeat(64),
  });

  const result = verifyRepetitionGate(attempts, {
    expectedCaseId: "safe-unfollow-163",
    postFixRevision,
    preFixRevision,
    specSha256,
  });
  assert.equal(result.ok, false);
  const codes = new Set(result.issues.map((entry) => entry.code));
  for (const code of [
    "attempt-count",
    "attempt-number",
    "checkpoint",
    "classification",
    "model-calls",
    "retry",
    "spec-hash",
  ] as const) {
    assert.equal(codes.has(code), true, `missing ${code}`);
  }
});
