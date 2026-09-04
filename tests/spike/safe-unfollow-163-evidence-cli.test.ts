import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import {
  materializeEvidenceBundle,
  runEvidenceCli,
  verifyEvidenceBundle,
  writeEvidenceManifest,
} from "../../spikes/local-functional-regression/tools/evidence-cli.ts";
import { serializeCanonicalJson } from "../../src/evidence/canonical-json.ts";

type Fixture = {
  readonly baselinePost: string;
  readonly baselinePre: string;
  readonly bundleRoot: string;
  readonly generatedPost: string;
  readonly generatedPre: string;
};

async function withTemporaryRoot(run: (root: string) => Promise<void>): Promise<void> {
  const prefix = resolve(tmpdir(), "reprolock-evidence-cli-");
  const root = await mkdtemp(prefix);
  assert.equal(resolve(root).startsWith(prefix), true);
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function write(root: string, relativePath: string, contents: string): Promise<string> {
  const path = join(root, ...relativePath.split("/"));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, "utf8");
  return path;
}

function reporter(results: readonly unknown[], kind: "baseline" | "generated"): unknown {
  const isGenerated = kind === "generated";
  const specFile = isGenerated ? "safe-unfollow-163.spec.ts" : "safe-unfollow-163-recorder.spec.ts";
  const title = isGenerated
    ? "recovers the upload page after interrupted local analysis"
    : "upload is usable after an interrupted analysis";
  return {
    config: {
      configFile: `C:\\workspace\\spikes\\local-functional-regression\\${kind}\\playwright.config.ts`,
      projects: [{ name: "", repeatEach: 20, retries: 0 }],
      workers: 1,
    },
    errors: [],
    suites: [
      {
        specs: results.map((result, index) => ({
          file: specFile,
          id: `${kind}-${index}`,
          tests: [{ projectName: "", results: [result] }],
          title,
        })),
        suites: [],
        title: specFile,
      },
    ],
  };
}

function repeatedResult(result: unknown): readonly unknown[] {
  return Array.from({ length: 20 }, () => result);
}

async function createFixture(root: string, invalidBaseline = false): Promise<Fixture> {
  const bundleRoot = join(root, "bundle");
  const rawRoot = join(root, "raw");
  await mkdir(bundleRoot, { recursive: true });
  await mkdir(rawRoot, { recursive: true });

  const sourceRoot = resolve("spikes/local-functional-regression");
  for (const path of [
    "baseline/playwright.config.ts",
    "baseline/safe-unfollow-163-recorder.spec.ts",
    "baseline/tsconfig.json",
    "candidate-trace.json",
    "data-handling-report.json",
    "environment.json",
    "frozen-hypothesis.json",
    "generated/playwright.config.ts",
    "generated/replay-safe-unfollow-163.mjs",
    "generated/safe-unfollow-163.meta.json",
    "generated/safe-unfollow-163.spec.ts",
    "generated/tsconfig.json",
    "inputs/safe-unfollow-163.md",
    "minimization-baseline.json",
    "minimization-log.json",
    "outcome-contract.json",
    "reset-protocol.json",
    "revalidation/2026-09-04/attempts.jsonl",
    "revalidation/2026-09-04/baseline/recorder-comparison.json",
    "revalidation/2026-09-04/differential-summary.json",
    "revalidation/2026-09-04/execution.json",
    "revalidation/2026-09-04/replay-summary.json",
    "scope.json",
    "target-provenance.json",
    "tools/evidence-cli.ts",
    "tools/evidence.ts",
  ]) {
    await write(bundleRoot, path, await readFile(join(sourceRoot, ...path.split("/")), "utf8"));
  }
  await write(bundleRoot, "SPIKE_REPORT.md", "# Portable Spike report\n");

  const generatedPreMessage =
    "Error: [functional-checkpoint:processing-cleared] expect(locator).toBeHidden() failed\n" +
    "Locator: Analyzing locally...\nExpected: hidden\nReceived: visible";
  const baselinePreMessage = invalidBaseline
    ? "Error: generic failure"
    : [
        "Error: expect(locator).toBeHidden() failed",
        "Locator: Analyzing locally...",
        "Expected: hidden",
        "Received: visible",
      ].join("\n");
  const passed = { duration: 2, errors: [], retry: 0, status: "passed" };
  const generatedPre = await write(
    rawRoot,
    "generated-pre.json",
    JSON.stringify(
      reporter(
        repeatedResult({
          duration: 3_000,
          errors: [{ message: generatedPreMessage }],
          retry: 0,
          status: "failed",
        }),
        "generated",
      ),
    ),
  );
  const generatedPost = await write(
    rawRoot,
    "generated-post.json",
    JSON.stringify(reporter(repeatedResult(passed), "generated")),
  );
  const baselinePre = await write(
    rawRoot,
    "baseline-pre.json",
    JSON.stringify(
      reporter(
        repeatedResult({
          duration: 3_000,
          errors: [{ message: baselinePreMessage }],
          retry: 0,
          status: "failed",
        }),
        "baseline",
      ),
    ),
  );
  const baselinePost = await write(
    rawRoot,
    "baseline-post.json",
    JSON.stringify(reporter(repeatedResult(passed), "baseline")),
  );
  return { baselinePost, baselinePre, bundleRoot, generatedPost, generatedPre };
}

