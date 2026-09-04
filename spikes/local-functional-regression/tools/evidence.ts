import { createHash } from "node:crypto";

import { serializeCanonicalJson } from "../../../src/evidence/canonical-json.ts";

export const attemptClassifications = [
  "pass",
  "functional-failure",
  "target-startup-error",
  "reset-error",
  "inconclusive",
  "browser-runtime-error",
] as const;

export type AttemptClassification = (typeof attemptClassifications)[number];

export const playwrightResultStatuses = [
  "passed",
  "failed",
  "timedOut",
  "skipped",
  "interrupted",
] as const;

export type PlaywrightResultStatus = (typeof playwrightResultStatuses)[number];

export type RevisionSide = "pre-fix" | "post-fix";

export type ParsedPlaywrightTestResult = {
  readonly classification: AttemptClassification;
  readonly durationMs: number;
  /** Raw reporter messages for in-memory validation only; never copy these into attempt records. */
  readonly errorMessages: readonly string[];
  readonly file: string | null;
  readonly firstFailedCheckpoint: string | null;
  readonly projectName: string;
  readonly resultIndex: number;
  readonly specId: string;
  readonly retry: number;
  readonly status: PlaywrightResultStatus;
  readonly title: string;
  readonly titlePath: readonly string[];
};

export type AttemptRecord = {
  readonly attempt: number;
  readonly caseId: string;
  readonly classification: AttemptClassification;
  readonly firstFailedCheckpoint: string | null;
  readonly modelCalls: number;
  readonly playwrightStatus: PlaywrightResultStatus;
  readonly retry: number;
  readonly revision: string;
  readonly schemaVersion: 1;
  readonly side: RevisionSide;
  readonly specSha256: string;
};

export type ManifestArtifact = {
  readonly contents: string | Uint8Array;
  readonly path: string;
};

export type ManifestEntry = {
  readonly bytes: number;
  readonly path: string;
  readonly sha256: string;
};

export type EvidenceIssueCode =
  | "attempt-count"
  | "attempt-number"
  | "case-id"
  | "checkpoint"
  | "classification"
  | "duplicate-path"
  | "invalid-attempt"
  | "invalid-path"
  | "manifest-bytes"
  | "manifest-missing-entry"
  | "manifest-order"
  | "manifest-sha256"
  | "manifest-unexpected-entry"
  | "model-calls"
  | "retry"
  | "revision"
  | "spec-hash";

export type EvidenceIssue = {
  readonly code: EvidenceIssueCode;
  readonly message: string;
  readonly subject: string;
};

export type EvidenceVerification = {
  readonly issues: readonly EvidenceIssue[];
  readonly ok: boolean;
};

type JsonObject = { readonly [key: string]: unknown };
type CheckpointTag = {
  readonly category: "functional" | "reset" | "setup" | "target-startup";
  readonly id: string;
};

/** Raised when a JSON report or evidence record does not conform to its expected shape. */
export class EvidenceValidationError extends Error {
  override readonly name = "EvidenceValidationError";
}

const checkpointPattern =
  /\[(functional|reset|setup|target-startup)-checkpoint:([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\]/u;
const checkpointIdPattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u;
const identifierPattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u;
const gitObjectIdPattern = /^[a-f0-9]{40}$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const windowsReservedName =
  /^(?:con|prn|aux|nul|clock\$|conin\$|conout\$|com[1-9\u00b9\u00b2\u00b3]|lpt[1-9\u00b9\u00b2\u00b3])(?:\.|$)/iu;
const windowsInvalidCharacter = /["<>|?*]/u;

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function fail(path: string, message: string): never {
  throw new EvidenceValidationError(`${path}: ${message}`);
}

function asObject(value: unknown, path: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return fail(path, "expected an object");
  }
  return value as JsonObject;
}

function asArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) return fail(path, "expected an array");
  return value;
}

function optionalArray(object: JsonObject, key: string, path: string): readonly unknown[] {
  const value = object[key];
  if (value === undefined) return [];
  return asArray(value, `${path}.${key}`);
}

