import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readdir, readFile, realpath, rename, rm } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { serializeCanonicalJson } from "../../../src/evidence/canonical-json.ts";
import {
  type AttemptRecord,
  assertPortableRelativePath,
  createAttemptRecord,
  createManifestEntries,
  type ManifestArtifact,
  type ManifestEntry,
  type ParsedPlaywrightTestResult,
  parseAttemptRecord,
  parsePlaywrightJsonReport,
  serializeAttemptsJsonl,
  verifyManifestEntries,
  verifyRepetitionGate,
} from "./evidence.ts";

const caseMetadataPath = "generated/safe-unfollow-163.meta.json";
const candidateTracePath = "candidate-trace.json";
const baselineSpecPath = "baseline/safe-unfollow-163-recorder.spec.ts";
const frozenHypothesisPath = "frozen-hypothesis.json";
const attemptsPath = "attempts.jsonl";
const manifestPath = "manifest.json";
const generatedAttemptCount = 20;
const generatedSpecFile = "safe-unfollow-163.spec.ts";
const generatedSpecTitle = "recovers the upload page after interrupted local analysis";
const baselineSpecFile = "safe-unfollow-163-recorder.spec.ts";
const baselineSpecTitle = "upload is usable after an interrupted analysis";
const sha256Pattern = /^[a-f0-9]{64}$/u;
const expectedCaseId = "safe-unfollow-163";
const expectedPreFixRevision = "64c8a1d0f4c1a9a4ffbab2ea319d89bcab21ad47";
const expectedPostFixRevision = "ab55329e354dfb121486d7ff1f7daa2fa2e2e5fa";
const expectedRepository = "https://github.com/ignromanov/safe-unfollow.git";
const expectedReadinessUrl = "http://127.0.0.1:4173/upload";
const expectedFrozenFiles = [
  "candidate-trace.json",
  "generated/playwright.config.ts",
  "generated/safe-unfollow-163.meta.json",
  "generated/safe-unfollow-163.spec.ts",
  "generated/tsconfig.json",
  "inputs/safe-unfollow-163.md",
  "minimization-baseline.json",
  "outcome-contract.json",
  "reset-protocol.json",
] as const;
const requiredBundleFiles = [
  "SPIKE_REPORT.md",
  "attempts.jsonl",
  "baseline/playwright.config.ts",
  "baseline/recorder-comparison.json",
  "baseline/safe-unfollow-163-recorder.spec.ts",
  "baseline/tsconfig.json",
  "candidate-trace.json",
  "data-handling-report.json",
  "differential-summary.json",
  "environment.json",
  "frozen-hypothesis.json",
  "generated/playwright.config.ts",
  "generated/replay-safe-unfollow-163.mjs",
  "generated/safe-unfollow-163.meta.json",
  "generated/safe-unfollow-163.spec.ts",
  "generated/tsconfig.json",
  "inputs/safe-unfollow-163.md",
  "manifest.json",
  "minimization-baseline.json",
  "minimization-log.json",
  "outcome-contract.json",
  "replay-summary.json",
  "reset-protocol.json",
  "scope.json",
  "target-provenance.json",
  "tools/evidence-cli.ts",
  "tools/evidence.ts",
] as const;

type JsonObject = { readonly [key: string]: unknown };

type CaseMetadata = {
  readonly authoritativeCheckpointCount: number;
  readonly browserName: string;
  readonly caseId: string;
  readonly postFixRevision: string;
  readonly preFixRevision: string;
  readonly testSha256: string;
};

type ReportKind = "baseline" | "generated";

type ReportRunEvidence = {
  readonly configFile: "baseline/playwright.config.ts" | "generated/playwright.config.ts";
  readonly projectName: string;
  readonly repeatEach: 20;
  readonly results: 20;
  readonly retries: 0;
  readonly sha256: string;
  readonly workers: 1;
};

type RawReportEvidence = {
  readonly baselinePost: ReportRunEvidence;
  readonly baselinePre: ReportRunEvidence;
  readonly generatedPost: ReportRunEvidence;
  readonly generatedPre: ReportRunEvidence;
};

type LoadedReport = {
  readonly evidence: ReportRunEvidence;
  readonly results: readonly ParsedPlaywrightTestResult[];
};

export type MaterializeOptions = {
  readonly baselinePostReport: string;
  readonly baselinePreReport: string;
  readonly bundleRoot: string;
  readonly generatedPostReport: string;
  readonly generatedPreReport: string;
};

export type CommandSummary = {
  readonly command: "manifest" | "materialize";
  readonly files?: readonly string[];
  readonly manifestEntries?: number;
  readonly ok: true;
  readonly schemaVersion: 1;
};

export type VerificationIssue = {
  readonly code: string;
  readonly message: string;
  readonly subject: string;
};

export type VerifySummary = {
  readonly command: "verify";
  readonly issues: readonly VerificationIssue[];
  readonly ok: boolean;
  readonly schemaVersion: 1;
};

export type EvidenceCliIo = {
  readonly write: (text: string) => void;
};

/** Raised for invalid CLI arguments or a failed evidence invariant. */
export class EvidenceCliError extends Error {
  override readonly name = "EvidenceCliError";
}

function diagnostic(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  if ("code" in error && typeof error.code === "string") return fallback + " (" + error.code + ")";
  return containsLocalAbsolutePath(error.message) ? fallback : error.message;
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function asObject(value: unknown, path: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new EvidenceCliError(`${path}: expected an object`);
  }
  return value as JsonObject;
}

function asArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new EvidenceCliError(`${path}: expected an array`);
  return value;
}

function asString(value: unknown, path: string): string {
  if (typeof value !== "string") throw new EvidenceCliError(`${path}: expected a string`);
  return value;
}

function asNumber(value: unknown, path: string): number {
  if (typeof value !== "number") throw new EvidenceCliError(`${path}: expected a number`);
  return value;
}

function assertExactKeys(object: JsonObject, expected: readonly string[], path: string): void {
  const actual = Object.keys(object).sort(compareText);
  const wanted = [...expected].sort(compareText);
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new EvidenceCliError(`${path}: expected exactly these fields: ${wanted.join(", ")}`);
  }
}

function expectEqual(actual: unknown, expected: unknown, path: string): void {
  if (serializeCanonicalJson(actual) !== serializeCanonicalJson(expected)) {
    throw new EvidenceCliError(`${path}: unexpected value`);
  }
}

function expectStringArray(value: unknown, expected: readonly string[], path: string): void {
  const actual = asArray(value, path).map((entry, index) => asString(entry, `${path}[${index}]`));
  expectEqual(actual, expected, path);
}

function asSchemaVersion(object: JsonObject, path: string): 1 {
  if (object.schemaVersion !== 1) throw new EvidenceCliError(`${path}.schemaVersion: expected 1`);
  return 1;
}

function sha256(contents: Uint8Array | string): string {
  return createHash("sha256").update(contents).digest("hex");
}