async function materialize(fixture: Fixture): Promise<void> {
  await materializeEvidenceBundle({
    baselinePostReport: fixture.baselinePost,
    baselinePreReport: fixture.baselinePre,
    bundleRoot: fixture.bundleRoot,
    generatedPostReport: fixture.generatedPost,
    generatedPreReport: fixture.generatedPre,
  });
}

test("materialize, manifest, and verify produce a portable canonical evidence bundle", async () => {
  await withTemporaryRoot(async (root) => {
    const fixture = await createFixture(root);
    let materializeOutput = "";
    const materializeExit = await runEvidenceCli(
      [
        "materialize",
        "--bundle-root",
        fixture.bundleRoot,
        "--generated-pre",
        fixture.generatedPre,
        "--generated-post",
        fixture.generatedPost,
        "--baseline-pre",
        fixture.baselinePre,
        "--baseline-post",
        fixture.baselinePost,
      ],
      { write: (text) => (materializeOutput += text) },
    );
    assert.equal(materializeExit, 0);
    const summary = JSON.parse(materializeOutput) as { files?: readonly string[] };
    assert.deepEqual(summary.files, [
      "attempts.jsonl",
      "baseline/recorder-comparison.json",
      "differential-summary.json",
      "replay-summary.json",
    ]);

    const attempts = await readFile(join(fixture.bundleRoot, "attempts.jsonl"), "utf8");
    assert.equal(attempts.split("\n").length, 40);
    assert.equal(attempts.endsWith("\n"), false);
    assert.equal(attempts.includes("Analyzing locally..."), false);
    assert.equal(attempts.includes(root), false);
    assert.equal(JSON.parse(attempts.split("\n")[0] ?? "{}").classification, "functional-failure");
    assert.equal(JSON.parse(attempts.split("\n")[39] ?? "{}").classification, "pass");

    const differentialText = await readFile(
      join(fixture.bundleRoot, "differential-summary.json"),
      "utf8",
    );
    assert.equal(differentialText.includes(root), false);
    const differential = JSON.parse(differentialText) as {
      rawReports?: Readonly<Record<string, { configFile?: string; sha256?: string }>>;
    };
    assert.deepEqual(Object.keys(differential.rawReports ?? {}).sort(), [
      "baselinePost",
      "baselinePre",
      "generatedPost",
      "generatedPre",
    ]);
    for (const report of Object.values(differential.rawReports ?? {})) {
      assert.match(report.sha256 ?? "", /^[a-f0-9]{64}$/u);
      assert.equal(report.configFile?.includes(root), false);
    }
    const comparison = JSON.parse(
      await readFile(join(fixture.bundleRoot, "baseline/recorder-comparison.json"), "utf8"),
    ) as { comparison?: Readonly<Record<string, unknown>> };
    assert.deepEqual(Object.keys(comparison.comparison ?? {}).sort(), [
      "actionCount",
      "businessOutcomeClarity",
      "failureMessageQuality",
      "maintenanceAssumptions",
      "preconditionClarity",
      "unnecessarySteps",
    ]);

    const manifestSummary = await writeEvidenceManifest(fixture.bundleRoot);
    assert.equal((manifestSummary.manifestEntries ?? 0) > 0, true);
    const manifest = JSON.parse(
      await readFile(join(fixture.bundleRoot, "manifest.json"), "utf8"),
    ) as { entries?: readonly { path?: string }[]; schemaVersion?: number };
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(
      manifest.entries?.some((entry) => entry.path === "manifest.json"),
      false,
    );

    const verification = await verifyEvidenceBundle(fixture.bundleRoot);
    assert.deepEqual(verification, { command: "verify", issues: [], ok: true, schemaVersion: 1 });
    const residualTemps = (await readdir(fixture.bundleRoot, { recursive: true })).filter((path) =>
      path.endsWith(".tmp"),
    );
    assert.deepEqual(residualTemps, []);

    let cliOutput = "";
    const exitCode = await runEvidenceCli(["verify", "--bundle-root", fixture.bundleRoot], {
      write: (text) => (cliOutput += text),
    });
    assert.equal(exitCode, 0);
    assert.deepEqual(JSON.parse(cliOutput), verification);
  });
});