function requiredArray(object: JsonObject, key: string, path: string): readonly unknown[] {
  return asArray(object[key], `${path}.${key}`);
}

function asString(value: unknown, path: string): string {
  if (typeof value !== "string") return fail(path, "expected a string");
  return value;
}

function optionalString(object: JsonObject, key: string, path: string, fallback: string): string {
  const value = object[key];
  if (value === undefined || value === null) return fallback;
  return asString(value, `${path}.${key}`);
}

function asNonNegativeInteger(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return fail(path, "expected a non-negative safe integer");
  }
  return value as number;
}

function optionalNonNegativeInteger(
  object: JsonObject,
  key: string,
  path: string,
  fallback: number,
): number {
  const value = object[key];
  if (value === undefined) return fallback;
  return asNonNegativeInteger(value, `${path}.${key}`);
}

function asPlaywrightStatus(value: unknown, path: string): PlaywrightResultStatus {
  if (
    typeof value !== "string" ||
    !playwrightResultStatuses.includes(value as PlaywrightResultStatus)
  ) {
    return fail(path, `expected one of ${playwrightResultStatuses.join(", ")}`);
  }
  return value as PlaywrightResultStatus;
}

function messageFromError(value: unknown, path: string): string | null {
  if (typeof value === "string") return value;
  const error = asObject(value, path);
  const message = error.message;
  if (message === undefined || message === null) return fail(path, "error must contain a message");
  return asString(message, `${path}.message`);
}

function collectErrorMessages(result: JsonObject, path: string): readonly string[] {
  const messages: string[] = [];
  const primaryError = result.error;
  if (primaryError !== undefined && primaryError !== null) {
    const message = messageFromError(primaryError, `${path}.error`);
    if (message !== null) messages.push(message);
  }

  for (const [index, error] of optionalArray(result, "errors", path).entries()) {
    const message = messageFromError(error, `${path}.errors[${index}]`);
    if (message !== null && !messages.includes(message)) messages.push(message);
  }
  return messages;
}

function findCheckpoint(messages: readonly string[]): CheckpointTag | null {
  for (const message of messages) {
    const match = checkpointPattern.exec(message);
    if (match === null) continue;
    const category = match[1];
    const id = match[2];
    if (
      (category === "functional" ||
        category === "reset" ||
        category === "setup" ||
        category === "target-startup") &&
      id !== undefined
    ) {
      return { category, id };
    }
  }
  return null;
}

function classifyResult(
  status: PlaywrightResultStatus,
  checkpoint: CheckpointTag | null,
): AttemptClassification {
  if (status === "passed") return "pass";
  if (status === "skipped") return "inconclusive";
  if (status === "failed" && checkpoint?.category === "functional") {
    return "functional-failure";
  }
  if (checkpoint?.category === "target-startup") return "target-startup-error";
  if (checkpoint?.category === "reset") return "reset-error";
  if (checkpoint?.category === "setup") return "inconclusive";
  return "browser-runtime-error";
}

function parseResult(options: {
  readonly specId: string;
  readonly file: string | null;
  readonly path: string;
  readonly projectName: string;
  readonly resultIndex: number;
  readonly title: string;
  readonly titlePath: readonly string[];
  readonly value: unknown;
}): ParsedPlaywrightTestResult {
  const result = asObject(options.value, options.path);
  const status = asPlaywrightStatus(result.status, `${options.path}.status`);
  const errorMessages = collectErrorMessages(result, options.path);
  const checkpoint = findCheckpoint(errorMessages);

  return {
    classification: classifyResult(status, checkpoint),
    durationMs: optionalNonNegativeInteger(result, "duration", options.path, 0),
    errorMessages,
    file: options.file,
    firstFailedCheckpoint:
      status === "passed" || (checkpoint?.category === "functional" && status !== "failed")
        ? null
        : (checkpoint?.id ?? null),
    projectName: options.projectName,
    resultIndex: options.resultIndex,
    specId: options.specId,
    retry: asNonNegativeInteger(result.retry, `${options.path}.retry`),
    status,
    title: options.title,
    titlePath: [...options.titlePath],
  };
}

