import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  type AttemptRecord,
  createAttemptRecord,
  createManifestEntries,
  type ManifestEntry,
  parseAttemptRecord,
  parsePlaywrightJsonReport,
  verifyManifestEntries,
  verifyRepetitionGate,
} from "../../spikes/local-functional-regression/tools/evidence.ts";
import { validateGeneratedDemoReport } from "../../spikes/local-functional-regression/tools/evidence-cli.ts";
import { serializeCanonicalJson } from "../evidence/canonical-json.ts";
import type { Cleanup } from "./process.ts";

export const CASE = {
  id: "safe-unfollow-163",
  repository: "https://github.com/ignromanov/safe-unfollow.git",
  revisions: {
    "pre-fix": "64c8a1d0f4c1a9a4ffbab2ea319d89bcab21ad47",
    "post-fix": "ab55329e354dfb121486d7ff1f7daa2fa2e2e5fa",
  },
  specSha256: "d750b422a2452e1fe299ee893f65e673831e4b51085d9e4a8590772c830280ad",
  configSha256: "ba18efccbebf686f9db870e8951e948cd99be8f0a74f22bc4963eb8f6f04e488",
  lockSha256: "5bae88ae4fbc179f7eb6486b49dcaa4eb35a32abb134a6bc006cb7150689f955",
  origin: "http://127.0.0.1:4173",
  repeat: 20,
} as const;
export type Side = keyof typeof CASE.revisions;
export type RunStatus =
  | "preparing"
  | "running"
  | "completed"
  | "cancelled"
  | "timeout"
  | "startup-error"
  | "execution-error"
  | "cleanup-error";
export type Observation = {
  attempt: number;
  workerIndex: number;
  at: string;
  id: string;
  title: string;
  file: string;
  result: { status: string; retry: number; duration: number; errors: { message: string }[] };
};
export type SideExecution = {
  side: Side;
  revision: string;
  cleanBefore: boolean;
  cleanAfter: boolean;
  lockSha256: string;
  exitCode: number | null;
  startedAt: string;
  finishedAt: string | null;
  reportSha256: string | null;
  rawReportSha256: string | null;
  cleanup: Cleanup[];
};
export type DemoRun = {
  schemaVersion: 1;
  id: string;
  caseId: string;
  startedAt: string;
  finishedAt: string | null;
  status: RunStatus;
  phase: string;
  diagnostic: string | null;
  repeatEach: 20;
  timeoutMs: number;
  executions: SideExecution[];
  sourceHashes: Record<string, string>;
  modelCalls: 0;
};
export type DemoExport = {
  schemaVersion: 1;
  files: Record<string, string>;
  manifest: readonly ManifestEntry[];
};
export type DemoVerification = {
  integrity: boolean;
  consistent: boolean;
  differential: boolean;
  issues: string[];
};
export const digest = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const sha256 = /^[a-f0-9]{64}$/u;