test("materialize rejects a baseline without the observed visible/hidden failure semantics", async () => {
  await withTemporaryRoot(async (root) => {
    const fixture = await createFixture(root, true);
    await assert.rejects(materialize(fixture), /missing visible\/hidden failure semantics/u);
    await assert.rejects(readFile(join(fixture.bundleRoot, "attempts.jsonl"), "utf8"), {
      code: "ENOENT",
    });
  });
});

test("materialize validates report identity and business failure against frozen inputs", async () => {
  await withTemporaryRoot(async (root) => {
    const wrongSpec = await createFixture(join(root, "wrong-spec"));
    const wrongSpecContents = (await readFile(wrongSpec.generatedPre, "utf8")).replaceAll(
      "safe-unfollow-163.spec.ts",
      "different.spec.ts",
    );
    await writeFile(wrongSpec.generatedPre, wrongSpecContents, "utf8");
    await assert.rejects(materialize(wrongSpec), /spec file, title, or project does not match/u);

    const wrongConfig = await createFixture(join(root, "wrong-config"));
    const wrongConfigContents = (await readFile(wrongConfig.generatedPre, "utf8")).replace(
      '"repeatEach":20',
      '"repeatEach":19',
    );
    await writeFile(wrongConfig.generatedPre, wrongConfigContents, "utf8");
    await assert.rejects(materialize(wrongConfig), /repeatEach must be 20/u);

    const wrongBusinessFailure = await createFixture(join(root, "wrong-business-failure"));
    const wrongBusinessContents = (
      await readFile(wrongBusinessFailure.generatedPre, "utf8")
    ).replaceAll("Analyzing locally...", "Different state");
    await writeFile(wrongBusinessFailure.generatedPre, wrongBusinessContents, "utf8");
    await assert.rejects(materialize(wrongBusinessFailure), /missing Analyzing locally/u);
  });
});

test("verify rejects artifact tampering and committed absolute local paths", async () => {
  await withTemporaryRoot(async (root) => {
    const fixture = await createFixture(root);
    await materialize(fixture);
    await writeEvidenceManifest(fixture.bundleRoot);

    await writeFile(
      join(fixture.bundleRoot, "differential-summary.json"),
      serializeCanonicalJson({ schemaVersion: 1, tampered: true }),
      "utf8",
    );
    const hashFailure = await verifyEvidenceBundle(fixture.bundleRoot);
    assert.equal(hashFailure.ok, false);
    assert.equal(
      hashFailure.issues.some((issue) => issue.code === "manifest-manifest-sha256"),
      true,
    );

    await write(
      fixture.bundleRoot,
      "notes.md",
      "This must not contain C:\\Users\\example\\private-repository.\n",
    );
    await writeEvidenceManifest(fixture.bundleRoot);
    const pathFailure = await verifyEvidenceBundle(fixture.bundleRoot);
    assert.equal(pathFailure.ok, false);
    assert.equal(
      pathFailure.issues.some((issue) => issue.code === "absolute-local-path"),
      true,
    );
    assert.equal(
      pathFailure.issues.some((issue) => issue.code === "summary-invalid"),
      true,
    );

    await rm(join(fixture.bundleRoot, "SPIKE_REPORT.md"));
    await writeEvidenceManifest(fixture.bundleRoot);
    const requiredFailure = await verifyEvidenceBundle(fixture.bundleRoot);
    assert.equal(
      requiredFailure.issues.some((issue) => issue.code === "required-file"),
      true,
    );

    let output = "";
    const exitCode = await runEvidenceCli(["verify", "--bundle-root", fixture.bundleRoot], {
      write: (text) => (output += text),
    });
    assert.equal(exitCode, 1);
    const summary = JSON.parse(output) as { ok?: boolean; schemaVersion?: number };
    assert.equal(summary.ok, false);
    assert.equal(summary.schemaVersion, 1);
  });
});