function parseSpec(
  value: unknown,
  path: string,
  suiteTitles: readonly string[],
  output: ParsedPlaywrightTestResult[],
): void {
  const spec = asObject(value, path);
  const title = asString(spec.title, `${path}.title`);
  const fileValue = spec.file;
  const file =
    fileValue === undefined || fileValue === null ? null : asString(fileValue, `${path}.file`);
  const titlePath = [...suiteTitles, title];

  for (const [testIndex, testValue] of requiredArray(spec, "tests", path).entries()) {
    const testPath = `${path}.tests[${testIndex}]`;
    const test = asObject(testValue, testPath);
    const projectName = optionalString(test, "projectName", testPath, "");
    for (const [resultIndex, result] of requiredArray(test, "results", testPath).entries()) {
      output.push(
        parseResult({
          file,
          path: `${testPath}.results[${resultIndex}]`,
          projectName,
          resultIndex,
          specId: optionalString(spec, "id", path, ""),
          title,
          titlePath,
          value: result,
        }),
      );
    }
  }
}

function parseSuite(
  value: unknown,
  path: string,
  parentTitles: readonly string[],
  output: ParsedPlaywrightTestResult[],
): void {
  const suite = asObject(value, path);
  const title = optionalString(suite, "title", path, "");
  const suiteTitles = title.length === 0 ? parentTitles : [...parentTitles, title];

  for (const [specIndex, spec] of optionalArray(suite, "specs", path).entries()) {
    parseSpec(spec, `${path}.specs[${specIndex}]`, suiteTitles, output);
  }
  for (const [suiteIndex, child] of optionalArray(suite, "suites", path).entries()) {
    parseSuite(child, `${path}.suites[${suiteIndex}]`, suiteTitles, output);
  }
}

/**
 * Parse every Playwright JSON reporter result without trusting object prototypes, accessors, or
 * lossy JSON values. Only assertion messages are inspected for frozen checkpoint tags.
 */
export function parsePlaywrightJsonReport(report: unknown): readonly ParsedPlaywrightTestResult[] {
  try {
    // This rejects accessors, custom prototypes, cycles, sparse arrays, symbols, and non-JSON
    // primitives before the report is traversed.
    serializeCanonicalJson(report);
    const root = asObject(report, "report");
    const output: ParsedPlaywrightTestResult[] = [];
    for (const [suiteIndex, suite] of requiredArray(root, "suites", "report").entries()) {
      parseSuite(suite, `report.suites[${suiteIndex}]`, [], output);
    }
    return output;
  } catch (error) {
    if (error instanceof EvidenceValidationError) throw error;
    throw new EvidenceValidationError("report: unsafe or non-JSON input", { cause: error });
  }
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x1f || codeUnit === 0x7f) return true;
  }
  return false;
}

/** Assert that a manifest path is a portable, forward-slash relative file path. */
export function assertPortableRelativePath(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value.includes(":") ||
    windowsInvalidCharacter.test(value) ||
    hasControlCharacter(value)
  ) {
    throw new EvidenceValidationError("Evidence path must be a portable relative file path");
  }

  for (const segment of value.split("/")) {
    if (
      segment.length === 0 ||
      segment === "." ||
      segment === ".." ||
      /[. ]$/u.test(segment) ||
      windowsReservedName.test(segment)
    ) {
      throw new EvidenceValidationError("Evidence path contains a non-portable component");
    }
  }
}

function artifactBytes(contents: string | Uint8Array): Uint8Array {
  if (typeof contents === "string") return Buffer.from(contents, "utf8");
  if (contents instanceof Uint8Array) return contents;
  throw new EvidenceValidationError("Manifest artifact contents must be text or bytes");
}

