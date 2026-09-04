import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  attemptsFromReport,
  CASE,
  type DemoExport,
  type DemoRun,
  digest,
  makeExport,
  type Observation,
  reportFromObservations,
  type Side,
  verifyDemoExport,
} from "../../src/demo/evidence.ts";
import { minimizeMessage } from "../../src/demo/reporter.ts";
import { serializeCanonicalJson } from "../../src/evidence/canonical-json.ts";

async function validFixture(): Promise<DemoExport> {
  const run: DemoRun = {
    schemaVersion: 1,
    id: "fixture",
    caseId: CASE.id,
    startedAt: "2026-09-04T12:00:00.000Z",
    finishedAt: "2026-09-04T12:02:00.000Z",
    status: "completed",
    phase: "Fixture only",
    diagnostic: null,
    repeatEach: 20,
    timeoutMs: 1_200_000,
    modelCalls: 0,
    executions: [],
    sourceHashes: {
      "generated/safe-unfollow-163.spec.ts": CASE.specSha256,
      "generated/playwright.config.ts": CASE.configSha256,
    },
  };
  const files: Record<string, string> = {
    "safe-unfollow-163.spec.ts": await readFile(
      "spikes/local-functional-regression/generated/safe-unfollow-163.spec.ts",
      "utf8",
    ),
    "playwright.config.ts": await readFile(
      "spikes/local-functional-regression/generated/playwright.config.ts",
      "utf8",
    ),
  };
  const attempts = [];
  for (const side of ["pre-fix", "post-fix"] as Side[]) {
    const observations: Observation[] = Array.from({ length: 20 }, (_, index) => ({
      attempt: index + 1,
      workerIndex: index,
      at: "2026-09-04T12:01:00.000Z",
      id: `test-${index}`,
      title: "recovers the upload page after interrupted local analysis",
      file: "safe-unfollow-163.spec.ts",
      result: {
        status: side === "pre-fix" ? "failed" : "passed",
        retry: 0,
        duration: 100,
        errors:
          side === "pre-fix"
            ? [
                {
                  message:
                    "[functional-checkpoint:processing-cleared]\nAnalyzing locally...\ntoBeHidden\nExpected: hidden\nReceived: visible",
                },
              ]
            : [],
      },
    }));
    const report = reportFromObservations(
      observations,
      { workers: 1, repeatEach: 20, retries: 0 },
      { status: side === "pre-fix" ? "failed" : "passed", finishedAt: "2026-09-04T12:01:10.000Z" },
    );
    files[`reports/${side}.json`] = serializeCanonicalJson({
      ...(report as object),
      rawReportSha256: digest("synthetic unit-test fixture"),
    });
    attempts.push(...attemptsFromReport(report, side));
    run.executions.push({
      side,
      revision: CASE.revisions[side],
      cleanBefore: true,
      cleanAfter: true,
      lockSha256: CASE.lockSha256,
      exitCode: side === "pre-fix" ? 1 : 0,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      reportSha256: digest(files[`reports/${side}.json`] ?? ""),
      rawReportSha256: digest("synthetic unit-test fixture"),
      cleanup: [
        { observed: 1, survivors: 0, verified: true },
        { observed: 1, survivors: 0, verified: true },
      ],
    });
  }
  files["run.json"] = serializeCanonicalJson(run);
  files["attempts.json"] = serializeCanonicalJson(attempts);
  return makeExport(files);
}

function at<T>(values: T[], index: number): T {
  const value = values[index];
  assert.ok(value !== undefined);
  return value;
}

function editJson(
  bundle: DemoExport,
  path: string,
  update: (value: Record<string, unknown>) => void,
): void {
  const value = JSON.parse(bundle.files[path] ?? "{}");
  update(value);
  bundle.files[path] = serializeCanonicalJson(value);
}