test("materialize rejects duplicate attempts, hidden retries, and contradictory outcomes", async () => {
  await withTemporaryRoot(async (root) => {
    for (const variant of [
      "duplicate",
      "missing-retry",
      "extra-result",
      "empty-test",
      "post-error",
      "opaque-error",
      "timeout",
      "interrupted",
      "project",
    ]) {
      const fixture = await createFixture(join(root, variant));
      const path =
        variant === "post-error" || variant === "opaque-error"
          ? fixture.generatedPost
          : fixture.generatedPre;
      const report = JSON.parse(await readFile(path, "utf8"));
      const specs = report.suites[0].specs;
      if (variant === "duplicate") specs[1].id = specs[0].id;
      if (variant === "empty-test") specs[0].tests.push({ projectName: "", results: [] });
      if (variant === "missing-retry") delete specs[0].tests[0].results[0].retry;
      if (variant === "extra-result") {
        specs[0].tests[0].results.push(specs[1].tests[0].results[0]);
        specs.splice(1, 1);
      }
      if (variant === "post-error")
        specs[0].tests[0].results[0].errors = [{ message: "cleanup failed" }];
      if (variant === "opaque-error") specs[0].tests[0].results[0].errors = [{}];
      if (variant === "timeout") specs[0].tests[0].results[0].status = "timedOut";
      if (variant === "interrupted") specs[0].tests[0].results[0].status = "interrupted";
      if (variant === "project") report.config.projects[0].name = "different";
      await writeFile(path, JSON.stringify(report));
      await assert.rejects(materialize(fixture));
      await assert.rejects(readFile(join(fixture.bundleRoot, "attempts.jsonl")), {
        code: "ENOENT",
      });
    }
  });
});

test("materialize preserves prior evidence instead of replacing it with another run", async () => {
  await withTemporaryRoot(async (root) => {
    const fixture = await createFixture(root);
    await materialize(fixture);
    const summaryPath = join(fixture.bundleRoot, "differential-summary.json");
    const before = await readFile(summaryPath, "utf8");
    await writeFile(fixture.generatedPost, (await readFile(fixture.generatedPost, "utf8")) + "\n");
    await assert.rejects(materialize(fixture), /Existing run evidence differs/u);
    assert.equal(await readFile(summaryPath, "utf8"), before);
  });
});

test("verify rejects semantic minimization corruption even after manifest refresh", async () => {
  await withTemporaryRoot(async (root) => {
    const fixture = await createFixture(root);
    await materialize(fixture);
    const path = join(fixture.bundleRoot, "minimization-log.json");
    const log = JSON.parse(await readFile(path, "utf8"));
    log.deletionCandidates = [null, null];
    await writeFile(path, serializeCanonicalJson(log));
    await writeEvidenceManifest(fixture.bundleRoot);
    const result = await verifyEvidenceBundle(fixture.bundleRoot);
    assert.equal(result.ok, false);
    assert.equal(
      result.issues.some(
        (issue) => issue.code === "core-evidence" && issue.subject === "minimization-log.json",
      ),
      true,
    );
  });
});

test("CLI missing-file diagnostics do not reveal local paths", async () => {
  await withTemporaryRoot(async (root) => {
    let output = "";
    const exit = await runEvidenceCli(["verify", "--bundle-root", root], {
      write: (text) => {
        output += text;
      },
    });
    assert.equal(exit, 1);
    assert.equal(output.includes(root), false);
    assert.equal(output.includes(root.replaceAll("\\", "\\\\")), false);
  });
});