const record = (value: unknown, label: string): Record<string, unknown> => {
  assert.ok(
    value && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object`,
  );
  return value as Record<string, unknown>;
};

const exactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void => {
  assert.deepEqual(
    Object.keys(value).sort(),
    [...expected].sort(),
    `Unknown or missing ${label} fields`,
  );
};

type PortableCompletion = { finishedAt: string; status: string };
type PortableReportTiming = { completion: PortableCompletion | null; startedAt: string };

function validTimestamp(value: unknown, label: string): asserts value is string {
  assert.ok(
    typeof value === "string" && Number.isFinite(Date.parse(value)),
    `${label} must be an ISO timestamp`,
  );
}

function strictPortableReport(value: unknown): PortableReportTiming {
  const report = record(value, "Report");
  exactKeys(
    report,
    ["completion", "config", "errors", "observations", "rawReportSha256", "suites"],
    "report",
  );
  const config = record(report.config, "Report config");
  exactKeys(
    config,
    ["configFile", "projects", "repeatEach", "retries", "startedAt", "workers"],
    "report config",
  );
  assert.equal(
    config.configFile,
    "spikes/local-functional-regression/generated/playwright.config.ts",
  );
  assert.equal(config.workers, 1);
  assert.equal(config.repeatEach, CASE.repeat);
  assert.equal(config.retries, 0);
  validTimestamp(config.startedAt, "Report start time");
  assert.ok(
    Array.isArray(config.projects) && config.projects.length === 1,
    "Report must contain one project",
  );
  for (const item of config.projects) {
    const project = record(item, "Report project");
    exactKeys(project, ["name", "repeatEach", "retries"], "project");
    assert.equal(project.name, "");
    assert.equal(project.repeatEach, CASE.repeat);
    assert.equal(project.retries, 0);
  }
  let completion: PortableCompletion | null = null;
  if (report.completion !== null) {
    const rawCompletion = record(report.completion, "Report completion");
    exactKeys(rawCompletion, ["finishedAt", "status"], "completion");
    assert.ok(
      typeof rawCompletion.status === "string" &&
        ["passed", "failed", "timedout", "interrupted"].includes(rawCompletion.status),
      "Report completion status is invalid",
    );
    validTimestamp(rawCompletion.finishedAt, "Report completion time");
    assert.ok(
      Date.parse(rawCompletion.finishedAt) >= Date.parse(config.startedAt),
      "Report completion precedes its start",
    );
    completion = {
      finishedAt: rawCompletion.finishedAt,
      status: rawCompletion.status,
    };
  }
  assert.ok(Array.isArray(report.errors), "Report errors must be an array");
  for (const item of report.errors) {
    const error = record(item, "Report error");
    exactKeys(error, ["message"], "report error");
    assert.ok(
      typeof error.message === "string" && error.message.length <= 1_024,
      "Report error message is invalid",
    );
  }
  assert.ok(Array.isArray(report.observations), "Report observations must be an array");
  assert.ok(report.observations.length <= CASE.repeat);
  for (const item of report.observations) {
    const observation = record(item, "Report observation");
    exactKeys(
      observation,
      ["at", "attempt", "file", "id", "result", "title", "workerIndex"],
      "observation",
    );
    assert.ok(
      Number.isInteger(observation.attempt) &&
        Number(observation.attempt) >= 1 &&
        Number(observation.attempt) <= CASE.repeat,
      "Observation attempt is invalid",
    );
    assert.ok(
      Number.isInteger(observation.workerIndex) && Number(observation.workerIndex) >= -1,
      "Observation worker is invalid",
    );
    validTimestamp(observation.at, "Observation time");
    assert.ok(
      typeof observation.id === "string" &&
        observation.id.length >= 1 &&
        observation.id.length <= 256,
      "Observation id is invalid",
    );
    assert.equal(observation.file, "safe-unfollow-163.spec.ts");
    assert.equal(observation.title, "recovers the upload page after interrupted local analysis");
    const result = record(observation.result, "Observation result");
    exactKeys(result, ["duration", "errors", "retry", "status"], "observation result");
    assert.ok(
      ["passed", "failed", "timedOut", "skipped", "interrupted"].includes(String(result.status)),
      "Observation status is invalid",
    );
    assert.equal(result.retry, 0);
    assert.ok(
      typeof result.duration === "number" &&
        Number.isFinite(result.duration) &&
        result.duration >= 0,
      "Observation duration is invalid",
    );
    assert.ok(Array.isArray(result.errors), "Observation errors must be an array");
    assert.ok(result.errors.length <= 8);
    for (const item of result.errors) {
      const error = record(item, "Observation error");
      exactKeys(error, ["message"], "observation error");
      assert.ok(
        typeof error.message === "string" && error.message.length <= 1_024,
        "Observation error message is invalid",
      );
    }
  }
  assert.ok(Array.isArray(report.suites), "Report suites must be an array");
  for (const item of report.suites) {
    const suite = record(item, "Report suite");
    exactKeys(suite, ["specs", "title"], "suite");
    assert.ok(Array.isArray(suite.specs), "Suite specs must be an array");
    for (const item of suite.specs) {
      const spec = record(item, "Report spec");
      exactKeys(spec, ["file", "id", "tests", "title"], "spec");
      assert.ok(Array.isArray(spec.tests), "Spec tests must be an array");
      for (const item of spec.tests) {
        const test = record(item, "Report test");
        exactKeys(test, ["projectName", "results"], "test");
        assert.ok(Array.isArray(test.results), "Test results must be an array");
        for (const item of test.results) {
          const result = record(item, "Test result");
          exactKeys(result, ["duration", "errors", "retry", "status"], "test result");
          assert.ok(Array.isArray(result.errors), "Test result errors must be an array");
          for (const error of result.errors)
            exactKeys(record(error, "Test result error"), ["message"], "test result error");
        }
      }
    }
  }
  if (completion?.status === "passed" || completion?.status === "failed") {
    assert.equal(
      report.observations.length,
      CASE.repeat,
      "A completed report must contain every repetition",
    );
    const observations = report.observations as { result: { errors: unknown[]; status: string } }[];
    if (completion.status === "passed")
      assert.ok(
        observations.every(
          (observation) =>
            observation.result.status === "passed" && observation.result.errors.length === 0,
        ),
        "Passed completion contradicts its observations",
      );
    else
      assert.ok(
        observations.some((observation) => observation.result.status !== "passed"),
        "Failed completion contradicts its observations",
      );
  }
  return { completion, startedAt: config.startedAt };
}

/** Reporter observations are provisional until report, execution and cleanup gates agree. */
export function reportFromObservations(
  observations: Observation[],
  begin: unknown,
  end: unknown,
): unknown {
  return {
    config: {
      ...(begin as object),
      configFile: "spikes/local-functional-regression/generated/playwright.config.ts",
      projects: [
        {
          name: "",
          repeatEach: (begin as { repeatEach?: unknown }).repeatEach,
          retries: (begin as { retries?: unknown }).retries,
        },
      ],
    },
    errors:
      (end as { status?: unknown } | null)?.status === "failed" ||
      (end as { status?: unknown } | null)?.status === "passed"
        ? []
        : [{ message: "Run did not complete" }],
    completion: end,
    observations,
    suites: [
      {
        title: "safe-unfollow-163.spec.ts",
        specs: observations.map((entry) => ({
          id: entry.id,
          title: entry.title,
          file: entry.file,
          tests: [{ projectName: "", results: [entry.result] }],
        })),
      },
    ],
  };
}

export function attemptsFromReport(report: unknown, side: Side): AttemptRecord[] {
  const observations = (report as { observations: Observation[] }).observations;
  return parsePlaywrightJsonReport(report).flatMap((result, index) => {
    const observation = observations[index];
    if (!observation || observation.workerIndex < 0 || result.status === "skipped") return [];
    return [
      createAttemptRecord({
        attempt: observation.attempt,
        caseId: CASE.id,
        modelCalls: 0,
        result,
        revision: CASE.revisions[side],
        side,
        specSha256: CASE.specSha256,
      }),
    ];
  });
}

export function makeExport(files: Record<string, string>): DemoExport {
  return {
    schemaVersion: 1,
    files,
    manifest: createManifestEntries(
      Object.entries(files).map(([path, contents]) => ({ path, contents })),
    ),
  };
}

/** Check a portable new-run export; this is not the historical full-Spike/baseline gate. */
export function verifyDemoExport(value: unknown): DemoVerification {
  const issues: string[] = [];
  let integrity = false;
  let consistent = false;
  let differential = false;
  try {
    const rawBundle = record(value, "Demo export");
    exactKeys(rawBundle, ["schemaVersion", "files", "manifest"], "Demo export");
    const bundle = rawBundle as DemoExport;
    assert.equal(bundle.schemaVersion, 1);
    assert.ok(bundle.files && typeof bundle.files === "object" && !Array.isArray(bundle.files));
    assert.ok(Array.isArray(bundle.manifest) && bundle.manifest.length <= 6);
    for (const entry of bundle.manifest)
      exactKeys(record(entry, "Manifest entry"), ["bytes", "path", "sha256"], "manifest entry");
    const allowedFiles = new Set([
      "run.json",
      "attempts.json",
      "safe-unfollow-163.spec.ts",
      "playwright.config.ts",
      "reports/pre-fix.json",
      "reports/post-fix.json",
    ]);
    let totalBytes = 0;
    const artifacts = Object.entries(bundle.files).map(([path, contents]) => {
      assert.ok(allowedFiles.has(path), `Unexpected exported file: ${path}`);
      assert.equal(typeof contents, "string", `${path} must contain text`);
      const bytes = Buffer.byteLength(contents);
      assert.ok(bytes <= 4_194_304, `${path} exceeds 4 MiB`);
      totalBytes += bytes;
      return { path, contents };
    });
    assert.ok(artifacts.length <= 6 && totalBytes <= 8_388_608, "Demo export exceeds limits");
    const check = verifyManifestEntries(bundle.manifest, artifacts);
    assert.ok(check.ok, "Manifest does not match exported files");
    integrity = true;
    const json = (name: string): unknown => {
      const contents = bundle.files[name];
      assert.equal(typeof contents, "string", `${name} is missing`);
      return JSON.parse(contents as string);
    };
    const rawRun = record(json("run.json"), "Demo run");
    exactKeys(
      rawRun,
      [
        "schemaVersion",
        "id",
        "caseId",
        "startedAt",
        "finishedAt",
        "status",
        "phase",
        "diagnostic",
        "repeatEach",
        "timeoutMs",
        "executions",
        "sourceHashes",
        "modelCalls",
      ],
      "Demo run",
    );
    const run = rawRun as DemoRun;
    const attempts = (json("attempts.json") as unknown[]).map((entry) => parseAttemptRecord(entry));
    assert.equal(run.schemaVersion, 1);
    assert.equal(run.caseId, CASE.id);
    assert.equal(run.repeatEach, 20);
    assert.equal(run.modelCalls, 0);
    assert.equal(run.phase, "Finished; current evidence retained");
    if (run.status === "completed") assert.equal(run.diagnostic, null);
    else if (run.status === "cancelled")
      assert.equal(run.diagnostic, "Cancelled by the user; unexecuted repetitions are not counted");
    else if (run.status === "timeout")
      assert.equal(run.diagnostic, "Run deadline reached; incomplete observations are retained");
    else
      assert.ok(
        typeof run.diagnostic === "string" &&
          run.diagnostic.length >= 1 &&
          run.diagnostic.length <= 1_024 &&
          !/[\r\n]/u.test(run.diagnostic),
        "An incomplete run must have a bounded single-line diagnostic",
      );
    assert.match(run.id, /^[a-zA-Z0-9-]+$/u);
    const runStartedAt = run.startedAt;
    const runFinishedAt = run.finishedAt;
    validTimestamp(runStartedAt, "Run start time");
    validTimestamp(runFinishedAt, "Run finish time");
    assert.ok(Date.parse(runFinishedAt) >= Date.parse(runStartedAt), "Run timing is invalid");
    assert.ok(Number.isInteger(run.timeoutMs) && run.timeoutMs >= 1 && run.timeoutMs <= 1_500_000);
    if (run.status === "timeout")
      assert.ok(
        Date.parse(runFinishedAt) - Date.parse(runStartedAt) >= run.timeoutMs,
        "Timed-out run ended before its configured deadline",
      );
    assert.ok(Array.isArray(run.executions) && run.executions.length <= 2);
    assert.equal(digest(bundle.files["safe-unfollow-163.spec.ts"] ?? ""), CASE.specSha256);
    assert.equal(digest(bundle.files["playwright.config.ts"] ?? ""), CASE.configSha256);
    exactKeys(
      record(run.sourceHashes, "Demo source hashes"),
      [
        "generated/safe-unfollow-163.spec.ts",
        "generated/playwright.config.ts",
        "demo/run.ts",
        "demo/reporter.ts",
        "demo/evidence.ts",
        "demo/process.ts",
      ],
      "Demo source hashes",
    );
    assert.ok(
      Object.values(run.sourceHashes).every(
        (value) => typeof value === "string" && sha256.test(value),
      ),
      "Demo source hashes must be SHA-256 values",
    );
    assert.equal(run.sourceHashes["generated/safe-unfollow-163.spec.ts"], CASE.specSha256);
    assert.equal(run.sourceHashes["generated/playwright.config.ts"], CASE.configSha256);
    const required = new Set([
      "run.json",
      "attempts.json",
      "safe-unfollow-163.spec.ts",
      "playwright.config.ts",
    ]);
    const derived: AttemptRecord[] = [];
    const sides = new Set<Side>();
    let previousFinishedAt: string | null = null;
    for (const execution of run.executions) {
      assert.deepEqual(
        Object.keys(execution).sort(),
        [
          "side",
          "revision",
          "cleanBefore",
          "cleanAfter",
          "lockSha256",
          "exitCode",
          "startedAt",
          "finishedAt",
          "reportSha256",
          "rawReportSha256",
          "cleanup",
        ].sort(),
      );
      assert.ok(execution.side === "pre-fix" || execution.side === "post-fix");
      assert.equal(
        execution.side,
        sides.size === 0 ? "pre-fix" : "post-fix",
        "Executions must be an ordered prefix of the differential run",
      );
      assert.ok(!sides.has(execution.side), "Duplicate revision execution");
      sides.add(execution.side);
      assert.equal(execution.revision, CASE.revisions[execution.side]);
      assert.equal(execution.lockSha256, CASE.lockSha256);
      assert.equal(execution.cleanBefore, true);
      assert.equal(typeof execution.cleanAfter, "boolean");
      assert.ok(
        execution.exitCode === null ||
          (Number.isSafeInteger(execution.exitCode) && Number(execution.exitCode) >= 0),
      );
      assert.ok(
        typeof execution.startedAt === "string" && Number.isFinite(Date.parse(execution.startedAt)),
        "Execution start time is invalid",
      );
      assert.ok(
        execution.finishedAt === null ||
          (typeof execution.finishedAt === "string" &&
            Number.isFinite(Date.parse(execution.finishedAt)) &&
            Date.parse(execution.finishedAt) >= Date.parse(execution.startedAt)),
        "Execution finish time is invalid",
      );
      assert.ok(
        execution.reportSha256 === null ||
          (typeof execution.reportSha256 === "string" && sha256.test(execution.reportSha256)),
        "Report hash is invalid",
      );
      assert.ok(
        execution.rawReportSha256 === null ||
          (typeof execution.rawReportSha256 === "string" && sha256.test(execution.rawReportSha256)),
        "Raw report hash is invalid",
      );
      assert.ok(Array.isArray(execution.cleanup) && execution.cleanup.length <= 2);
      assert.ok(execution.cleanup.length >= 1, "Finalized execution is missing target cleanup");
      if (execution.reportSha256 !== null)
        assert.equal(
          execution.cleanup.length,
          2,
          "Browser evidence requires browser and target cleanup",
        );
      for (const cleanup of execution.cleanup) {
        assert.deepEqual(Object.keys(cleanup).sort(), ["observed", "survivors", "verified"]);
        assert.equal(typeof cleanup.verified, "boolean");
        assert.ok(Number.isSafeInteger(cleanup.observed) && cleanup.observed >= 0);
        assert.ok(Number.isSafeInteger(cleanup.survivors) && cleanup.survivors >= -1);
        if (cleanup.verified) assert.ok(cleanup.observed > 0 && cleanup.survivors === 0);
      }
      let reportTiming: PortableReportTiming | null = null;
      if (execution.reportSha256 !== null) {
        const path = `reports/${execution.side}.json`;
        required.add(path);
        assert.equal(
          digest(bundle.files[path] ?? ""),
          execution.reportSha256,
          "Report binding differs",
        );
        const report = json(path);
        reportTiming = strictPortableReport(report);
        assert.equal(
          (report as { rawReportSha256: unknown }).rawReportSha256,
          execution.rawReportSha256,
          "Portable report has a different raw report binding",
        );
        const observations = (report as { observations: Observation[] }).observations;
        assert.ok(Array.isArray(observations));
        const numbers = new Set<number>();
        for (const observation of observations) {
          assert.ok(
            Number.isInteger(observation.attempt) &&
              observation.attempt >= 1 &&
              observation.attempt <= 20 &&
              !numbers.has(observation.attempt),
          );
          numbers.add(observation.attempt);
          assert.ok(Number.isInteger(observation.workerIndex) && observation.workerIndex >= -1);
          assert.ok(
            Date.parse(observation.at) >= Date.parse(execution.startedAt) &&
              Date.parse(observation.at) <= Date.parse(execution.finishedAt ?? ""),
            "Observation outside execution window",
          );
        }
        derived.push(...attemptsFromReport(report, execution.side));
        // The stored projection must match the observations, not an independently editable success list.
        const projection = reportFromObservations(
          observations,
          (report as { config: unknown }).config,
          (report as { completion: unknown }).completion,
        );
        assert.equal(
          serializeCanonicalJson(report),
          serializeCanonicalJson({
            ...(projection as object),
            rawReportSha256: execution.rawReportSha256,
          }),
          "Portable report differs from its observation-derived projection",
        );
        assert.ok(
          Date.parse(reportTiming.startedAt) >= Date.parse(execution.startedAt) &&
            Date.parse(reportTiming.startedAt) <= Date.parse(execution.finishedAt ?? ""),
          "Report start falls outside the execution window",
        );
        if (reportTiming.completion !== null) {
          const completion = reportTiming.completion;
          assert.ok(
            Date.parse(completion.finishedAt) >= Date.parse(execution.startedAt) &&
              Date.parse(completion.finishedAt) <= Date.parse(execution.finishedAt ?? ""),
            "Report completion falls outside the execution window",
          );
          if (completion.status === "passed" || completion.status === "failed")
            assert.equal(
              execution.exitCode,
              completion.status === "passed" ? 0 : 1,
              "Execution exit contradicts report completion",
            );
          else if (run.status === "cancelled")
            assert.equal(
              execution.exitCode,
              130,
              "Interrupted cancelled execution must use the cancellation exit",
            );
          else if (run.status === "timeout")
            assert.equal(
              execution.exitCode,
              124,
              "Interrupted timed-out execution must use the timeout exit",
            );
          else
            assert.ok(
              execution.exitCode !== null && execution.exitCode !== 0,
              "Interrupted execution cannot report a successful exit",
            );
        }
        if (run.status === "completed") {
          validateGeneratedDemoReport(report, execution.side);
          assert.match(execution.rawReportSha256 ?? "", /^[a-f0-9]{64}$/u);
          assert.equal(
            (report as { completion: { status: string } }).completion.status,
            execution.side === "pre-fix" ? "failed" : "passed",
          );
        }
      } else assert.equal(run.status === "completed", false, "Completed run is missing a report");
      if (reportTiming?.completion == null && run.status === "cancelled")
        assert.ok(
          execution.exitCode === null || execution.exitCode === 130,
          "Incomplete cancelled execution must use the cancellation exit",
        );
      if (reportTiming?.completion == null && run.status === "timeout")
        assert.ok(
          execution.exitCode === null || execution.exitCode === 124,
          "Incomplete timed-out execution must use the timeout exit",
        );
      assert.ok(
        execution.finishedAt !== null &&
          Date.parse(execution.startedAt) >= Date.parse(runStartedAt) &&
          Date.parse(execution.finishedAt) <= Date.parse(runFinishedAt),
        "Execution falls outside the finalized run window",
      );
      if (previousFinishedAt !== null)
        assert.ok(
          Date.parse(execution.startedAt) >= Date.parse(previousFinishedAt),
          "Differential executions must not overlap",
        );
      previousFinishedAt = execution.finishedAt;
      if (run.status === "completed") {
        assert.equal(
          execution.exitCode,
          execution.side === "pre-fix" ? 1 : 0,
          "Execution exit contradicts expected outcome",
        );
        assert.equal(execution.cleanAfter, true);
        assert.equal(execution.cleanup.length, 2);
        for (const cleanup of execution.cleanup)
          assert.ok(
            cleanup.verified === true && cleanup.observed > 0 && cleanup.survivors === 0,
            "Cleanup is not verified",
          );
      }
    }
    assert.deepEqual(Object.keys(bundle.files).sort(), [...required].sort());
    assert.equal(
      serializeCanonicalJson(attempts),
      serializeCanonicalJson(derived),
      "Attempts differ from observed reporter outcomes",
    );
    assert.ok(
      [
        "completed",
        "cancelled",
        "timeout",
        "startup-error",
        "execution-error",
        "cleanup-error",
      ].includes(run.status),
      "Run is not finalized",
    );
    if (run.status === "startup-error")
      assert.ok(
        run.executions.length === 0 || run.executions.at(-1)?.reportSha256 === null,
        "Startup error contradicts completed browser evidence",
      );
    const hasUnverifiedCleanup = run.executions.some((execution) =>
      execution.cleanup.some((cleanup) => cleanup.verified !== true),
    );
    assert.equal(
      run.status === "cleanup-error",
      hasUnverifiedCleanup,
      "Final status contradicts cleanup observations",
    );
    consistent = true;
    if (run.status === "completed") {
      assert.equal(run.executions.length, 2);
      assert.deepEqual(
        run.executions.map((entry) => entry.side),
        ["pre-fix", "post-fix"],
      );
      const gate = verifyRepetitionGate(attempts, {
        expectedCaseId: CASE.id,
        preFixRevision: CASE.revisions["pre-fix"],
        postFixRevision: CASE.revisions["post-fix"],
        specSha256: CASE.specSha256,
      });
      assert.ok(gate.ok, "20+20 outcome gate did not pass");
      differential = true;
    }
  } catch (error) {
    issues.push(
      error instanceof Error
        ? (error.message.split("\n")[0] ?? "Invalid evidence")
        : "Invalid evidence",
    );
  }
  return { integrity, consistent: consistent && issues.length === 0, differential, issues };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 3) throw new Error("Usage: pnpm demo:verify path/to/export.json");
  const path = resolve(process.argv[2] ?? "");
  const input = await lstat(path);
  assert.ok(
    input.isFile() && !input.isSymbolicLink() && input.size <= 8_388_608,
    "Demo export must be a regular non-symlink file at most 8 MiB",
  );
  const bytes = await readFile(path);
  assert.ok(bytes.length <= 8_388_608, "Demo export changed or exceeds 8 MiB");
  const result = verifyDemoExport(JSON.parse(bytes.toString("utf8")));
  console.log(JSON.stringify(result));
  process.exitCode = result.integrity && result.consistent ? 0 : 1;
}
