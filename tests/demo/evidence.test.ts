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
    finishedAt: "2026-09-04T12:03:00.000Z",
    status: "completed",
    phase: "Finished; current evidence retained",
    diagnostic: null,
    repeatEach: 20,
    timeoutMs: 1_200_000,
    modelCalls: 0,
    executions: [],
    sourceHashes: {
      "generated/safe-unfollow-163.spec.ts": CASE.specSha256,
      "generated/playwright.config.ts": CASE.configSha256,
      "demo/run.ts": digest("fixture run source"),
      "demo/reporter.ts": digest("fixture reporter source"),
      "demo/evidence.ts": digest("fixture evidence source"),
      "demo/process.ts": digest("fixture process source"),
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
    const executionStartedAt =
      side === "pre-fix" ? "2026-09-04T12:00:10.000Z" : "2026-09-04T12:01:30.000Z";
    const reportStartedAt =
      side === "pre-fix" ? "2026-09-04T12:00:20.000Z" : "2026-09-04T12:01:40.000Z";
    const observationAt =
      side === "pre-fix" ? "2026-09-04T12:01:00.000Z" : "2026-09-04T12:02:00.000Z";
    const completionAt =
      side === "pre-fix" ? "2026-09-04T12:01:10.000Z" : "2026-09-04T12:02:10.000Z";
    const executionFinishedAt =
      side === "pre-fix" ? "2026-09-04T12:01:20.000Z" : "2026-09-04T12:02:20.000Z";
    const observations: Observation[] = Array.from({ length: 20 }, (_, index) => ({
      attempt: index + 1,
      workerIndex: index,
      at: observationAt,
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
      { workers: 1, repeatEach: 20, retries: 0, startedAt: reportStartedAt },
      { status: side === "pre-fix" ? "failed" : "passed", finishedAt: completionAt },
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
      startedAt: executionStartedAt,
      finishedAt: executionFinishedAt,
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

function at<T>(values: readonly T[], index: number): T {
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
      "completed run retains a failure diagnostic",
      (bundle) =>
        editJson(bundle, "run.json", (run) => {
          run.diagnostic = "The execution failed";
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
  assert.equal(verifyDemoExport(fixture).differential, true);
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
      const changed = reportFromObservations(report.observations, report.config, report.completion);
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
      if (status === "timeout") run.timeoutMs = 150_000;
      run.diagnostic =
        status === "cancelled"
          ? "Cancelled by the user; unexecuted repetitions are not counted"
          : status === "timeout"
            ? "Run deadline reached; incomplete observations are retained"
            : `Fixture status: ${status}`;
      if (status === "startup-error") {
        run.executions = [];
      }
      if (status === "cleanup-error") {
        at(
          at(run.executions as { cleanup: { survivors: number; verified: boolean }[] }[], 1)
            .cleanup,
          0,
        ).verified = false;
      }
    });
    if (status === "startup-error") {
      delete fixture.files["reports/pre-fix.json"];
      delete fixture.files["reports/post-fix.json"];
      fixture.files["attempts.json"] = "[]\n";
    }
    const result = verifyDemoExport(makeExport(fixture.files));
    assert.equal(result.integrity, true);
    assert.equal(result.consistent, true);
    assert.equal(result.differential, false);
  }
});

test("recorded incomplete runs bind cancellation and timeout exits", async () => {
  for (const [name, expectedExit, completionStatus] of [
    ["cancelled", 130, "interrupted"],
    ["timeout", 124, "timedout"],
  ] as const) {
    const fixture = JSON.parse(
      await readFile(`docs/demo-evidence/${name}.json`, "utf8"),
    ) as DemoExport;
    assert.deepEqual(verifyDemoExport(fixture), {
      integrity: true,
      consistent: true,
      differential: false,
      issues: [],
    });
    editJson(fixture, "run.json", (run) => {
      const execution = at(run.executions as { exitCode: number }[], 0);
      assert.equal(execution.exitCode, expectedExit);
      execution.exitCode = 0;
    });
    const result = verifyDemoExport(makeExport(fixture.files));
    assert.equal(result.integrity, true);
    assert.equal(result.consistent, false);
    assert.equal(result.differential, false);

    const completedInterruption = JSON.parse(
      await readFile(`docs/demo-evidence/${name}.json`, "utf8"),
    ) as DemoExport;
    const recordedRun = JSON.parse(completedInterruption.files["run.json"] ?? "{}") as {
      executions: { finishedAt: string }[];
    };
    editJson(completedInterruption, "reports/pre-fix.json", (report) => {
      report.completion = {
        finishedAt: at(recordedRun.executions, 0).finishedAt,
        status: completionStatus,
      };
    });
    editJson(completedInterruption, "run.json", (run) => {
      const execution = at(run.executions as { exitCode: number; reportSha256: string }[], 0);
      execution.exitCode = 0;
      execution.reportSha256 = digest(completedInterruption.files["reports/pre-fix.json"] ?? "");
    });
    const completedResult = verifyDemoExport(makeExport(completedInterruption.files));
    assert.equal(completedResult.integrity, true);
    assert.equal(completedResult.consistent, false);
    assert.equal(completedResult.differential, false);
  }
});

test("recorded cancellation and timeout status fields cannot contradict the runner", async () => {
  const cancelled = JSON.parse(
    await readFile("docs/demo-evidence/cancelled.json", "utf8"),
  ) as DemoExport;
  editJson(cancelled, "run.json", (run) => {
    run.diagnostic = "Run deadline reached; incomplete observations are retained";
  });
  assert.equal(verifyDemoExport(makeExport(cancelled.files)).consistent, false);

  const timeout = JSON.parse(
    await readFile("docs/demo-evidence/timeout.json", "utf8"),
  ) as DemoExport;
  editJson(timeout, "run.json", (run) => {
    run.timeoutMs = 1_500_000;
  });
  assert.equal(verifyDemoExport(makeExport(timeout.files)).consistent, false);
});

test("portable reports must start inside their execution window", async () => {
  const fixture = await validFixture();
  editJson(fixture, "reports/post-fix.json", (report) => {
    (report.config as Record<string, unknown>).startedAt = "2000-01-01T00:00:00.000Z";
  });
  editJson(fixture, "run.json", (run) => {
    at(run.executions as { reportSha256: string }[], 1).reportSha256 = digest(
      fixture.files["reports/post-fix.json"] ?? "",
    );
  });
  const result = verifyDemoExport(makeExport(fixture.files));
  assert.equal(result.integrity, true);
  assert.equal(result.consistent, false);
  assert.equal(result.differential, false);
});

test("portable report completion must match its aggregate observations", async () => {
  for (const [side, completionStatus, exitCode] of [
    ["pre-fix", "passed", 0],
    ["post-fix", "failed", 1],
  ] as const) {
    const fixture = await validFixture();
    editJson(fixture, `reports/${side}.json`, (report) => {
      (report.completion as Record<string, unknown>).status = completionStatus;
    });
    editJson(fixture, "run.json", (run) => {
      run.status = "cancelled";
      run.diagnostic = "Cancelled by the user; unexecuted repetitions are not counted";
      const execution = at(
        run.executions as { exitCode: number; reportSha256: string; side: Side }[],
        side === "pre-fix" ? 0 : 1,
      );
      execution.exitCode = exitCode;
      execution.reportSha256 = digest(fixture.files[`reports/${side}.json`] ?? "");
    });
    const result = verifyDemoExport(makeExport(fixture.files));
    assert.equal(result.integrity, true);
    assert.equal(result.consistent, false);
    assert.equal(result.differential, false);
  }
});

test("differential executions must remain sequential", async () => {
  const fixture = await validFixture();
  editJson(fixture, "run.json", (run) => {
    const executions = run.executions as { startedAt: string }[];
    at(executions, 1).startedAt = at(executions, 0).startedAt;
  });
  const result = verifyDemoExport(makeExport(fixture.files));
  assert.equal(result.integrity, true);
  assert.equal(result.consistent, false);
  assert.equal(result.differential, false);
});

test("cleanup-error must retain a failed cleanup observation", async () => {
  const fixture = await validFixture();
  editJson(fixture, "run.json", (run) => {
    run.status = "cleanup-error";
    run.diagnostic = "Owned process cleanup could not be verified";
  });
  const result = verifyDemoExport(makeExport(fixture.files));
  assert.equal(result.integrity, true);
  assert.equal(result.consistent, false);
  assert.equal(result.differential, false);
});

test("failed or missing cleanup cannot retain another final status", async () => {
  const recorded = JSON.parse(
    await readFile("docs/demo-evidence/cancelled.json", "utf8"),
  ) as DemoExport;
  editJson(recorded, "run.json", (run) => {
    const cleanup = at(
      at(run.executions as { cleanup: { survivors: number; verified: boolean }[] }[], 0).cleanup,
      0,
    );
    cleanup.survivors = -1;
    cleanup.verified = false;
  });
  assert.equal(verifyDemoExport(makeExport(recorded.files)).consistent, false);

  const missing = JSON.parse(
    await readFile("docs/demo-evidence/cancelled.json", "utf8"),
  ) as DemoExport;
  editJson(missing, "run.json", (run) => {
    at(run.executions as { cleanup: unknown[] }[], 0).cleanup = [];
  });
  assert.equal(verifyDemoExport(makeExport(missing.files)).consistent, false);
});

test("portable Demo verification rejects unbounded or unexpected file maps before hashing", async () => {
  const unexpected = await validFixture();
  unexpected.files["unbounded.txt"] = "x";
  assert.deepEqual(verifyDemoExport(unexpected), {
    integrity: false,
    consistent: false,
    differential: false,
    issues: ["Unexpected exported file: unbounded.txt"],
  });
  const oversized = await validFixture();
  oversized.files["attempts.json"] = "x".repeat(4_194_305);
  const result = verifyDemoExport(oversized);
  assert.equal(result.integrity, false);
  assert.equal(result.differential, false);
  assert.match(result.issues[0] ?? "", /exceeds 4 MiB/u);
});

test("portable Demo verification rejects unknown schema fields after refreshed bindings", async (t) => {
  const fixture = await validFixture();
  await t.test("export root", () => {
    const altered = structuredClone(fixture) as DemoExport & { extra?: string };
    altered.extra = "must be rejected";
    assert.equal(verifyDemoExport(altered).integrity, false);
  });
  await t.test("manifest entry", () => {
    const altered = structuredClone(fixture);
    const entry = at(altered.manifest, 0) as unknown as Record<string, unknown> & {
      extra?: string;
    };
    entry.extra = "must be rejected";
    assert.equal(verifyDemoExport(altered).integrity, false);
  });
  for (const [name, mutate] of [
    ["run", (run: Record<string, unknown>) => (run.extra = "must be rejected")],
    [
      "source hashes",
      (run: Record<string, unknown>) =>
        ((run.sourceHashes as Record<string, unknown>).extra = "must be rejected"),
    ],
  ] as const)
    await t.test(name, () => {
      const altered = structuredClone(fixture);
      editJson(altered, "run.json", mutate);
      const result = verifyDemoExport(makeExport(altered.files));
      assert.equal(result.integrity, true);
      assert.equal(result.consistent, false);
      assert.equal(result.differential, false);
    });
  for (const [name, mutate] of [
    ["report", (report: Record<string, unknown>) => (report.extra = "must be rejected")],
    [
      "observation",
      (report: Record<string, unknown>) =>
        (((report.observations as Record<string, unknown>[])[0] as Record<string, unknown>).extra =
          "must be rejected"),
    ],
  ] as const)
    await t.test(name, () => {
      const altered = structuredClone(fixture);
      editJson(altered, "reports/pre-fix.json", mutate);
      editJson(altered, "run.json", (run) => {
        at(run.executions as { reportSha256: string }[], 0).reportSha256 = digest(
          altered.files["reports/pre-fix.json"] ?? "",
        );
      });
      const result = verifyDemoExport(makeExport(altered.files));
      assert.equal(result.integrity, true);
      assert.equal(result.consistent, false);
      assert.equal(result.differential, false);
    });
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
