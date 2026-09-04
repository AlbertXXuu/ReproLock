import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { serializeCanonicalJson } from "../evidence/canonical-json.ts";

export const hash = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");
export type Step = {
  id: number;
  parent: number | null;
  category: "expect" | "test.step" | "other";
  label: "reset" | "outcome" | "other";
  begin: number;
  end: number;
  error: string | null;
  line: number | null;
  column: number | null;
  comparison: { matcher: "toBe"; expected: string; received: string } | null;
};
export type Observation = {
  repetition: number;
  retry: number;
  expectedStatus: string;
  status: string;
  errors: string[];
  steps: Step[];
};
export type Report = {
  schemaVersion: 1;
  planned: number;
  status: string;
  errors: string[];
  observations: Observation[];
};
export type Verdict = "pass" | "functional-failure" | "inconclusive";
const sha = /^[a-f0-9]{64}$/u;
const record = (value: unknown): Record<string, unknown> => {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "Expected an object");
  return value as Record<string, unknown>;
};
const integer = (value: unknown, min: number, max: number): void => {
  assert.ok(
    Number.isInteger(value) && Number(value) >= min && Number(value) <= max,
    "Invalid integer",
  );
};
const hashes = (value: unknown): void => {
  assert.ok(
    Array.isArray(value) &&
      value.length <= 200 &&
      value.every((v) => typeof v === "string" && sha.test(v)),
    "Invalid error hashes",
  );
};

/** Validate untrusted persisted observations before deriving any outcome. */
export function parseReport(value: unknown): Report {
  const r = record(value);
  assert.equal(r.schemaVersion, 1);
  integer(r.planned, 0, 20);
  assert.ok(["passed", "failed", "timedout", "interrupted"].includes(String(r.status)));
  hashes(r.errors);
  assert.ok(Array.isArray(r.observations) && r.observations.length <= 20);
  for (const item of r.observations) {
    const o = record(item);
    integer(o.repetition, 0, 19);
    integer(o.retry, 0, 20);
    assert.ok(
      ["passed", "failed", "timedOut", "skipped", "interrupted"].includes(String(o.status)),
    );
    assert.ok(["passed", "failed", "skipped"].includes(String(o.expectedStatus)));
    hashes(o.errors);
    assert.ok(Array.isArray(o.steps) && o.steps.length <= 200);
    const ids = new Set<number>();
    const events = new Set<number>();
    for (const item of o.steps) {
      const s = record(item);
      integer(s.id, 0, 199);
      integer(s.begin, 0, 399);
      integer(s.end, -1, 399);
      assert.ok(!ids.has(Number(s.id)));
      ids.add(Number(s.id));
      assert.ok(!events.has(Number(s.begin)));
      events.add(Number(s.begin));
      if (s.end !== -1) {
        assert.ok(Number(s.end) > Number(s.begin) && !events.has(Number(s.end)));
        events.add(Number(s.end));
      }
      if (s.parent !== null) {
        integer(s.parent, 0, 199);
        assert.ok(Number(s.parent) < Number(s.id));
      }
      assert.ok(["expect", "test.step", "other"].includes(String(s.category)));
      assert.ok(["reset", "outcome", "other"].includes(String(s.label)));
      assert.ok(s.error === null || (typeof s.error === "string" && sha.test(s.error)));
      if (s.line !== null) integer(s.line, 1, 100_000);
      if (s.column !== null) integer(s.column, 1, 100_000);
      assert.equal(s.line === null, s.column === null);
      if (s.comparison !== null) {
        const comparison = record(s.comparison);
        assert.equal(comparison.matcher, "toBe");
        hashes([comparison.expected, comparison.received]);
        assert.ok(s.category === "expect" && s.error !== null);
      }
    }
    for (const item of o.steps) {
      const s = item as Step;
      if (s.parent !== null) {
        const parent = (o.steps as Step[]).find((p) => p.id === s.parent);
        assert.ok(
          parent &&
            parent.begin < s.begin &&
            (parent.end === -1 || (s.end !== -1 && parent.end > s.end)),
        );
      }
    }
  }
  return value as Report;
}