test("new-run export verifies outcomes, identity and cleanup after a manifest refresh", async (t) => {
  const fixture = await validFixture();
  assert.deepEqual(verifyDemoExport(fixture), {
    integrity: true,
    consistent: true,
    differential: true,
    issues: [],
  });
  const mutations: [string, (bundle: DemoExport) => void][] = [
    [
      "string cleanup boolean",
      (bundle) =>
        editJson(bundle, "run.json", (run) => {
          at(at(run.executions as { cleanup: { verified: unknown }[] }[], 0).cleanup, 0).verified =
            "false";
        }),
    ],
    [
      "post-fix exit contradicts success",
      (bundle) =>
        editJson(bundle, "run.json", (run) => {
          at(run.executions as { exitCode: number }[], 1).exitCode = 1;
        }),
    ],
    [
      "pre-fix exit contradicts failure",
      (bundle) =>
        editJson(bundle, "run.json", (run) => {
          at(run.executions as { exitCode: number }[], 0).exitCode = 0;
        }),
    ],
    [
      "unverified cleanup",
      (bundle) =>
        editJson(bundle, "run.json", (run) => {
          at(at(run.executions as { cleanup: { verified: boolean }[] }[], 1).cleanup, 0).verified =
            false;
        }),
    ],
    [
      "surviving child",
      (bundle) =>
        editJson(bundle, "run.json", (run) => {
          at(at(run.executions as { cleanup: { survivors: number }[] }[], 0).cleanup, 0).survivors =
            1;
        }),
    ],
    [
      "wrong revision",
      (bundle) =>
        editJson(bundle, "run.json", (run) => {
          at(run.executions as { revision: string }[], 1).revision = CASE.revisions["pre-fix"];
        }),
    ],
    [
      "wrong source",
      (bundle) => {
        bundle.files["safe-unfollow-163.spec.ts"] += "\n// changed";
      },
    ],
    [
      "missing report",
      (bundle) => {
        delete bundle.files["reports/post-fix.json"];
      },
    ],
    [
      "edited attempts",
      (bundle) => {
        const attempts = JSON.parse(bundle.files["attempts.json"] ?? "[]");
        attempts.pop();
        bundle.files["attempts.json"] = serializeCanonicalJson(attempts);
      },
    ],
  ];
  for (const [name, mutation] of mutations)
    await t.test(name, () => {
      const altered = structuredClone(fixture);
      mutation(altered);
      const result = verifyDemoExport(makeExport(altered.files));
      assert.equal(result.integrity, true);
      assert.equal(result.consistent, false);
      assert.equal(result.differential, false);
    });
});

test("report edits cannot invent completed observations or visible/hidden failure semantics", async (t) => {
  const fixture = await validFixture();
  const mutations: [string, (observations: Observation[]) => void][] = [
    [
      "duplicate identity",
      (rows) => {
        at(rows, 1).id = at(rows, 0).id;
      },
    ],
    [
      "duplicate repetition",
      (rows) => {
        at(rows, 1).attempt = 1;
      },
    ],
    [
      "unstarted result",
      (rows) => {
        at(rows, 0).workerIndex = -1;
      },
    ],
    [
      "retry",
      (rows) => {
        at(rows, 0).result.retry = 1;
      },
    ],
    [
      "missing observation",
      (rows) => {
        rows.pop();
      },
    ],
    [
      "checkpoint without assertion semantics",
      (rows) => {
        at(rows, 0).result.errors = [{ message: "[functional-checkpoint:processing-cleared]" }];
      },
    ],
    [
      "passed with errors",
      (rows) => {
        at(rows, 0).result.status = "passed";
      },
    ],
    [
      "skipped",
      (rows) => {
        at(rows, 0).result.status = "skipped";
      },
    ],
    [
      "interrupted",
      (rows) => {
        at(rows, 0).result.status = "interrupted";
      },
    ],
    [
      "timed out",
      (rows) => {
        at(rows, 0).result.status = "timedOut";
      },
    ],
  ];
  for (const [name, mutation] of mutations)
    await t.test(name, () => {
      const bundle = structuredClone(fixture);
      const report = JSON.parse(bundle.files["reports/pre-fix.json"] ?? "{}");
      mutation(report.observations);
      const changed = reportFromObservations(
        report.observations,
        { workers: 1, repeatEach: 20, retries: 0 },
        report.completion,
      );
      bundle.files["reports/pre-fix.json"] = serializeCanonicalJson({
        ...(changed as object),
        rawReportSha256: digest("synthetic unit-test fixture"),
      });
      editJson(bundle, "run.json", (run) => {
        at(run.executions as { reportSha256: string }[], 0).reportSha256 = digest(
          bundle.files["reports/pre-fix.json"] ?? "",
        );
      });
      const result = verifyDemoExport(makeExport(bundle.files));
      assert.equal(result.integrity, true);
      assert.equal(result.differential, false);
      assert.equal(result.consistent, false);
    });
});

test("cancelled and timed-out runs retain evidence without granting the differential gate", async () => {
  for (const status of [
    "cancelled",
    "timeout",
    "startup-error",
    "execution-error",
    "cleanup-error",
  ]) {
    const fixture = await validFixture();
    editJson(fixture, "run.json", (run) => {
      run.status = status;
    });
    const result = verifyDemoExport(makeExport(fixture.files));
    assert.equal(result.integrity, true);
    assert.equal(result.consistent, true);
    assert.equal(result.differential, false);
  }
});

test("reporter retains assertion meaning without local paths or arbitrary page text", () => {
  const minimal = minimizeMessage(
    "Error in C:/private/target: [functional-checkpoint:processing-cleared]\nexpect toBeHidden Analyzing locally...\nExpected: hidden\nReceived: visible\nsecret page text",
  );
  assert.match(minimal, /Expected: hidden/u);
  assert.match(minimal, /Received: visible/u);
  assert.doesNotMatch(minimal, /private|secret/u);
  assert.equal(
    minimizeMessage("arbitrary error at C:/private/file"),
    "Unclassified execution error (raw diagnostic retained locally)",
  );
});