function isWithin(root: string, candidate: string): boolean {
  const fromRoot = relative(root, candidate);
  return (
    fromRoot === "" ||
    (!isAbsolute(fromRoot) && fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`))
  );
}

async function ensureBundleRoot(bundleRoot: string): Promise<string> {
  if (bundleRoot.length === 0) throw new EvidenceCliError("--bundle-root must not be empty");
  const lexicalRoot = resolve(bundleRoot);
  await mkdir(lexicalRoot, { recursive: true });
  return realpath(lexicalRoot);
}

async function resolveBundleFile(
  root: string,
  relativePath: string,
  createParent: boolean,
): Promise<string> {
  assertPortableRelativePath(relativePath);
  const target = join(root, ...relativePath.split("/"));
  if (!isWithin(root, target)) throw new EvidenceCliError("Bundle path escapes its root");
  const parent = dirname(target);
  if (createParent) await mkdir(parent, { recursive: true });
  const resolvedParent = await realpath(parent);
  if (!isWithin(root, resolvedParent)) {
    throw new EvidenceCliError("Bundle file parent resolves outside its root");
  }
  return join(resolvedParent, basename(target));
}

async function readBundleBytes(root: string, relativePath: string): Promise<Buffer> {
  const target = await resolveBundleFile(root, relativePath, false);
  const targetInfo = await lstat(target);
  if (targetInfo.isSymbolicLink() || !targetInfo.isFile()) {
    throw new EvidenceCliError(`${relativePath}: expected a regular file`);
  }
  const resolvedTarget = await realpath(target);
  if (!isWithin(root, resolvedTarget)) {
    throw new EvidenceCliError(`${relativePath}: file resolves outside the bundle root`);
  }
  return readFile(resolvedTarget);
}

async function readBundleText(root: string, relativePath: string): Promise<string> {
  return (await readBundleBytes(root, relativePath)).toString("utf8");
}

async function atomicReplaceText(
  root: string,
  relativePath: string,
  contents: string,
): Promise<void> {
  const target = await resolveBundleFile(root, relativePath, true);
  const temporary = join(dirname(target), `.${relativePath.split("/").at(-1)}.${randomUUID()}.tmp`);
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  let failure: unknown;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(contents, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, target);
  } catch (error) {
    failure = error;
  }

  const cleanupErrors: unknown[] = [];
  if (handle !== undefined) {
    try {
      await handle.close();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  try {
    await rm(temporary, { force: true });
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      failure === undefined ? cleanupErrors : [failure, ...cleanupErrors],
      `Atomic cleanup failed for ${relativePath}`,
    );
  }
  if (failure !== undefined) throw failure;
}

async function writeCanonicalJson(root: string, path: string, value: unknown): Promise<void> {
  await atomicReplaceText(root, path, serializeCanonicalJson(value));
}

function parseJson(contents: string, label: string): unknown {
  try {
    return JSON.parse(contents) as unknown;
  } catch (error) {
    throw new EvidenceCliError(`${label}: invalid JSON`, { cause: error });
  }
}

async function readBundleJson(root: string, relativePath: string): Promise<unknown> {
  const contents = await readBundleText(root, relativePath);
  return parseJson(contents, relativePath);
}

async function loadCaseMetadata(root: string): Promise<CaseMetadata> {
  const metadata = asObject(await readBundleJson(root, caseMetadataPath), caseMetadataPath);
  asSchemaVersion(metadata, caseMetadataPath);
  const checkpoints = asArray(
    metadata.authoritativeCheckpoints,
    `${caseMetadataPath}.authoritativeCheckpoints`,
  );
  for (const [index, checkpoint] of checkpoints.entries()) {
    asString(checkpoint, `${caseMetadataPath}.authoritativeCheckpoints[${index}]`);
  }
  const browser = asObject(metadata.browser, `${caseMetadataPath}.browser`);
  const parsed = {
    authoritativeCheckpointCount: checkpoints.length,
    browserName: asString(browser.name, `${caseMetadataPath}.browser.name`),
    caseId: asString(metadata.caseId, `${caseMetadataPath}.caseId`),
    postFixRevision: asString(metadata.postFixRevision, `${caseMetadataPath}.postFixRevision`),
    preFixRevision: asString(metadata.preFixRevision, `${caseMetadataPath}.preFixRevision`),
    testSha256: asString(metadata.testSha256, `${caseMetadataPath}.testSha256`),
  };
  if (
    parsed.caseId !== expectedCaseId ||
    parsed.preFixRevision !== expectedPreFixRevision ||
    parsed.postFixRevision !== expectedPostFixRevision ||
    parsed.browserName !== "chromium" ||
    parsed.authoritativeCheckpointCount !== 4 ||
    !sha256Pattern.test(parsed.testSha256)
  ) {
    throw new EvidenceCliError(`${caseMetadataPath}: core case metadata does not match`);
  }
  return parsed;
}

function ensureResultCount(results: readonly ParsedPlaywrightTestResult[], label: string): void {
  if (results.length !== generatedAttemptCount) {
    throw new EvidenceCliError(
      `${label}: expected ${generatedAttemptCount} results but found ${results.length}`,
    );
  }
}

function expectedReportIdentity(kind: ReportKind): {
  readonly configFile: ReportRunEvidence["configFile"];
  readonly configSuffix: string;
  readonly specFile: string;
  readonly title: string;
} {
  return kind === "generated"
    ? {
        configFile: "generated/playwright.config.ts",
        configSuffix: "spikes/local-functional-regression/generated/playwright.config.ts",
        specFile: generatedSpecFile,
        title: generatedSpecTitle,
      }
    : {
        configFile: "baseline/playwright.config.ts",
        configSuffix: "spikes/local-functional-regression/baseline/playwright.config.ts",
        specFile: baselineSpecFile,
        title: baselineSpecTitle,
      };
}

function validateReportEnvelope(
  report: unknown,
  results: readonly ParsedPlaywrightTestResult[],
  kind: ReportKind,
  reportSha256: string,
): ReportRunEvidence {
  const checkSuites = (suites: readonly unknown[]): void => {
    for (const value of suites) {
      const suite = asObject(value, "report suite");
      for (const entry of asArray(suite.specs ?? [], "report specs")) {
        const spec = asObject(entry, "report spec");
        const tests = asArray(spec.tests, "report tests");
        if (
          tests.length !== 1 ||
          asArray(asObject(tests[0], "report test").results, "report results").length !== 1
        ) {
          throw new EvidenceCliError("Each spec must have exactly one test and one result");
        }
      }
      checkSuites(asArray(suite.suites ?? [], "report suites"));
    }
  };
  checkSuites(asArray(asObject(report, "report").suites, "report suites"));
  const identity = expectedReportIdentity(kind);
  ensureResultCount(results, `${kind} report`);
  const root = asObject(report, `${kind} report`);
  if (asArray(root.errors, `${kind} report.errors`).length !== 0) {
    throw new EvidenceCliError(`${kind} report: report-level errors must be empty`);
  }
  const config = asObject(root.config, `${kind} report.config`);
  if (config.workers !== 1) throw new EvidenceCliError(`${kind} report: workers must be 1`);
  const configFile = asString(config.configFile, `${kind} report.config.configFile`).replaceAll(
    String.fromCharCode(92),
    "/",
  );
  if (configFile !== identity.configSuffix && !configFile.endsWith(`/${identity.configSuffix}`)) {
    throw new EvidenceCliError(`${kind} report: configFile does not match the frozen config`);
  }
  const projects = asArray(config.projects, `${kind} report.config.projects`);
  if (projects.length !== 1) {
    throw new EvidenceCliError(`${kind} report: expected exactly one Playwright project`);
  }
  const project = asObject(projects[0], `${kind} report.config.projects[0]`);
  if (project.repeatEach !== generatedAttemptCount || project.retries !== 0) {
    throw new EvidenceCliError(`${kind} report: repeatEach must be 20 and retries must be 0`);
  }
  const projectName = asString(project.name, `${kind} report.config.projects[0].name`);
  if (projectName !== "") throw new EvidenceCliError("Expected the unnamed frozen project");
  const specIds = new Set<string>();
  for (const result of results) {
    if (result.specId === "" || specIds.has(result.specId) || result.resultIndex !== 0) {
      throw new EvidenceCliError("Expected 20 unique test IDs with one result each");
    }
    specIds.add(result.specId);
    if (result.retry !== 0) throw new EvidenceCliError("Every result must explicitly use retry=0");
    if (result.status === "passed" && result.errorMessages.length !== 0) {
      throw new EvidenceCliError("Passed results must contain no errors");
    }
  }
  for (const [index, result] of results.entries()) {
    if (
      result.file !== identity.specFile ||
      result.title !== identity.title ||
      result.projectName !== projectName ||
      result.titlePath.length !== 2 ||
      result.titlePath[0] !== identity.specFile ||
      result.titlePath[1] !== identity.title
    ) {
      throw new EvidenceCliError(
        `${kind} report result ${index + 1}: spec file, title, or project does not match`,
      );
    }
  }
  return {
    configFile: identity.configFile,
    projectName,
    repeatEach: 20,
    results: 20,
    retries: 0,
    sha256: reportSha256,
    workers: 1,
  };
}

async function loadReport(path: string, kind: ReportKind): Promise<LoadedReport> {
  const bytes = await readFile(path);
  const value = parseJson(bytes.toString("utf8"), `${kind} report`);
  const results = parsePlaywrightJsonReport(value);
  return {
    evidence: validateReportEnvelope(value, results, kind, sha256(bytes)),
    results,
  };
}

function createGeneratedAttempts(
  metadata: CaseMetadata,
  preFix: readonly ParsedPlaywrightTestResult[],
  postFix: readonly ParsedPlaywrightTestResult[],
): readonly AttemptRecord[] {
  ensureResultCount(preFix, "generated pre-fix report");
  ensureResultCount(postFix, "generated post-fix report");
  const records: AttemptRecord[] = [];
  for (const [index, result] of preFix.entries()) {
    records.push(
      createAttemptRecord({
        attempt: index + 1,
        caseId: metadata.caseId,
        modelCalls: 0,
        result,
        revision: metadata.preFixRevision,
        side: "pre-fix",
        specSha256: metadata.testSha256,
      }),
    );
  }
  for (const [index, result] of postFix.entries()) {
    records.push(
      createAttemptRecord({
        attempt: index + 1,
        caseId: metadata.caseId,
        modelCalls: 0,
        result,
        revision: metadata.postFixRevision,
        side: "post-fix",
        specSha256: metadata.testSha256,
      }),
    );
  }
  return records;
}

function hasBaselineVisibleHiddenSemantics(message: string): boolean {
  return (
    message.includes("Analyzing locally...") &&
    /toBeHidden/iu.test(message) &&
    /Expected:\s*hidden/iu.test(message) &&
    /Received:\s*visible/iu.test(message)
  );
}

function verifyBaselineReports(
  preFix: readonly ParsedPlaywrightTestResult[],
  postFix: readonly ParsedPlaywrightTestResult[],
): void {
  ensureResultCount(preFix, "baseline pre-fix report");
  ensureResultCount(postFix, "baseline post-fix report");
  for (const [index, result] of preFix.entries()) {
    if (result.status !== "failed" || result.retry !== 0) {
      throw new EvidenceCliError(`baseline pre-fix result ${index + 1}: expected failed/retry=0`);
    }
    if (
      result.errorMessages.length === 0 ||
      !result.errorMessages.every(hasBaselineVisibleHiddenSemantics)
    ) {
      throw new EvidenceCliError(
        `baseline pre-fix result ${index + 1}: missing visible/hidden failure semantics`,
      );
    }
  }
  for (const [index, result] of postFix.entries()) {
    if (result.status !== "passed" || result.retry !== 0) {
      throw new EvidenceCliError(`baseline post-fix result ${index + 1}: expected passed/retry=0`);
    }
  }
}

function verifyGeneratedPreFixSemantics(results: readonly ParsedPlaywrightTestResult[]): void {
  for (const [index, result] of results.entries()) {
    if (
      result.errorMessages.length === 0 ||
      !result.errorMessages.every(hasBaselineVisibleHiddenSemantics)
    ) {
      throw new EvidenceCliError(
        `generated pre-fix result ${index + 1}: missing Analyzing locally visible/hidden semantics`,
      );
    }
  }
}

async function loadCandidateActionCount(root: string): Promise<number> {
  const candidate = asObject(await readBundleJson(root, candidateTracePath), candidateTracePath);
  asSchemaVersion(candidate, candidateTracePath);
  const actionCount = asNumber(candidate.actionCount, `${candidateTracePath}.actionCount`);
  if (!Number.isSafeInteger(actionCount) || actionCount < 0) {
    throw new EvidenceCliError(
      `${candidateTracePath}.actionCount: expected a non-negative integer`,
    );
  }
  return actionCount;
}

function countOccurrences(value: string, fragment: string): number {
  let count = 0;
  let offset = 0;
  while (true) {
    const found = value.indexOf(fragment, offset);
    if (found < 0) return count;
    count += 1;
    offset = found + fragment.length;
  }
}

function buildMaterializedDocuments(options: {
  readonly baselineNavigationActionCount: number;
  readonly baselineSpecSha256: string;
  readonly candidateActionCount: number;
  readonly metadata: CaseMetadata;
  readonly rawReports: RawReportEvidence;
}): {
  readonly differentialSummary: unknown;
  readonly recorderComparison: unknown;
  readonly replaySummary: unknown;
} {
  const { baselineNavigationActionCount, baselineSpecSha256, candidateActionCount, metadata } =
    options;
  const differentialSummary = {
    caseId: metadata.caseId,
    postFix: {
      attempts: generatedAttemptCount,
      passes: generatedAttemptCount,
      revision: metadata.postFixRevision,
    },
    preFix: {
      attempts: generatedAttemptCount,
      expectedFunctionalFailures: generatedAttemptCount,
      firstFailedCheckpoint: "processing-cleared",
      revision: metadata.preFixRevision,
    },
    rawReports: options.rawReports,
    sameStandaloneTest: true,
    schemaVersion: 1,
    testSha256: metadata.testSha256,
    verdict: "differential-confirmed",
  };
  const replaySummary = {
    browser: metadata.browserName,
    caseId: metadata.caseId,
    contextReuse: false,
    modelCalls: 0,
    postFixPasses: generatedAttemptCount,
    preFixExpectedFunctionalFailures: generatedAttemptCount,
    rawReports: options.rawReports,
    retries: 0,
    schemaVersion: 1,
    standalonePlaywright: true,
    testSha256: metadata.testSha256,
    totalAttempts: generatedAttemptCount * 2,
  };
  const recorderComparison = {
    baseline: {
      navigationActionCount: baselineNavigationActionCount,
      postFixPasses: generatedAttemptCount,
      preFixVisibleHiddenFailures: generatedAttemptCount,
      selectorStrategy: ["css-element", "css-id", "visible-text"],
      specSha256: baselineSpecSha256,
    },
    caseId: metadata.caseId,
    comparison: {
      actionCount: {
        baselineNavigationActionCount,
        delta: candidateActionCount - baselineNavigationActionCount,
        generatedNavigationActionCount: candidateActionCount,
      },
      businessOutcomeClarity: {
        baseline: "four-inline-user-visible-assertions",
        generated: "four-named-semantic-outcome-checkpoints",
      },
      failureMessageQuality: {
        baseline: "playwright-visible-hidden-diagnostic",
        generated: "stable-processing-cleared-checkpoint-plus-playwright-diagnostic",
      },
      maintenanceAssumptions: {
        baseline: ["css-structure-and-id-remain-stable", "storage-key-and-schema-remain-stable"],
        generated: [
          "accessible-names-and-visible-copy-remain-stable",
          "storage-key-and-schema-remain-stable",
        ],
        shared: ["upload-route-remains-available", "interrupted-state-remains-version-5"],
      },
      preconditionClarity: {
        baseline: "inline-reset-and-storage-seed",
        generated: "explicit-reset-checkpoints-and-versioned-storage-fixture",
      },
      unnecessarySteps: { baseline: 0, generated: 0 },
    },
    conclusion: {
      bothConfirmDifferential: true,
      generatedStableCheckpoint: "processing-cleared",
      outcome: "limited-improvement-over-careful-manual-baseline",
      runsPerRevision: generatedAttemptCount,
    },
    generated: {
      authoritativeCheckpointCount: metadata.authoritativeCheckpointCount,
      navigationActionCount: candidateActionCount,
      postFixPasses: generatedAttemptCount,
      preFixExpectedFunctionalFailures: generatedAttemptCount,
      selectorStrategy: ["accessible-label", "accessible-role", "visible-text"],
      specSha256: metadata.testSha256,
    },
    schemaVersion: 1,
  };
  return { differentialSummary, recorderComparison, replaySummary };
}

/** Materialize normalized evidence from four raw Playwright JSON reports. */
export async function materializeEvidenceBundle(
  options: MaterializeOptions,
): Promise<CommandSummary> {
  const root = await ensureBundleRoot(options.bundleRoot);
  const inputIssues: VerificationIssue[] = [];
  await verifyFrozenHashes(root, inputIssues);
  await verifyCoreEvidence(root, inputIssues);
  if (inputIssues.length !== 0) {
    throw new EvidenceCliError("Source evidence failed frozen/core validation");
  }
  const metadata = await loadCaseMetadata(root);
  const actualSpecSha256 = sha256(
    await readBundleBytes(root, "generated/safe-unfollow-163.spec.ts"),
  );
  if (actualSpecSha256 !== metadata.testSha256) {
    throw new EvidenceCliError("Generated spec does not match its frozen metadata SHA-256");
  }
  const [generatedPreReport, generatedPostReport, baselinePreReport, baselinePostReport] =
    await Promise.all([
      loadReport(options.generatedPreReport, "generated"),
      loadReport(options.generatedPostReport, "generated"),
      loadReport(options.baselinePreReport, "baseline"),
      loadReport(options.baselinePostReport, "baseline"),
    ]);
  const rawReports: RawReportEvidence = {
    baselinePost: baselinePostReport.evidence,
    baselinePre: baselinePreReport.evidence,
    generatedPost: generatedPostReport.evidence,
    generatedPre: generatedPreReport.evidence,
  };

  const attempts = createGeneratedAttempts(
    metadata,
    generatedPreReport.results,
    generatedPostReport.results,
  );
  const gate = verifyRepetitionGate(attempts, {
    expectedCaseId: metadata.caseId,
    postFixRevision: metadata.postFixRevision,
    preFixRevision: metadata.preFixRevision,
    specSha256: metadata.testSha256,
  });
  if (!gate.ok) {
    throw new EvidenceCliError(
      `Generated repetition gate failed: ${gate.issues.map((entry) => entry.code).join(",")}`,
    );
  }
  verifyGeneratedPreFixSemantics(generatedPreReport.results);
  verifyBaselineReports(baselinePreReport.results, baselinePostReport.results);

  const candidateActionCount = await loadCandidateActionCount(root);
  const baselineSource = await readBundleText(root, baselineSpecPath);
  const baselineNavigationActionCount = countOccurrences(baselineSource, "await page.goto(");
  const baselineSpecSha256 = sha256(baselineSource);

  const { differentialSummary, recorderComparison, replaySummary } = buildMaterializedDocuments({
    baselineNavigationActionCount,
    baselineSpecSha256,
    candidateActionCount,
    metadata,
    rawReports,
  });

  const files = [
    attemptsPath,
    "baseline/recorder-comparison.json",
    "differential-summary.json",
    "replay-summary.json",
  ].sort(compareText);
  const documents = [
    [attemptsPath, serializeAttemptsJsonl(attempts)],
    ["differential-summary.json", serializeCanonicalJson(differentialSummary)],
    ["replay-summary.json", serializeCanonicalJson(replaySummary)],
    ["baseline/recorder-comparison.json", serializeCanonicalJson(recorderComparison)],
  ] as const;
  for (const [path, text] of documents) {
    try {
      if ((await readBundleText(root, path)) !== text) {
        throw new EvidenceCliError("Existing run evidence differs; use a new bundle root");
      }
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
  await atomicReplaceText(root, attemptsPath, serializeAttemptsJsonl(attempts));
  await writeCanonicalJson(root, "differential-summary.json", differentialSummary);
  await writeCanonicalJson(root, "replay-summary.json", replaySummary);
  await writeCanonicalJson(root, "baseline/recorder-comparison.json", recorderComparison);

  return { command: "materialize", files, ok: true, schemaVersion: 1 };
}

async function walkBundleFiles(root: string, directory = root): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((left, right) => compareText(left.name, right.name))) {
    const fullPath = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new EvidenceCliError("Bundle cannot contain symbolic links");
    }
    if (entry.isDirectory()) {
      files.push(...(await walkBundleFiles(root, fullPath)));
      continue;
    }
    if (!entry.isFile()) throw new EvidenceCliError("Bundle contains a non-regular entry");
    const relativePath = relative(root, fullPath).split(sep).join("/");
    assertPortableRelativePath(relativePath);
    files.push(relativePath);
  }
  return files.sort(compareText);
}

async function loadBundleArtifacts(
  root: string,
  excluded: ReadonlySet<string>,
): Promise<readonly ManifestArtifact[]> {
  const files = await walkBundleFiles(root);
  const artifacts: ManifestArtifact[] = [];
  for (const path of files) {
    if (excluded.has(path)) continue;
    artifacts.push({ contents: await readBundleBytes(root, path), path });
  }
  return artifacts;
}

async function verifyRequiredFiles(root: string, issues: VerificationIssue[]): Promise<void> {
  try {
    const files = new Set(await walkBundleFiles(root));
    for (const path of requiredBundleFiles) {
      if (!files.has(path)) {
        issues.push(
          verificationIssue("required-file", path, "Required Spike evidence file is missing"),
        );
      }
    }
  } catch (error) {
    issues.push(
      verificationIssue("required-file-scan", ".", diagnostic(error, "Required file scan failed")),
    );
  }
}

/** Recursively hash every regular bundle file except manifest.json and atomically replace it. */
export async function writeEvidenceManifest(bundleRoot: string): Promise<CommandSummary> {
  const root = await ensureBundleRoot(bundleRoot);
  const artifacts = await loadBundleArtifacts(root, new Set([manifestPath]));
  const entries = createManifestEntries(artifacts);
  await writeCanonicalJson(root, manifestPath, {
    algorithm: "sha256",
    entries,
    schemaVersion: 1,
  });
  return { command: "manifest", manifestEntries: entries.length, ok: true, schemaVersion: 1 };
}

function parseManifest(value: unknown): readonly ManifestEntry[] {
  const manifest = asObject(value, manifestPath);
  asSchemaVersion(manifest, manifestPath);
  if (manifest.algorithm !== "sha256") {
    throw new EvidenceCliError(`${manifestPath}.algorithm: expected sha256`);
  }
  return asArray(manifest.entries, `${manifestPath}.entries`).map((value, index) => {
    const entry = asObject(value, `${manifestPath}.entries[${index}]`);
    return {
      bytes: asNumber(entry.bytes, `${manifestPath}.entries[${index}].bytes`),
      path: asString(entry.path, `${manifestPath}.entries[${index}].path`),
      sha256: asString(entry.sha256, `${manifestPath}.entries[${index}].sha256`),
    };
  });
}

function parseReportRunEvidence(value: unknown, path: string, kind: ReportKind): ReportRunEvidence {
  const report = asObject(value, path);
  const expectedConfig = expectedReportIdentity(kind).configFile;
  if (report.configFile !== expectedConfig) {
    throw new EvidenceCliError(`${path}.configFile: unexpected portable config path`);
  }
  if (
    report.repeatEach !== 20 ||
    report.results !== 20 ||
    report.retries !== 0 ||
    report.workers !== 1
  ) {
    throw new EvidenceCliError(`${path}: expected 20 results, repeatEach 20, retries 0, workers 1`);
  }
  if (report.projectName !== "") throw new EvidenceCliError(`${path}: expected unnamed project`);
  const reportSha256 = asString(report.sha256, `${path}.sha256`);
  if (!sha256Pattern.test(reportSha256)) {
    throw new EvidenceCliError(`${path}.sha256: expected a lowercase SHA-256`);
  }
  return {
    configFile: expectedConfig,
    projectName: asString(report.projectName, `${path}.projectName`),
    repeatEach: 20,
    results: 20,
    retries: 0,
    sha256: reportSha256,
    workers: 1,
  };
}

function parseRawReportEvidence(value: unknown, path: string): RawReportEvidence {
  const reports = asObject(value, path);
  const parsed = {
    baselinePost: parseReportRunEvidence(reports.baselinePost, `${path}.baselinePost`, "baseline"),
    baselinePre: parseReportRunEvidence(reports.baselinePre, `${path}.baselinePre`, "baseline"),
    generatedPost: parseReportRunEvidence(
      reports.generatedPost,
      `${path}.generatedPost`,
      "generated",
    ),
    generatedPre: parseReportRunEvidence(reports.generatedPre, `${path}.generatedPre`, "generated"),
  };
  if (new Set(Object.values(parsed).map((report) => report.sha256)).size !== 4) {
    throw new EvidenceCliError(`${path}: each raw report must have a distinct SHA-256`);
  }
  if (new Set(Object.values(parsed).map((report) => report.projectName)).size !== 1) {
    throw new EvidenceCliError(`${path}: all raw reports must use the same Playwright project`);
  }
  return parsed;
}

function verificationIssue(code: string, subject: string, message: string): VerificationIssue {
  return { code, message, subject };
}

function sortIssues(issues: readonly VerificationIssue[]): readonly VerificationIssue[] {
  return [...issues].sort(
    (left, right) =>
      compareText(left.code, right.code) ||
      compareText(left.subject, right.subject) ||
      compareText(left.message, right.message),
  );
}

async function verifyManifest(root: string, issues: VerificationIssue[]): Promise<void> {
  try {
    const manifestText = await readBundleText(root, manifestPath);
    const manifestValue = JSON.parse(manifestText) as unknown;
    const entries = parseManifest(manifestValue);
    const canonicalManifest = serializeCanonicalJson({
      algorithm: "sha256",
      entries,
      schemaVersion: 1,
    });
    if (manifestText !== canonicalManifest) {
      issues.push(
        verificationIssue("manifest-canonical", manifestPath, "Manifest is not canonical JSON"),
      );
    }
    const artifacts = await loadBundleArtifacts(root, new Set([manifestPath]));
    const result = verifyManifestEntries(entries, artifacts);
    for (const entry of result.issues) {
      issues.push(verificationIssue(`manifest-${entry.code}`, entry.subject, entry.message));
    }
  } catch (error) {
    issues.push(
      verificationIssue(
        "manifest-invalid",
        manifestPath,
        diagnostic(error, "Manifest verification failed"),
      ),
    );
  }
}

async function verifyFrozenHashes(root: string, issues: VerificationIssue[]): Promise<void> {
  try {
    const frozen = asObject(await readBundleJson(root, frozenHypothesisPath), frozenHypothesisPath);
    asSchemaVersion(frozen, frozenHypothesisPath);
    assertExactKeys(
      frozen,
      [
        "boundary",
        "caseId",
        "files",
        "frozenAt",
        "postFixRevision",
        "postFixSourceReadBeforeFreeze",
        "preFixRevision",
        "preFixValidation",
        "schemaVersion",
      ],
      frozenHypothesisPath,
    );
    if (
      frozen.caseId !== expectedCaseId ||
      frozen.preFixRevision !== expectedPreFixRevision ||
      frozen.postFixRevision !== expectedPostFixRevision ||
      frozen.postFixSourceReadBeforeFreeze !== false ||
      frozen.boundary !==
        "Before creating or reading the post-fix worktree and before the first post-fix execution."
    ) {
      throw new EvidenceCliError(`${frozenHypothesisPath}: core boundary metadata does not match`);
    }
    const preValidation = asObject(
      frozen.preFixValidation,
      `${frozenHypothesisPath}.preFixValidation`,
    );
    assertExactKeys(
      preValidation,
      [
        "classification",
        "command",
        "exitCode",
        "expected",
        "firstFailedCheckpoint",
        "observed",
        "pageReadyPassed",
        "resetPassed",
      ],
      `${frozenHypothesisPath}.preFixValidation`,
    );
    if (
      preValidation.classification !== "functional-failure" ||
      preValidation.firstFailedCheckpoint !== "processing-cleared" ||
      preValidation.exitCode !== 1 ||
      preValidation.pageReadyPassed !== true ||
      preValidation.resetPassed !== true
    ) {
      throw new EvidenceCliError(`${frozenHypothesisPath}.preFixValidation: unexpected value`);
    }
    const seen = new Set<string>();
    let frozenSpecHash: string | null = null;
    for (const [index, value] of asArray(frozen.files, `${frozenHypothesisPath}.files`).entries()) {
      const entry = asObject(value, `${frozenHypothesisPath}.files[${index}]`);
      const path = asString(entry.path, `${frozenHypothesisPath}.files[${index}].path`);
      const expected = asString(entry.sha256, `${frozenHypothesisPath}.files[${index}].sha256`);
      assertPortableRelativePath(path);
      if (seen.has(path)) {
        issues.push(verificationIssue("frozen-duplicate", path, "Frozen path is duplicated"));
        continue;
      }
      seen.add(path);
      const actual = sha256(await readBundleBytes(root, path));
      if (actual !== expected) {
        issues.push(verificationIssue("frozen-hash", path, "Frozen SHA-256 does not match"));
      }
      if (path === "generated/safe-unfollow-163.spec.ts") frozenSpecHash = expected;
    }
    expectEqual([...seen].sort(compareText), expectedFrozenFiles, `${frozenHypothesisPath}.files`);
    const metadata = await loadCaseMetadata(root);
    if (frozenSpecHash === null || frozenSpecHash !== metadata.testSha256) {
      issues.push(
        verificationIssue(
          "frozen-spec",
          "generated/safe-unfollow-163.spec.ts",
          "Frozen spec hash and metadata test hash must agree",
        ),
      );
    }
  } catch (error) {
    issues.push(
      verificationIssue(
        "frozen-invalid",
        frozenHypothesisPath,
        diagnostic(error, "Frozen hash verification failed"),
      ),
    );
  }
}

function validateScope(value: unknown): void {
  const path = "scope.json";
  const scope = asObject(value, path);
  assertExactKeys(scope, ["allowed", "caseId", "excluded", "schemaVersion", "target"], path);
  asSchemaVersion(scope, path);
  if (scope.caseId !== expectedCaseId)
    throw new EvidenceCliError(`${path}.caseId: unexpected value`);
  expectStringArray(
    scope.allowed,
    [
      "local-loopback-execution",
      "synthetic-browser-storage",
      "disposable-revision-worktrees",
      "standalone-playwright-replay",
    ],
    `${path}.allowed`,
  );
  expectStringArray(
    scope.excluded,
    [
      "hosted-deployments",
      "external-accounts",
      "instagram-exports",
      "production-data",
      "security-testing",
      "unrelated-targets",
    ],
    `${path}.excluded`,
  );
  const target = asObject(scope.target, `${path}.target`);
  assertExactKeys(
    target,
    ["postFixRevision", "preFixRevision", "readinessUrl", "repository"],
    `${path}.target`,
  );
  expectEqual(
    target,
    {
      postFixRevision: expectedPostFixRevision,
      preFixRevision: expectedPreFixRevision,
      readinessUrl: expectedReadinessUrl,
      repository: expectedRepository,
    },
    `${path}.target`,
  );
}

function validateTargetProvenance(value: unknown): void {
  const path = "target-provenance.json";
  const provenance = asObject(value, path);
  assertExactKeys(
    provenance,
    [
      "ancestry",
      "license",
      "lockfile",
      "nodeRequirement",
      "packageManager",
      "postFixDiffInspectedBeforeFirstPostFixRun",
      "postFixRevision",
      "preFixRevision",
      "repository",
      "schemaVersion",
      "sourceInspectedBeforeFreeze",
    ],
    path,
  );
  asSchemaVersion(provenance, path);
  const ancestry = asObject(provenance.ancestry, `${path}.ancestry`);
  assertExactKeys(ancestry, ["postFixParents", "relationship"], `${path}.ancestry`);
  expectEqual(
    ancestry,
    { postFixParents: [expectedPreFixRevision], relationship: "direct-parent" },
    `${path}.ancestry`,
  );
  const lockfile = asObject(provenance.lockfile, `${path}.lockfile`);
  assertExactKeys(lockfile, ["lockfileVersion", "path"], `${path}.lockfile`);
  expectEqual(lockfile, { lockfileVersion: 3, path: "package-lock.json" }, `${path}.lockfile`);
  if (
    provenance.license !== "MIT" ||
    provenance.nodeRequirement !== null ||
    provenance.packageManager !== "npm" ||
    provenance.postFixDiffInspectedBeforeFirstPostFixRun !== false ||
    provenance.postFixRevision !== expectedPostFixRevision ||
    provenance.preFixRevision !== expectedPreFixRevision ||
    provenance.repository !== expectedRepository ||
    provenance.sourceInspectedBeforeFreeze !== "pre-fix-only"
  ) {
    throw new EvidenceCliError(`${path}: core provenance does not match`);
  }
}

function validateEnvironment(value: unknown): void {
  const path = "environment.json";
  const environment = asObject(value, path);
  assertExactKeys(environment, ["browser", "platform", "runtime", "schemaVersion", "target"], path);
  asSchemaVersion(environment, path);
  const browser = asObject(environment.browser, `${path}.browser`);
  assertExactKeys(
    browser,
    ["headless", "name", "playwright", "retries", "version", "viewport", "workers"],
    `${path}.browser`,
  );
  const viewport = asObject(browser.viewport, `${path}.browser.viewport`);
  assertExactKeys(viewport, ["height", "width"], `${path}.browser.viewport`);
  expectEqual(viewport, { height: 720, width: 1280 }, `${path}.browser.viewport`);
  if (
    browser.headless !== true ||
    browser.name !== "chromium" ||
    browser.playwright !== "1.62.1" ||
    browser.retries !== 0 ||
    browser.workers !== 1
  ) {
    throw new EvidenceCliError(`${path}.browser: core runner settings do not match`);
  }
  asString(browser.version, `${path}.browser.version`);
  const platform = asObject(environment.platform, `${path}.platform`);
  assertExactKeys(platform, ["architecture", "os", "release"], `${path}.platform`);
  asString(platform.architecture, `${path}.platform.architecture`);
  asString(platform.os, `${path}.platform.os`);
  asString(platform.release, `${path}.platform.release`);
  const runtime = asObject(environment.runtime, `${path}.runtime`);
  assertExactKeys(runtime, ["node", "npm", "pnpm"], `${path}.runtime`);
  asString(runtime.node, `${path}.runtime.node`);
  asString(runtime.npm, `${path}.runtime.npm`);
  asString(runtime.pnpm, `${path}.runtime.pnpm`);
  const target = asObject(environment.target, `${path}.target`);
  assertExactKeys(
    target,
    [
      "installCommand",
      "installResults",
      "lockfileSha256",
      "lockfileVersion",
      "packageManager",
      "readinessUrl",
      "startCommand",
      "viteObservedVersion",
    ],
    `${path}.target`,
  );
  const installResults = asObject(target.installResults, `${path}.target.installResults`);
  assertExactKeys(installResults, ["postFix", "preFix"], `${path}.target.installResults`);
  asString(installResults.postFix, `${path}.target.installResults.postFix`);
  asString(installResults.preFix, `${path}.target.installResults.preFix`);
  if (
    target.installCommand !== "npm ci" ||
    target.lockfileSha256 !== "5bae88ae4fbc179f7eb6486b49dcaa4eb35a32abb134a6bc006cb7150689f955" ||
    target.lockfileVersion !== 3 ||
    target.packageManager !== "npm" ||
    target.readinessUrl !== expectedReadinessUrl ||
    target.startCommand !== "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort" ||
    target.viteObservedVersion !== "7.3.1"
  ) {
    throw new EvidenceCliError(`${path}.target: core target environment does not match`);
  }
}

function validateOutcomeContract(value: unknown): void {
  const path = "outcome-contract.json";
  const contract = asObject(value, path);
  assertExactKeys(
    contract,
    [
      "authoritativeOutcome",
      "checkpoints",
      "contractId",
      "controlledPrecondition",
      "excludedOracles",
      "expectedPreFixFirstFailedCheckpoint",
      "hydrationBarrier",
      "resultClasses",
      "schemaVersion",
    ],
    path,
  );
  asSchemaVersion(contract, path);
  if (
    contract.contractId !== "safe-unfollow-163-upload-recovery" ||
    contract.expectedPreFixFirstFailedCheckpoint !== "processing-cleared"
  ) {
    throw new EvidenceCliError(`${path}: contract identity does not match`);
  }
  expectStringArray(
    contract.resultClasses,
    [
      "pass",
      "functional-failure",
      "inconclusive",
      "target-startup-error",
      "browser-runtime-error",
      "reset-error",
    ],
    `${path}.resultClasses`,
  );
  expectStringArray(
    contract.excludedOracles,
    ["model-self-report", "screenshot-matching", "storage-rewrite"],
    `${path}.excludedOracles`,
  );
  const precondition = asObject(contract.controlledPrecondition, `${path}.controlledPrecondition`);
  assertExactKeys(
    precondition,
    ["state", "storageKey", "storageVersion"],
    `${path}.controlledPrecondition`,
  );
  if (precondition.storageKey !== "unfollow-radar-store" || precondition.storageVersion !== 5) {
    throw new EvidenceCliError(`${path}.controlledPrecondition: storage identity does not match`);
  }
  const state = asObject(precondition.state, `${path}.controlledPrecondition.state`);
  assertExactKeys(
    state,
    ["currentFileName", "fileMetadata", "filters", "language", "uploadError", "uploadStatus"],
    `${path}.controlledPrecondition.state`,
  );
  if (state.uploadStatus !== "loading" || state.currentFileName !== "interrupted.zip") {
    throw new EvidenceCliError(`${path}.controlledPrecondition.state: interrupted state missing`);
  }
  const hydration = asObject(contract.hydrationBarrier, `${path}.hydrationBarrier`);
  assertExactKeys(
    hydration,
    ["clientFrames", "pageLoadState", "timeoutMs"],
    `${path}.hydrationBarrier`,
  );
  expectEqual(
    hydration,
    { clientFrames: 2, pageLoadState: "networkidle", timeoutMs: 10_000 },
    `${path}.hydrationBarrier`,
  );
  const checkpoints = asArray(contract.checkpoints, `${path}.checkpoints`);
  const expectedIds = [
    "upload-page-ready",
    "processing-cleared",
    "processing-announcement-cleared",
    "file-input-enabled",
    "idle-prompt-visible",
  ];
  expectEqual(
    checkpoints.map((entry, index) => {
      const checkpoint = asObject(entry, `${path}.checkpoints[${index}]`);
      assertExactKeys(
        checkpoint,
        ["accessibleName", "category", "expected", "id", "observation"],
        `${path}.checkpoints[${index}]`,
      );
      return checkpoint.id;
    }),
    expectedIds,
    `${path}.checkpoints`,
  );
}

function validateResetProtocol(value: unknown): void {
  const path = "reset-protocol.json";
  const reset = asObject(value, path);
  assertExactKeys(
    reset,
    [
      "contextReuse",
      "fixture",
      "perAttempt",
      "protocolId",
      "resetPostcondition",
      "resetResource",
      "retries",
      "schemaVersion",
      "steps",
    ],
    path,
  );
  asSchemaVersion(reset, path);
  if (
    reset.contextReuse !== false ||
    reset.perAttempt !== true ||
    reset.protocolId !== "fresh-context-origin-reset-v1" ||
    reset.resetResource !== "/robots.txt" ||
    reset.retries !== 0
  ) {
    throw new EvidenceCliError(`${path}: core reset protocol does not match`);
  }
  const fixture = asObject(reset.fixture, `${path}.fixture`);
  assertExactKeys(fixture, ["key", "value"], `${path}.fixture`);
  if (fixture.key !== "unfollow-radar-store") {
    throw new EvidenceCliError(`${path}.fixture.key: unexpected value`);
  }
  const fixtureValue = asObject(fixture.value, `${path}.fixture.value`);
  assertExactKeys(fixtureValue, ["state", "version"], `${path}.fixture.value`);
  if (fixtureValue.version !== 5)
    throw new EvidenceCliError(`${path}.fixture.value.version: expected 5`);
  const resetState = asObject(fixtureValue.state, `${path}.fixture.value.state`);
  assertExactKeys(
    resetState,
    ["currentFileName", "fileMetadata", "filters", "language", "uploadError", "uploadStatus"],
    `${path}.fixture.value.state`,
  );
  if (resetState.uploadStatus !== "loading" || resetState.currentFileName !== "interrupted.zip") {
    throw new EvidenceCliError(`${path}.fixture.value.state: interrupted state missing`);
  }
  const postcondition = asObject(reset.resetPostcondition, `${path}.resetPostcondition`);
  assertExactKeys(
    postcondition,
    [
      "cacheStorageEntriesBeforeSeed",
      "cookies",
      "indexedDbDatabasesBeforeSeed",
      "localStorageEntriesBeforeSeed",
      "serviceWorkerRegistrationsBeforeSeed",
      "sessionStorageEntriesBeforeSeed",
    ],
    `${path}.resetPostcondition`,
  );
  expectEqual(
    postcondition,
    {
      cacheStorageEntriesBeforeSeed: 0,
      cookies: 0,
      indexedDbDatabasesBeforeSeed: 0,
      localStorageEntriesBeforeSeed: 0,
      serviceWorkerRegistrationsBeforeSeed: 0,
      sessionStorageEntriesBeforeSeed: 0,
    },
    `${path}.resetPostcondition`,
  );
  expectStringArray(
    reset.steps,
    [
      "verify-target-readiness",
      "create-fresh-browser-context",
      "block-non-loopback-requests",
      "clear-cookies",
      "visit-script-free-loopback-origin-resource",
      "clear-local-storage",
      "clear-session-storage",
      "delete-indexeddb-databases",
      "delete-cache-storage",
      "unregister-service-workers",
      "verify-origin-storage-empty",
      "seed-minimum-versioned-fixture",
      "navigate-to-upload-page",
      "wait-for-bounded-hydration",
      "execute-outcome-contract",
      "close-browser-context",
    ],
    `${path}.steps`,
  );
}

function validateMinimizationBaseline(value: unknown): void {
  const path = "minimization-baseline.json";
  const baseline = asObject(value, path);
  assertExactKeys(
    baseline,
    [
      "baselineDifferential",
      "deletionCandidates",
      "originalActionCount",
      "schemaVersion",
      "traceId",
    ],
    path,
  );
  asSchemaVersion(baseline, path);
  if (baseline.originalActionCount !== 2 || baseline.traceId !== "safe-unfollow-163-candidate-v1") {
    throw new EvidenceCliError(`${path}: trace identity or action count does not match`);
  }
  const differential = asObject(baseline.baselineDifferential, `${path}.baselineDifferential`);
  assertExactKeys(
    differential,
    ["firstFailedCheckpoint", "observed", "postFix", "preFix"],
    `${path}.baselineDifferential`,
  );
  if (
    differential.firstFailedCheckpoint !== "processing-cleared" ||
    differential.preFix !== "functional-failure" ||
    differential.postFix !== "not-yet-evaluated"
  ) {
    throw new EvidenceCliError(`${path}.baselineDifferential: unexpected value`);
  }
  if (asArray(baseline.deletionCandidates, `${path}.deletionCandidates`).length !== 2) {
    throw new EvidenceCliError(`${path}.deletionCandidates: expected two candidates`);
  }
}

function validateMinimizationLog(value: unknown): void {
  const path = "minimization-log.json";
  const log = asObject(value, path);
  assertExactKeys(
    log,
    [
      "baselineDifferential",
      "decision",
      "deletionCandidates",
      "minimizedActionCount",
      "originalActionCount",
      "schemaVersion",
      "traceId",
    ],
    path,
  );
  asSchemaVersion(log, path);
  if (
    log.originalActionCount !== 2 ||
    log.minimizedActionCount !== 2 ||
    log.traceId !== "safe-unfollow-163-candidate-v1"
  ) {
    throw new EvidenceCliError(`${path}: trace identity or action counts do not match`);
  }
  const differential = asObject(log.baselineDifferential, `${path}.baselineDifferential`);
  assertExactKeys(differential, ["postFix", "preFix"], `${path}.baselineDifferential`);
  expectEqual(
    differential,
    { postFix: "pass", preFix: "functional-failure-at-processing-cleared" },
    `${path}.baselineDifferential`,
  );
  expectEqual(
    log.deletionCandidates,
    [
      {
        actionId: "navigate-for-reset",
        decision: "retained",
        eligible: false,
        reason:
          "Required to establish a script-free local origin before reset and storage seeding.",
      },
      {
        actionId: "navigate-after-seed",
        decision: "retained",
        eligible: true,
        postFixTrial: {
          classification: "inconclusive",
          path: "/robots.txt",
          reset: "fresh-context",
          uploadPageReady: false,
        },
        preFixTrial: {
          classification: "inconclusive",
          path: "/robots.txt",
          reset: "fresh-context",
          uploadPageReady: false,
        },
        reason:
          "Removing the action prevents the unchanged outcome contract from observing /upload and destroys the differential.",
      },
    ],
    `${path}.deletionCandidates`,
  );
}

function validateDataHandling(value: unknown): void {
  const path = "data-handling-report.json";
  const report = asObject(value, path);
  assertExactKeys(
    report,
    [
      "browserState",
      "caseId",
      "cleanup",
      "committedEvidence",
      "dataExcluded",
      "dataUsed",
      "rawArtifacts",
      "runtimeNetwork",
      "schemaVersion",
    ],
    path,
  );
  asSchemaVersion(report, path);
  if (report.caseId !== expectedCaseId)
    throw new EvidenceCliError(`${path}.caseId: unexpected value`);
  const browserState = asObject(report.browserState, `${path}.browserState`);
  assertExactKeys(
    browserState,
    ["contextReuse", "cookiesPersisted", "fixtureContainsPersonalData", "fixtureFileName"],
    `${path}.browserState`,
  );
  expectEqual(
    browserState,
    {
      contextReuse: false,
      cookiesPersisted: false,
      fixtureContainsPersonalData: false,
      fixtureFileName: "interrupted.zip",
    },
    `${path}.browserState`,
  );
  const cleanup = asObject(report.cleanup, `${path}.cleanup`);
  assertExactKeys(
    cleanup,
    ["browserContextsClosed", "targetServersStopped", "targetSourceModified"],
    `${path}.cleanup`,
  );
  expectEqual(
    cleanup,
    { browserContextsClosed: true, targetServersStopped: true, targetSourceModified: false },
    `${path}.cleanup`,
  );
  const committed = asObject(report.committedEvidence, `${path}.committedEvidence`);
  assertExactKeys(
    committed,
    ["absoluteLocalPaths", "failedAttemptsRetained", "hashManifest", "portablePaths"],
    `${path}.committedEvidence`,
  );
  expectEqual(
    committed,
    {
      absoluteLocalPaths: false,
      failedAttemptsRetained: true,
      hashManifest: true,
      portablePaths: true,
    },
    `${path}.committedEvidence`,
  );
  expectStringArray(
    report.dataExcluded,
    [
      "Instagram exports",
      "personal data",
      "external accounts",
      "cookies",
      "credentials",
      "authorization values",
      "hosted deployment data",
      "screenshots",
      "videos",
      "traces",
      "raw network bodies",
    ],
    `${path}.dataExcluded`,
  );
  if (asArray(report.dataUsed, `${path}.dataUsed`).length !== 4) {
    throw new EvidenceCliError(`${path}.dataUsed: expected four minimized inputs`);
  }
  const raw = asObject(report.rawArtifacts, `${path}.rawArtifacts`);
  assertExactKeys(raw, ["committed", "location", "reason"], `${path}.rawArtifacts`);
  if (raw.committed !== false || raw.location !== "ignored local output directory") {
    throw new EvidenceCliError(`${path}.rawArtifacts: raw reports must remain uncommitted`);
  }
  const network = asObject(report.runtimeNetwork, `${path}.runtimeNetwork`);
  assertExactKeys(
    network,
    ["browserPolicy", "networkCapture", "targetBinding"],
    `${path}.runtimeNetwork`,
  );
  expectEqual(
    network,
    {
      browserPolicy: "abort non-loopback requests",
      networkCapture: false,
      targetBinding: "127.0.0.1:4173",
    },
    `${path}.runtimeNetwork`,
  );
}

function validateCandidateTrace(value: unknown): void {
  const path = "candidate-trace.json";
  const trace = asObject(value, path);
  assertExactKeys(
    trace,
    [
      "actionCount",
      "actions",
      "modelCalls",
      "requiredNonActions",
      "schemaVersion",
      "source",
      "traceId",
    ],
    path,
  );
  asSchemaVersion(trace, path);
  if (
    trace.actionCount !== 2 ||
    trace.modelCalls !== 0 ||
    trace.source !== "pre-fix-runtime-observation-and-user-issue-snapshot" ||
    trace.traceId !== "safe-unfollow-163-candidate-v1"
  ) {
    throw new EvidenceCliError(`${path}: trace identity, count, or model calls do not match`);
  }
  const actions = asArray(trace.actions, `${path}.actions`);
  expectEqual(
    actions.map((entry, index) => {
      const action = asObject(entry, `${path}.actions[${index}]`);
      assertExactKeys(action, ["id", "kind", "purpose", "target"], `${path}.actions[${index}]`);
      return action;
    }),
    [
      {
        id: "navigate-for-reset",
        kind: "navigate",
        purpose: "establish-script-free-origin-for-explicit-reset",
        target: "/robots.txt",
      },
      {
        id: "navigate-after-seed",
        kind: "navigate",
        purpose: "rehydrate-interrupted-analysis-state",
        target: "/upload",
      },
    ],
    `${path}.actions`,
  );
  expectStringArray(
    trace.requiredNonActions,
    [
      "fresh-context",
      "origin-storage-reset",
      "versioned-storage-fixture",
      "bounded-hydration-barrier",
      "independent-outcome-checkpoints",
    ],
    `${path}.requiredNonActions`,
  );
}

function validateCaseMetadata(value: unknown): void {
  const path = caseMetadataPath;
  const metadata = asObject(value, path);
  assertExactKeys(
    metadata,
    [
      "authoritativeCheckpoints",
      "browser",
      "caseId",
      "externalPrerequisites",
      "postFixRevision",
      "preFixRevision",
      "runner",
      "schemaVersion",
      "standalone",
      "targetBaseUrl",
      "targetBaseUrlOverride",
      "testFile",
      "testSha256",
    ],
    path,
  );
  asSchemaVersion(metadata, path);
  if (
    metadata.caseId !== expectedCaseId ||
    metadata.preFixRevision !== expectedPreFixRevision ||
    metadata.postFixRevision !== expectedPostFixRevision ||
    metadata.runner !== "@playwright/test@1.62.1" ||
    metadata.targetBaseUrl !== "http://127.0.0.1:4173" ||
    metadata.targetBaseUrlOverride !== "TARGET_BASE_URL" ||
    metadata.testFile !== "generated/safe-unfollow-163.spec.ts" ||
    typeof metadata.testSha256 !== "string" ||
    !sha256Pattern.test(metadata.testSha256)
  ) {
    throw new EvidenceCliError(`${path}: core metadata does not match`);
  }
  expectStringArray(
    metadata.authoritativeCheckpoints,
    [
      "processing-cleared",
      "processing-announcement-cleared",
      "file-input-enabled",
      "idle-prompt-visible",
    ],
    `${path}.authoritativeCheckpoints`,
  );
  const browser = asObject(metadata.browser, `${path}.browser`);
  assertExactKeys(
    browser,
    ["headless", "name", "retries", "screenshot", "trace", "video", "viewport", "workers"],
    `${path}.browser`,
  );
  const viewport = asObject(browser.viewport, `${path}.browser.viewport`);
  assertExactKeys(viewport, ["height", "width"], `${path}.browser.viewport`);
  expectEqual(viewport, { height: 720, width: 1280 }, `${path}.browser.viewport`);
  if (
    browser.headless !== true ||
    browser.name !== "chromium" ||
    browser.retries !== 0 ||
    browser.screenshot !== "off" ||
    browser.trace !== "off" ||
    browser.video !== "off" ||
    browser.workers !== 1
  ) {
    throw new EvidenceCliError(`${path}.browser: frozen runner settings do not match`);
  }
  const prerequisites = asObject(metadata.externalPrerequisites, `${path}.externalPrerequisites`);
  assertExactKeys(
    prerequisites,
    ["installCommand", "readinessUrl", "resetProtocol", "startCommand"],
    `${path}.externalPrerequisites`,
  );
  expectEqual(
    prerequisites,
    {
      installCommand: "npm ci",
      readinessUrl: expectedReadinessUrl,
      resetProtocol: "../reset-protocol.json",
      startCommand: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort",
    },
    `${path}.externalPrerequisites`,
  );
  const standalone = asObject(metadata.standalone, `${path}.standalone`);
  assertExactKeys(
    standalone,
    ["imports", "modelCalls", "reproLockRuntimeImports"],
    `${path}.standalone`,
  );
  expectEqual(
    standalone,
    { imports: ["@playwright/test"], modelCalls: 0, reproLockRuntimeImports: 0 },
    `${path}.standalone`,
  );
}

const coreEvidenceValidators: Readonly<Record<string, (value: unknown) => void>> = {
  "candidate-trace.json": validateCandidateTrace,
  "data-handling-report.json": validateDataHandling,
  "environment.json": validateEnvironment,
  "generated/safe-unfollow-163.meta.json": validateCaseMetadata,
  "minimization-baseline.json": validateMinimizationBaseline,
  "minimization-log.json": validateMinimizationLog,
  "outcome-contract.json": validateOutcomeContract,
  "reset-protocol.json": validateResetProtocol,
  "scope.json": validateScope,
  "target-provenance.json": validateTargetProvenance,
};

async function verifyCoreEvidence(root: string, issues: VerificationIssue[]): Promise<void> {
  for (const path of Object.keys(coreEvidenceValidators).sort(compareText)) {
    const validate = coreEvidenceValidators[path];
    if (validate === undefined) continue;
    try {
      validate(await readBundleJson(root, path));
    } catch (error) {
      issues.push(
        verificationIssue(
          "core-evidence",
          path,
          diagnostic(error, "Core evidence validation failed"),
        ),
      );
    }
  }
}

async function parseCommittedAttempts(
  root: string,
  issues: VerificationIssue[],
): Promise<readonly AttemptRecord[]> {
  try {
    const contents = await readBundleText(root, attemptsPath);
    if (contents.length === 0 || contents.endsWith("\n")) {
      throw new EvidenceCliError("attempts.jsonl must be non-empty without a trailing blank line");
    }
    const records = contents.split("\n").map((line, index) => {
      if (line.length === 0)
        throw new EvidenceCliError(`attempts.jsonl line ${index + 1} is empty`);
      let value: unknown;
      try {
        value = JSON.parse(line) as unknown;
      } catch (error) {
        throw new EvidenceCliError(`attempts.jsonl line ${index + 1} is invalid JSON`, {
          cause: error,
        });
      }
      return parseAttemptRecord(value, `attempts[${index}]`);
    });
    if (serializeAttemptsJsonl(records) !== contents) {
      issues.push(
        verificationIssue(
          "attempts-canonical",
          attemptsPath,
          "Attempt records are not canonically ordered and serialized",
        ),
      );
    }
    return records;
  } catch (error) {
    issues.push(
      verificationIssue(
        "attempts-invalid",
        attemptsPath,
        diagnostic(error, "Attempt parsing failed"),
      ),
    );
    return [];
  }
}

async function verifyAttemptGate(
  root: string,
  issues: VerificationIssue[],
): Promise<readonly AttemptRecord[]> {
  const attempts = await parseCommittedAttempts(root, issues);
  if (attempts.length === 0) return attempts;
  try {
    const metadata = await loadCaseMetadata(root);
    const result = verifyRepetitionGate(attempts, {
      expectedCaseId: metadata.caseId,
      postFixRevision: metadata.postFixRevision,
      preFixRevision: metadata.preFixRevision,
      specSha256: metadata.testSha256,
    });
    for (const entry of result.issues) {
      issues.push(verificationIssue(`gate-${entry.code}`, entry.subject, entry.message));
    }
  } catch (error) {
    issues.push(
      verificationIssue("gate-invalid", attemptsPath, diagnostic(error, "Attempt gate failed")),
    );
  }
  return attempts;
}

async function verifyMaterializedSummaries(
  root: string,
  attempts: readonly AttemptRecord[],
  issues: VerificationIssue[],
): Promise<void> {
  try {
    const differential = await readBundleJson(root, "differential-summary.json");
    const replay = await readBundleJson(root, "replay-summary.json");
    const recorder = await readBundleJson(root, "baseline/recorder-comparison.json");
    const differentialObject = asObject(differential, "differential-summary.json");
    const rawReports = parseRawReportEvidence(
      differentialObject.rawReports,
      "differential-summary.json.rawReports",
    );
    const metadata = await loadCaseMetadata(root);
    const candidateActionCount = await loadCandidateActionCount(root);
    const baselineSource = await readBundleText(root, baselineSpecPath);
    const expected = buildMaterializedDocuments({
      baselineNavigationActionCount: countOccurrences(baselineSource, "await page.goto("),
      baselineSpecSha256: sha256(baselineSource),
      candidateActionCount,
      metadata,
      rawReports,
    });
    for (const [path, actual, wanted] of [
      ["baseline/recorder-comparison.json", recorder, expected.recorderComparison],
      ["differential-summary.json", differential, expected.differentialSummary],
      ["replay-summary.json", replay, expected.replaySummary],
    ] as const) {
      if (serializeCanonicalJson(actual) !== serializeCanonicalJson(wanted)) {
        issues.push(
          verificationIssue(
            "summary-cross-check",
            path,
            "Summary does not match attempts, frozen metadata, or source evidence",
          ),
        );
      }
    }

    const preFixAttempts = attempts.filter((attempt) => attempt.side === "pre-fix");
    const postFixAttempts = attempts.filter((attempt) => attempt.side === "post-fix");
    if (
      preFixAttempts.length !== generatedAttemptCount ||
      postFixAttempts.length !== generatedAttemptCount ||
      attempts.some((attempt) => attempt.specSha256 !== metadata.testSha256)
    ) {
      issues.push(
        verificationIssue(
          "summary-attempt-cross-check",
          attemptsPath,
          "Attempt counts or test hashes do not match materialized summaries",
        ),
      );
    }
  } catch (error) {
    issues.push(
      verificationIssue(
        "summary-invalid",
        "differential-summary.json",
        diagnostic(error, "Summary verification failed"),
      ),
    );
  }
}

function jsonLines(contents: string, path: string): readonly unknown[] {
  if (contents.length === 0) throw new EvidenceCliError(`${path}: empty JSONL`);
  return contents.split("\n").map((line, index) => {
    if (line.length === 0) throw new EvidenceCliError(`${path}:${index + 1}: empty line`);
    try {
      return JSON.parse(line) as unknown;
    } catch (error) {
      throw new EvidenceCliError(`${path}:${index + 1}: invalid JSON`, { cause: error });
    }
  });
}

async function verifyMachineSchemaVersions(
  root: string,
  issues: VerificationIssue[],
): Promise<void> {
  for (const path of await walkBundleFiles(root)) {
    const extension = extname(path).toLowerCase();
    if (extension !== ".json" && extension !== ".jsonl") continue;
    if (path === "baseline/tsconfig.json" || path === "generated/tsconfig.json") continue;
    try {
      const contents = await readBundleText(root, path);
      const values = extension === ".jsonl" ? jsonLines(contents, path) : [JSON.parse(contents)];
      const canonical =
        extension === ".jsonl"
          ? values.map((value) => serializeCanonicalJson(value).slice(0, -1)).join("\n")
          : serializeCanonicalJson(values[0]);
      if (contents !== canonical) {
        issues.push(
          verificationIssue(
            "machine-json-canonical",
            path,
            "Machine evidence is not canonically serialized",
          ),
        );
      }
      for (const [index, value] of values.entries()) {
        const object = asObject(value, `${path}[${index}]`);
        if (object.schemaVersion !== 1) {
          issues.push(
            verificationIssue(
              "schema-version",
              extension === ".jsonl" ? `${path}:${index + 1}` : path,
              "Machine evidence schemaVersion must be 1",
            ),
          );
        }
      }
    } catch (error) {
      issues.push(
        verificationIssue(
          "machine-json-invalid",
          path,
          diagnostic(error, "Machine evidence is invalid"),
        ),
      );
    }
  }
}

const textExtensions = new Set([".json", ".jsonl", ".md", ".mjs", ".ts", ".txt"]);
const allowedUrlPattern =
  /https:\/\/[^\s"'<>]+|http:\/\/(?:127(?:\.\d{1,3}){3}|localhost|\[::1\])(?::\d+)?[^\s"'<>]*/giu;
const regexEscapedBackslash = String.fromCharCode(92).repeat(2);
const regexUncPrefix = String.fromCharCode(92).repeat(4);
const regexWhitespace = `${String.fromCharCode(92)}s`;
const windowsAbsolutePathPattern = new RegExp(
  `(?:^|[^a-z0-9])(?:[a-z]:[${regexEscapedBackslash}/]|${regexUncPrefix}[^${regexEscapedBackslash}/${regexWhitespace}]+[${regexEscapedBackslash}/])`,
  "iu",
);
const commonPosixAbsolutePathPattern =
  /(?:^|[\s"'`(=:[])\/(?:home|Users|tmp|private|var\/tmp|opt|mnt|workspace|root)(?:\/|$)/u;

function containsLocalAbsolutePath(contents: string): boolean {
  const withoutAllowedUrls = contents.replace(allowedUrlPattern, "");
  return (
    windowsAbsolutePathPattern.test(withoutAllowedUrls) ||
    commonPosixAbsolutePathPattern.test(withoutAllowedUrls) ||
    /file:\/\//iu.test(withoutAllowedUrls) ||
    /http:\/\//iu.test(withoutAllowedUrls)
  );
}

async function verifyPortableText(root: string, issues: VerificationIssue[]): Promise<void> {
  for (const path of await walkBundleFiles(root)) {
    if (!textExtensions.has(extname(path).toLowerCase())) continue;
    const contents = await readBundleText(root, path);
    if (containsLocalAbsolutePath(contents)) {
      issues.push(
        verificationIssue(
          "absolute-local-path",
          path,
          "Bundle text contains a non-portable absolute local path or non-loopback HTTP URL",
        ),
      );
    }
  }
}

/** Verify the manifest, frozen files, repetition gate, schema versions, and portable text. */
export async function verifyEvidenceBundle(bundleRoot: string): Promise<VerifySummary> {
  const root = await ensureBundleRoot(bundleRoot);
  const issues: VerificationIssue[] = [];
  await verifyRequiredFiles(root, issues);
  await verifyManifest(root, issues);
  await verifyFrozenHashes(root, issues);
  await verifyCoreEvidence(root, issues);
  const attempts = await verifyAttemptGate(root, issues);
  await verifyMaterializedSummaries(root, attempts, issues);
  await verifyMachineSchemaVersions(root, issues);
  await verifyPortableText(root, issues);
  const sortedIssues = sortIssues(issues);
  return {
    command: "verify",
    issues: sortedIssues,
    ok: sortedIssues.length === 0,
    schemaVersion: 1,
  };
}

type ParsedCli =
  | { readonly command: "manifest" | "verify"; readonly options: ReadonlyMap<string, string> }
  | { readonly command: "materialize"; readonly options: ReadonlyMap<string, string> };

function parseCli(argv: readonly string[]): ParsedCli {
  const command = argv[0];
  if (command !== "materialize" && command !== "manifest" && command !== "verify") {
    throw new EvidenceCliError("Expected command: materialize, manifest, or verify");
  }
  const options = new Map<string, string>();
  for (let index = 1; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === undefined || !flag.startsWith("--") || value === undefined) {
      throw new EvidenceCliError("CLI options must be --name value pairs");
    }
    if (options.has(flag)) throw new EvidenceCliError(`Duplicate option: ${flag}`);
    options.set(flag, value);
  }
  const allowed =
    command === "materialize"
      ? new Set([
          "--bundle-root",
          "--generated-pre",
          "--generated-post",
          "--baseline-pre",
          "--baseline-post",
        ])
      : new Set(["--bundle-root"]);
  for (const flag of options.keys()) {
    if (!allowed.has(flag)) throw new EvidenceCliError(`Unknown option for ${command}: ${flag}`);
  }
  for (const flag of allowed) {
    if (!options.has(flag)) throw new EvidenceCliError(`Missing required option: ${flag}`);
  }
  return { command, options };
}

function option(options: ReadonlyMap<string, string>, flag: string): string {
  const value = options.get(flag);
  if (value === undefined) throw new EvidenceCliError(`Missing required option: ${flag}`);
  return value;
}

/** Execute one CLI command and emit exactly one canonical JSON summary. */
export async function runEvidenceCli(
  argv: readonly string[],
  io: EvidenceCliIo = { write: (text) => process.stdout.write(text) },
): Promise<number> {
  let command = "unknown";
  try {
    const parsed = parseCli(argv);
    command = parsed.command;
    const bundleRoot = option(parsed.options, "--bundle-root");
    const summary =
      parsed.command === "materialize"
        ? await materializeEvidenceBundle({
            baselinePostReport: option(parsed.options, "--baseline-post"),
            baselinePreReport: option(parsed.options, "--baseline-pre"),
            bundleRoot,
            generatedPostReport: option(parsed.options, "--generated-post"),
            generatedPreReport: option(parsed.options, "--generated-pre"),
          })
        : parsed.command === "manifest"
          ? await writeEvidenceManifest(bundleRoot)
          : await verifyEvidenceBundle(bundleRoot);
    io.write(serializeCanonicalJson(summary));
    return summary.ok ? 0 : 1;
  } catch (error) {
    io.write(
      serializeCanonicalJson({
        command,
        error: diagnostic(error, "Unknown evidence CLI failure"),
        ok: false,
        schemaVersion: 1,
      }),
    );
    return 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint !== undefined && pathToFileURL(resolve(entryPoint)).href === import.meta.url) {
  runEvidenceCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