/** Only observed native assertion differences after a verified reset can be business failures. */
export function classify(o: Observation): Verdict {
  if (
    o.retry !== 0 ||
    o.expectedStatus !== "passed" ||
    !["passed", "failed"].includes(o.status) ||
    o.steps.some((s) => s.end < 0)
  )
    return "inconclusive";
  const resets = o.steps.filter((s) => s.category === "test.step" && s.label === "reset");
  const outcomes = o.steps.filter((s) => s.category === "test.step" && s.label === "outcome");
  const reset = resets[0],
    outcome = outcomes[0];
  if (
    resets.length !== 1 ||
    outcomes.length !== 1 ||
    !reset ||
    !outcome ||
    reset.parent !== null ||
    outcome.parent !== null ||
    reset.error ||
    reset.end >= outcome.begin
  )
    return "inconclusive";
  const inside = (s: Step, parent: Step): boolean => {
    let id = s.parent;
    while (id !== null) {
      if (id === parent.id) return true;
      id = o.steps.find((p) => p.id === id)?.parent ?? null;
    }
    return false;
  };
  const resetChecks = o.steps.filter((s) => s.category === "expect" && inside(s, reset));
  const checks = o.steps.filter((s) => s.category === "expect" && inside(s, outcome));
  if (
    !resetChecks.length ||
    resetChecks.some((s) => s.error) ||
    checks.length !== 1 ||
    checks[0]?.line === null
  )
    return "inconclusive";
  const failed = checks.filter((s) => s.error);
  if (o.status === "passed" && !o.errors.length && !o.steps.some((s) => s.error)) return "pass";
  const failure = failed[0];
  if (
    o.status !== "failed" ||
    failed.length !== 1 ||
    !failure?.comparison ||
    failure.comparison.expected === failure.comparison.received ||
    o.errors.length !== 1 ||
    o.errors[0] !== failure.error ||
    outcome.error !== failure.error
  )
    return "inconclusive";
  // Any unrelated hook/API/fixture error prevents a business classification, even if a marker matches.
  if (
    o.steps.some(
      (s) =>
        s.error &&
        (s.error !== failure.error ||
          (s.id !== failure.id && s.id !== outcome.id && !inside(failure, s))),
    )
  )
    return "inconclusive";
  return "functional-failure";
}

export type Execution = {
  revision: string;
  cleanBefore: boolean;
  cleanAfter: boolean;
  exitCode: number | null;
  cleanup: boolean;
  report: Report | null;
  reportSha256: string | null;
  fingerprintBefore: string;
  fingerprintAfter: string | null;
  configurationSha256: string;
};
export type Bundle = {
  schemaVersion: 1;
  candidate: string;
  candidateSha256: string;
  repetitions: number;
  status: "completed" | "cancelled" | "timeout" | "error";
  revisions: [string, string];
  fingerprints: string[];
  sourceHashes: Record<string, string>;
  settings: {
    origin: string;
    readyPath: string;
    startScript: string;
    startArgsSha256: string;
    timeoutMs: number;
    testTimeoutMs: number;
    resetDescriptionSha256: string;
  };
  executions: Execution[];
};
export function configurationDigest(
  bundle: Pick<Bundle, "settings" | "sourceHashes" | "repetitions">,
): string {
  return hash(
    serializeCanonicalJson({
      settings: bundle.settings,
      sourceHashes: bundle.sourceHashes,
      repetitions: bundle.repetitions,
    }),
  );
}

