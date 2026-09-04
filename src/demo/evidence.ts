import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
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
    const bundle = value as DemoExport;
    assert.equal(bundle.schemaVersion, 1);
    const artifacts = Object.entries(bundle.files).map(([path, contents]) => {
      assert.equal(typeof contents, "string");
      return { path, contents };
    });
    const check = verifyManifestEntries(bundle.manifest, artifacts);
    assert.ok(check.ok, "Manifest does not match exported files");
    integrity = true;
    const json = (name: string): unknown => {
      const contents = bundle.files[name];
      assert.equal(typeof contents, "string", `${name} is missing`);
      return JSON.parse(contents as string);
    };
    const run = json("run.json") as DemoRun;
    const attempts = (json("attempts.json") as unknown[]).map((entry) => parseAttemptRecord(entry));
    assert.equal(run.schemaVersion, 1);
    assert.equal(run.caseId, CASE.id);
    assert.equal(run.repeatEach, 20);
    assert.equal(run.modelCalls, 0);
    assert.match(run.id, /^[a-zA-Z0-9-]+$/u);
    assert.ok(
      run.finishedAt &&
        Number.isFinite(Date.parse(run.startedAt)) &&
        Date.parse(run.finishedAt) >= Date.parse(run.startedAt),
      "Run timing is invalid",
    );
    assert.ok(Number.isInteger(run.timeoutMs) && run.timeoutMs >= 1 && run.timeoutMs <= 1_500_000);
    assert.equal(digest(bundle.files["safe-unfollow-163.spec.ts"] ?? ""), CASE.specSha256);
    assert.equal(digest(bundle.files["playwright.config.ts"] ?? ""), CASE.configSha256);
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
      assert.ok(!sides.has(execution.side), "Duplicate revision execution");
      sides.add(execution.side);
      assert.equal(execution.revision, CASE.revisions[execution.side]);
      assert.equal(execution.lockSha256, CASE.lockSha256);
      assert.equal(execution.cleanBefore, true);
      assert.equal(typeof execution.cleanAfter, "boolean");
      assert.ok(execution.exitCode === null || Number.isSafeInteger(execution.exitCode));
      assert.ok(Array.isArray(execution.cleanup) && execution.cleanup.length <= 2);
      for (const cleanup of execution.cleanup) {
        assert.deepEqual(Object.keys(cleanup).sort(), ["observed", "survivors", "verified"]);
        assert.equal(typeof cleanup.verified, "boolean");
        assert.ok(Number.isSafeInteger(cleanup.observed) && cleanup.observed >= 0);
        assert.ok(Number.isSafeInteger(cleanup.survivors) && cleanup.survivors >= -1);
        if (cleanup.verified) assert.ok(cleanup.observed > 0 && cleanup.survivors === 0);
      }
      if (execution.reportSha256 !== null) {
        const path = `reports/${execution.side}.json`;
        required.add(path);
        assert.equal(
          digest(bundle.files[path] ?? ""),
          execution.reportSha256,
          "Report binding differs",
        );
        const report = json(path);
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
          serializeCanonicalJson((report as { suites: unknown }).suites),
          serializeCanonicalJson((projection as { suites: unknown }).suites),
        );
        if (run.status === "completed") {
          validateGeneratedDemoReport(report, execution.side);
          assert.match(execution.rawReportSha256 ?? "", /^[a-f0-9]{64}$/u);
          assert.equal(
            (report as { completion: { status: string } }).completion.status,
            execution.side === "pre-fix" ? "failed" : "passed",
          );
        }
      } else assert.equal(run.status === "completed", false, "Completed run is missing a report");
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
        assert.ok(
          Date.parse(execution.startedAt) >= Date.parse(run.startedAt) &&
            Date.parse(execution.finishedAt ?? "") <= Date.parse(run.finishedAt),
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
  const result = verifyDemoExport(
    JSON.parse(await readFile(resolve(process.argv[2] ?? ""), "utf8")),
  );
  console.log(JSON.stringify(result));
  process.exitCode = result.integrity && result.consistent ? 0 : 1;
}