test("verify rejects dated execution contradictions after manifest refresh", async (t) => {
  await withTemporaryRoot(async (root) => {
    const fixture = await createFixture(root);
    await materialize(fixture);
    const path = "revalidation/2026-09-04/execution.json";
    const original = await readFile(join(fixture.bundleRoot, path), "utf8");
    for (const variant of [
      "generated-post-exit",
      "baseline-post-exit",
      "generated-pre-exit",
      "baseline-pre-exit",
      "duplicate-run",
      "missing-run",
      "unknown-kind",
      "unknown-side",
      "revision",
      "report-hash",
      "dirty-target",
      "lockfile",
      "source-hash",
      "missing-source",
      "unknown-source",
      "time-range",
      "cleanup-survivor",
      "cleanup-exit",
      "missing-cleanup",
    ]) {
      await t.test(variant, async () => {
        const capture = JSON.parse(original) as {
          runs: Record<string, unknown>[];
          sourceHashes: Record<string, unknown>;
          cleanup: Record<string, unknown>[];
          finishedAt: string;
        };
        const post = capture.runs[2];
        const baselinePost = capture.runs[3];
        const pre = capture.runs[0];
        const baselinePre = capture.runs[1];
        const cleanup = capture.cleanup[0];
        assert.ok(post && baselinePost && pre && baselinePre && cleanup);
        if (variant === "generated-post-exit") post.exitCode = 1;
        if (variant === "baseline-post-exit") baselinePost.exitCode = 1;
        if (variant === "generated-pre-exit") pre.exitCode = 0;
        if (variant === "baseline-pre-exit") baselinePre.exitCode = 0;
        if (variant === "duplicate-run") capture.runs[3] = { ...post };
        if (variant === "missing-run") capture.runs.pop();
        if (variant === "unknown-kind") post.kind = "other";
        if (variant === "unknown-side") post.side = "other";
        if (variant === "revision") post.revision = pre.revision;
        if (variant === "report-hash") post.rawReportSha256 = "0".repeat(64);
        if (variant === "dirty-target") post.cleanAfter = false;
        if (variant === "lockfile") post.lockfileSha256 = "0".repeat(64);
        if (variant === "source-hash")
          capture.sourceHashes["tools/evidence-cli.ts"] = "0".repeat(64);
        if (variant === "missing-source")
          delete capture.sourceHashes["generated/playwright.config.ts"];
        if (variant === "unknown-source") capture.sourceHashes["other.ts"] = "0".repeat(64);
        if (variant === "time-range") post.finishedAt = "2026-09-04T10:00:00.000Z";
        if (variant === "cleanup-survivor") cleanup.survivingOwnedProcesses = 1;
        if (variant === "cleanup-exit") cleanup.result = { status: "cancelled", exitCode: 0 };
        if (variant === "missing-cleanup") capture.cleanup.pop();
        await write(fixture.bundleRoot, path, serializeCanonicalJson(capture));
        await writeEvidenceManifest(fixture.bundleRoot);
        const result = await verifyEvidenceBundle(fixture.bundleRoot);
        assert.equal(result.ok, false, variant);
        assert.ok(
          result.issues.some(
            (issue) => issue.code === "revalidation-execution" && issue.subject === path,
          ),
        );
      });
    }
  });
});

test("dated attempts, summaries, and required records retain semantic gates", async (t) => {
  for (const variant of [
    "attempt",
    "differential",
    "replay",
    "baseline",
    "missing-execution",
    "missing-group",
  ]) {
    await t.test(variant, async () => {
      await withTemporaryRoot(async (root) => {
        const fixture = await createFixture(root);
        await materialize(fixture);
        const prefix = "revalidation/2026-09-04/";
        if (variant === "attempt") {
          const path = join(fixture.bundleRoot, prefix, "attempts.jsonl");
          const records = (await readFile(path, "utf8"))
            .split("\n")
            .map((line) => JSON.parse(line));
          records[20].retry = 1;
          await writeFile(
            path,
            records.map((record) => serializeCanonicalJson(record).trimEnd()).join("\n"),
          );
        } else if (variant === "missing-execution" || variant === "missing-group") {
          const paths =
            variant === "missing-execution"
              ? ["execution.json"]
              : [
                  "attempts.jsonl",
                  "baseline/recorder-comparison.json",
                  "differential-summary.json",
                  "execution.json",
                  "replay-summary.json",
                ];
          for (const path of paths) await rm(join(fixture.bundleRoot, prefix, path));
        } else {
          const filename =
            variant === "baseline"
              ? "baseline/recorder-comparison.json"
              : `${variant}-summary.json`;
          const path = join(fixture.bundleRoot, prefix, filename);
          const summary = JSON.parse(await readFile(path, "utf8"));
          if (variant === "differential") summary.postFix.passes = 19;
          if (variant === "replay") summary.rawReports.generatedPost.sha256 = "0".repeat(64);
          if (variant === "baseline") summary.baseline.postFixPasses = 19;
          await writeFile(path, serializeCanonicalJson(summary));
        }
        await writeEvidenceManifest(fixture.bundleRoot);
        const result = await verifyEvidenceBundle(fixture.bundleRoot);
        assert.equal(result.ok, false, variant);
        assert.ok(result.issues.some((issue) => issue.subject.startsWith(prefix)));
      });
    });
  }
});