/** Compute one data-minimized manifest entry from the exact artifact bytes. */
export function createManifestEntry(artifact: ManifestArtifact): ManifestEntry {
  assertPortableRelativePath(artifact.path);
  const bytes = artifactBytes(artifact.contents);
  return {
    bytes: bytes.byteLength,
    path: artifact.path,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

/** Compute manifest entries with unique paths and locale-independent path ordering. */
export function createManifestEntries(
  artifacts: readonly ManifestArtifact[],
): readonly ManifestEntry[] {
  const paths = new Set<string>();
  const entries = artifacts.map((artifact) => {
    const entry = createManifestEntry(artifact);
    if (paths.has(entry.path)) {
      throw new EvidenceValidationError(`Duplicate manifest artifact path: ${entry.path}`);
    }
    paths.add(entry.path);
    return entry;
  });
  return entries.sort((left, right) => compareText(left.path, right.path));
}

function issue(code: EvidenceIssueCode, subject: string, message: string): EvidenceIssue {
  return { code, message, subject };
}

/** Verify path portability, ordering, exact byte counts, and SHA-256 values for a manifest. */
export function verifyManifestEntries(
  entries: readonly ManifestEntry[],
  artifacts: readonly ManifestArtifact[],
): EvidenceVerification {
  const issues: EvidenceIssue[] = [];
  const expected = new Map<string, ManifestEntry>();

  for (const [index, artifact] of artifacts.entries()) {
    try {
      const entry = createManifestEntry(artifact);
      if (expected.has(entry.path)) {
        issues.push(issue("duplicate-path", entry.path, "Artifact path is duplicated"));
      } else {
        expected.set(entry.path, entry);
      }
    } catch (error) {
      issues.push(
        issue(
          "invalid-path",
          `artifacts[${index}]`,
          error instanceof Error ? error.message : "Artifact path is invalid",
        ),
      );
    }
  }

  const seenEntries = new Set<string>();
  let previousPath: string | null = null;
  for (const [index, entry] of entries.entries()) {
    const subject = `entries[${index}]`;
    try {
      assertPortableRelativePath(entry.path);
    } catch (error) {
      issues.push(
        issue(
          "invalid-path",
          subject,
          error instanceof Error ? error.message : "Manifest path is invalid",
        ),
      );
      continue;
    }
    if (seenEntries.has(entry.path)) {
      issues.push(issue("duplicate-path", entry.path, "Manifest path is duplicated"));
      continue;
    }
    seenEntries.add(entry.path);

    if (previousPath !== null && compareText(previousPath, entry.path) >= 0) {
      issues.push(
        issue("manifest-order", entry.path, "Manifest entries are not strictly path-sorted"),
      );
    }
    previousPath = entry.path;

    const wanted = expected.get(entry.path);
    const hasValidBytes = Number.isSafeInteger(entry.bytes) && entry.bytes >= 0;
    if (!hasValidBytes) {
      issues.push(
        issue("manifest-bytes", entry.path, "Manifest byte count is not a non-negative integer"),
      );
    }
    const hasValidSha256 = sha256Pattern.test(entry.sha256);
    if (!hasValidSha256) {
      issues.push(
        issue("manifest-sha256", entry.path, "Manifest SHA-256 is not a lowercase digest"),
      );
    }
    if (wanted === undefined) {
      issues.push(
        issue("manifest-unexpected-entry", entry.path, "Manifest entry has no supplied artifact"),
      );
      continue;
    }
    if (hasValidBytes && entry.bytes !== wanted.bytes) {
      issues.push(
        issue(
          "manifest-bytes",
          entry.path,
          `Expected ${wanted.bytes} bytes but manifest records ${entry.bytes}`,
        ),
      );
    }
    if (hasValidSha256 && entry.sha256 !== wanted.sha256) {
      issues.push(
        issue("manifest-sha256", entry.path, "Manifest SHA-256 does not match artifact bytes"),
      );
    }
  }

  for (const path of [...expected.keys()].sort(compareText)) {
    if (!seenEntries.has(path)) {
      issues.push(issue("manifest-missing-entry", path, "Artifact is absent from the manifest"));
    }
  }

  return { issues, ok: issues.length === 0 };
}

function assertExactKeys(object: JsonObject, expected: readonly string[], path: string): void {
  const actual = Object.keys(object).sort(compareText);
  const wanted = [...expected].sort(compareText);
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail(path, `expected exactly these fields: ${wanted.join(", ")}`);
  }
}

function asPositiveInteger(value: unknown, path: string): number {
  const parsed = asNonNegativeInteger(value, path);
  if (parsed === 0) return fail(path, "expected a positive safe integer");
  return parsed;
}

function asClassification(value: unknown, path: string): AttemptClassification {
  if (
    typeof value !== "string" ||
    !attemptClassifications.includes(value as AttemptClassification)
  ) {
    return fail(path, `expected one of ${attemptClassifications.join(", ")}`);
  }
  return value as AttemptClassification;
}

function asRevisionSide(value: unknown, path: string): RevisionSide {
  if (value !== "pre-fix" && value !== "post-fix") {
    return fail(path, "expected pre-fix or post-fix");
  }
  return value;
}

/** Parse and normalize one schema-v1 canonical attempt record. */
export function parseAttemptRecord(value: unknown, path = "attempt"): AttemptRecord {
  try {
    serializeCanonicalJson(value);
    const record = asObject(value, path);
    assertExactKeys(
      record,
      [
        "attempt",
        "caseId",
        "classification",
        "firstFailedCheckpoint",
        "modelCalls",
        "playwrightStatus",
        "retry",
        "revision",
        "schemaVersion",
        "side",
        "specSha256",
      ],
      path,
    );

    if (record.schemaVersion !== 1) fail(`${path}.schemaVersion`, "expected 1");
    const caseId = asString(record.caseId, `${path}.caseId`);
    if (!identifierPattern.test(caseId)) fail(`${path}.caseId`, "expected a stable identifier");
    const revision = asString(record.revision, `${path}.revision`);
    if (!gitObjectIdPattern.test(revision)) {
      fail(`${path}.revision`, "expected a lowercase full Git object ID");
    }
    const specSha256 = asString(record.specSha256, `${path}.specSha256`);
    if (!sha256Pattern.test(specSha256)) {
      fail(`${path}.specSha256`, "expected a lowercase SHA-256 digest");
    }
    const firstFailedCheckpointValue = record.firstFailedCheckpoint;
    const firstFailedCheckpoint =
      firstFailedCheckpointValue === null
        ? null
        : asString(firstFailedCheckpointValue, `${path}.firstFailedCheckpoint`);
    if (firstFailedCheckpoint !== null && !checkpointIdPattern.test(firstFailedCheckpoint)) {
      fail(`${path}.firstFailedCheckpoint`, "expected a stable checkpoint identifier");
    }
    const classification = asClassification(record.classification, `${path}.classification`);
    const playwrightStatus = asPlaywrightStatus(
      record.playwrightStatus,
      `${path}.playwrightStatus`,
    );
    if ((playwrightStatus === "passed") !== (classification === "pass")) {
      fail(path, "pass classification and passed Playwright status must agree");
    }
    if (classification === "pass" && firstFailedCheckpoint !== null) {
      fail(`${path}.firstFailedCheckpoint`, "passing attempts cannot have a failed checkpoint");
    }
    if (
      (classification === "functional-failure" || classification === "reset-error") &&
      firstFailedCheckpoint === null
    ) {
      fail(`${path}.firstFailedCheckpoint`, `${classification} requires a checkpoint`);
    }
    if (playwrightStatus === "skipped" && classification !== "inconclusive") {
      fail(path, "skipped Playwright results must be inconclusive");
    }
    if (classification === "functional-failure" && playwrightStatus !== "failed") {
      fail(path, "functional failures require Playwright failed status");
    }

    return {
      attempt: asPositiveInteger(record.attempt, `${path}.attempt`),
      caseId,
      classification,
      firstFailedCheckpoint,
      modelCalls: asNonNegativeInteger(record.modelCalls, `${path}.modelCalls`),
      playwrightStatus,
      retry: asNonNegativeInteger(record.retry, `${path}.retry`),
      revision,
      schemaVersion: 1,
      side: asRevisionSide(record.side, `${path}.side`),
      specSha256,
    };
  } catch (error) {
    if (error instanceof EvidenceValidationError) throw error;
    throw new EvidenceValidationError(`${path}: unsafe or non-JSON input`, { cause: error });
  }
}

/** Build an attempt record from one parsed Playwright result and immutable run metadata. */
export function createAttemptRecord(options: {
  readonly attempt: number;
  readonly caseId: string;
  readonly modelCalls: number;
  readonly result: ParsedPlaywrightTestResult;
  readonly revision: string;
  readonly side: RevisionSide;
  readonly specSha256: string;
}): AttemptRecord {
  return parseAttemptRecord({
    attempt: options.attempt,
    caseId: options.caseId,
    classification: options.result.classification,
    firstFailedCheckpoint: options.result.firstFailedCheckpoint,
    modelCalls: options.modelCalls,
    playwrightStatus: options.result.status,
    retry: options.result.retry,
    revision: options.revision,
    schemaVersion: 1,
    side: options.side,
    specSha256: options.specSha256,
  });
}

function sideOrder(side: RevisionSide): number {
  return side === "pre-fix" ? 0 : 1;
}

/** Normalize, validate, deduplicate, and stably order attempt records. */
export function canonicalizeAttemptRecords(
  records: readonly AttemptRecord[],
): readonly AttemptRecord[] {
  const normalized = records.map((record, index) =>
    parseAttemptRecord(record, `attempts[${index}]`),
  );
  normalized.sort(
    (left, right) =>
      compareText(left.caseId, right.caseId) ||
      sideOrder(left.side) - sideOrder(right.side) ||
      left.attempt - right.attempt ||
      compareText(left.revision, right.revision),
  );

  const identities = new Set<string>();
  for (const record of normalized) {
    const identity = `${record.caseId}\u0000${record.side}\u0000${record.attempt}`;
    if (identities.has(identity)) {
      throw new EvidenceValidationError(
        `Duplicate attempt record: ${record.caseId}/${record.side}/${record.attempt}`,
      );
    }
    identities.add(identity);
  }
  return normalized;
}

/** Serialize canonical attempt records as JSONL without a trailing blank line. */
export function serializeAttemptsJsonl(records: readonly AttemptRecord[]): string {
  return canonicalizeAttemptRecords(records)
    .map((record) => serializeCanonicalJson(record).slice(0, -1))
    .join("\n");
}

/**
 * Verify the fixed 20-pre/20-post Spike gate, including immutable revisions/spec, zero retries and
 * model calls, the expected pre-fix checkpoint, and post-fix passes.
 */
export function verifyRepetitionGate(
  records: readonly AttemptRecord[],
  expectations: {
    readonly expectedCaseId: string;
    readonly postFixRevision: string;
    readonly preFixRevision: string;
    readonly specSha256: string;
  },
): EvidenceVerification {
  const issues: EvidenceIssue[] = [];
  const attempts: AttemptRecord[] = [];
  for (const [index, value] of records.entries()) {
    try {
      attempts.push(parseAttemptRecord(value, `attempts[${index}]`));
    } catch (error) {
      issues.push(
        issue(
          "invalid-attempt",
          `attempts[${index}]`,
          error instanceof Error ? error.message : "Attempt record is invalid",
        ),
      );
    }
  }

  if (attempts.length !== 40) {
    issues.push(
      issue("attempt-count", "attempts", `Expected 40 valid attempts but found ${attempts.length}`),
    );
  }
  if (!gitObjectIdPattern.test(expectations.preFixRevision)) {
    issues.push(
      issue("revision", "pre-fix", "Expected revision is not a lowercase full object ID"),
    );
  }
  if (!gitObjectIdPattern.test(expectations.postFixRevision)) {
    issues.push(
      issue("revision", "post-fix", "Expected revision is not a lowercase full object ID"),
    );
  }
  if (!sha256Pattern.test(expectations.specSha256)) {
    issues.push(issue("spec-hash", "spec", "Expected spec hash is not a lowercase SHA-256"));
  }

  const caseIds = new Set(attempts.map((attempt) => attempt.caseId));
  if (caseIds.size !== 1 || !caseIds.has(expectations.expectedCaseId)) {
    issues.push(issue("case-id", "attempts", "All gate attempts must use the expected case ID"));
  }

  const specHashes = new Set(attempts.map((attempt) => attempt.specSha256));
  if (specHashes.size !== 1) {
    issues.push(issue("spec-hash", "attempts", "All gate attempts must use the same spec hash"));
  }

  for (const attempt of attempts) {
    const subject = `${attempt.side}/${attempt.attempt}`;
    const expectedRevision =
      attempt.side === "pre-fix" ? expectations.preFixRevision : expectations.postFixRevision;
    if (attempt.revision !== expectedRevision) {
      issues.push(
        issue("revision", subject, "Attempt revision does not match the frozen revision"),
      );
    }
    if (attempt.specSha256 !== expectations.specSha256) {
      issues.push(issue("spec-hash", subject, "Attempt spec hash does not match the frozen test"));
    }
    if (attempt.retry !== 0) {
      issues.push(issue("retry", subject, `Expected zero retries but found ${attempt.retry}`));
    }
    if (attempt.modelCalls !== 0) {
      issues.push(
        issue("model-calls", subject, `Expected zero model calls but found ${attempt.modelCalls}`),
      );
    }

    if (attempt.side === "pre-fix") {
      if (
        attempt.classification !== "functional-failure" ||
        attempt.playwrightStatus !== "failed"
      ) {
        issues.push(
          issue("classification", subject, "Pre-fix attempt must be a functional failure"),
        );
      }
      if (attempt.firstFailedCheckpoint !== "processing-cleared") {
        issues.push(
          issue(
            "checkpoint",
            subject,
            "Pre-fix first failed checkpoint must be processing-cleared",
          ),
        );
      }
    } else {
      if (attempt.classification !== "pass" || attempt.playwrightStatus !== "passed") {
        issues.push(issue("classification", subject, "Post-fix attempt must pass"));
      }
      if (attempt.firstFailedCheckpoint !== null) {
        issues.push(
          issue("checkpoint", subject, "Passing attempt must not record a failed checkpoint"),
        );
      }
    }
  }

  for (const side of ["pre-fix", "post-fix"] as const) {
    const sideAttempts = attempts.filter((attempt) => attempt.side === side);
    if (sideAttempts.length !== 20) {
      issues.push(
        issue(
          "attempt-count",
          side,
          `Expected 20 attempts for ${side} but found ${sideAttempts.length}`,
        ),
      );
    }
    const counts = new Map<number, number>();
    for (const attempt of sideAttempts) {
      counts.set(attempt.attempt, (counts.get(attempt.attempt) ?? 0) + 1);
    }
    for (let attemptNumber = 1; attemptNumber <= 20; attemptNumber += 1) {
      if (counts.get(attemptNumber) !== 1) {
        issues.push(
          issue(
            "attempt-number",
            `${side}/${attemptNumber}`,
            "Each gate attempt number from 1 through 20 must occur exactly once",
          ),
        );
      }
    }
    for (const attemptNumber of [...counts.keys()].sort((left, right) => left - right)) {
      if (attemptNumber > 20) {
        issues.push(
          issue("attempt-number", `${side}/${attemptNumber}`, "Gate attempt number exceeds 20"),
        );
      }
    }
  }

  return { issues, ok: issues.length === 0 };
}