/** This gate is recomputed; no stored success flag or process exit code alone is authoritative. */
export function verifyBundle(value: unknown): {
  differential: boolean;
  outcomes: Verdict[][];
  issues: string[];
} {
  try {
    const b = record(value);
    assert.equal(b.schemaVersion, 1);
    assert.ok(typeof b.candidate === "string" && Buffer.byteLength(b.candidate) <= 131_072);
    assert.equal(b.candidateSha256, hash(b.candidate));
    integer(b.repetitions, 1, 20);
    assert.ok(["completed", "cancelled", "timeout", "error"].includes(String(b.status)));
    assert.ok(Array.isArray(b.executions) && b.executions.length <= 2);
    assert.ok(
      Array.isArray(b.revisions) &&
        b.revisions.length === 2 &&
        b.revisions.every((r) => typeof r === "string" && /^[a-f0-9]{40}$/u.test(r)) &&
        b.revisions[0] !== b.revisions[1],
    );
    hashes(b.fingerprints);
    const sources = record(b.sourceHashes);
    for (const name of ["candidate", "guard", "cli", "reporter", "evidence", "process"])
      assert.ok(typeof sources[name] === "string" && sha.test(sources[name]));
    assert.equal(sources.candidate, b.candidateSha256);
    const settings = record(b.settings);
    assert.ok(
      typeof settings.origin === "string" && /^http:\/\/127\.0\.0\.1:\d+$/u.test(settings.origin),
    );
    assert.ok(
      typeof settings.readyPath === "string" &&
        new URL(settings.readyPath, settings.origin).origin === settings.origin,
    );
    assert.ok(typeof settings.startScript === "string");
    hashes([settings.startArgsSha256, settings.resetDescriptionSha256]);
    integer(settings.timeoutMs, 1, 1_500_000);
    integer(settings.testTimeoutMs, 1, 60_000);
    const outcomes: Verdict[][] = [];
    let eligible = b.status === "completed" && b.executions.length === 2;
    const revisions: string[] = [];
    for (const item of b.executions) {
      const e = record(item);
      assert.ok(typeof e.revision === "string" && /^[a-f0-9]{40}$/u.test(e.revision));
      revisions.push(e.revision);
      for (const key of ["cleanBefore", "cleanAfter", "cleanup"])
        assert.equal(typeof e[key], "boolean");
      assert.ok(e.exitCode === null || (Number.isInteger(e.exitCode) && Number(e.exitCode) >= 0));
      assert.equal(e.revision, b.revisions[outcomes.length]);
      hashes([e.fingerprintBefore, e.configurationSha256]);
      assert.equal(e.configurationSha256, configurationDigest(value as Bundle));
      assert.equal(e.fingerprintBefore, (b.fingerprints as string[])[outcomes.length]);
      if (e.fingerprintAfter !== null) hashes([e.fingerprintAfter]);
      if (!e.report) {
        assert.equal(e.reportSha256, null);
        eligible = false;
        outcomes.push([]);
        continue;
      }
      const report = parseReport(e.report);
      assert.equal(e.reportSha256, hash(serializeCanonicalJson(report)));
      const observations = [...report.observations].sort((a, b) => a.repetition - b.repetition);
      const verdicts = observations.map(classify);
      outcomes.push(verdicts);
      const expected = outcomes.length === 1 ? "functional-failure" : "pass";
      eligible &&=
        e.cleanBefore === true &&
        e.cleanAfter === true &&
        e.cleanup === true &&
        e.exitCode === (expected === "pass" ? 0 : 1) &&
        e.fingerprintAfter === e.fingerprintBefore &&
        report.status === (expected === "pass" ? "passed" : "failed") &&
        report.errors.length === 0 &&
        report.planned === b.repetitions &&
        observations.length === b.repetitions &&
        observations.every((o, i) => o.repetition === i && verdicts[i] === expected);
    }
    eligible &&= revisions[0] !== revisions[1];
    const observed = (b.executions as Execution[]).flatMap((e) => e.report?.observations ?? []);
    const callsites = observed
      .flatMap((o) =>
        o.steps.filter(
          (s) =>
            s.category === "expect" &&
            s.line !== null &&
            o.steps.some((p) => p.id === s.parent && p.label === "outcome"),
        ),
      )
      .map((s) => `${s.line}:${s.column}`);
    eligible &&= callsites.length === Number(b.repetitions) * 2 && new Set(callsites).size === 1;
    return {
      differential: eligible,
      outcomes,
      issues: eligible
        ? []
        : [
            "Complete clean pre-fix assertion failures and post-fix passes with verified cleanup are required",
          ],
    };
  } catch {
    return {
      differential: false,
      outcomes: [],
      issues: ["Evidence schema, trace or hash validation failed"],
    };
  }
}
