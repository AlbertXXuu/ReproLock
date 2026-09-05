import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, lstat, mkdir, opendir, readFile, realpath } from "node:fs/promises";
import { createServer } from "node:net";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";
import type { AttemptRecord } from "../../spikes/local-functional-regression/tools/evidence.ts";
import { validateGeneratedDemoReport } from "../../spikes/local-functional-regression/tools/evidence-cli.ts";
import { serializeCanonicalJson } from "../evidence/canonical-json.ts";
import { writeCanonicalJsonAtomically } from "../evidence/writer.ts";
import { assertOrdinaryTrackedIndex } from "../verify/workspace.ts";
import {
  attemptsFromReport,
  CASE,
  type DemoExport,
  type DemoRun,
  type DemoVerification,
  digest,
  makeExport,
  type Observation,
  reportFromObservations,
  type Side,
  type SideExecution,
  verifyDemoExport,
} from "./evidence.ts";
import { OwnedProcess, restrictedChildEnvironment } from "./process.ts";

const execute = promisify(execFile);
const sides: Side[] = ["pre-fix", "post-fix"];
export type DemoConfig = { targets: Record<Side, string>; timeoutMs: number };
export type LiveRun = {
  run: DemoRun;
  attempts: AttemptRecord[];
  started: number;
  verification: DemoVerification | null;
};

export async function readConfig(path: string): Promise<DemoConfig> {
  const info = await lstat(path);
  assert.ok(
    info.isFile() && !info.isSymbolicLink() && info.size <= 262_144,
    "Configuration must be a regular file at most 256 KiB",
  );
  const bytes = await readFile(path);
  assert.ok(bytes.length <= 262_144, "Configuration changed or exceeds 256 KiB");
  const value: unknown = JSON.parse(bytes.toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Configuration must be an object");
  const record = value as Record<string, unknown>;
  assert.deepEqual(
    Object.keys(record).sort(),
    record.timeoutMs === undefined ? ["targets"] : ["targets", "timeoutMs"],
    "Configuration accepts only targets and timeoutMs",
  );
  const targets = record.targets;
  if (!targets || typeof targets !== "object" || Array.isArray(targets))
    throw new Error("Configure both supplied target paths");
  const targetRecord = targets as Record<string, unknown>;
  assert.deepEqual(
    Object.keys(targetRecord).sort(),
    ["post-fix", "pre-fix"],
    "targets accepts only pre-fix and post-fix",
  );
  if (
    typeof targetRecord["pre-fix"] !== "string" ||
    targetRecord["pre-fix"].trim() === "" ||
    typeof targetRecord["post-fix"] !== "string" ||
    targetRecord["post-fix"].trim() === ""
  )
    throw new Error("Configure both supplied target paths");
  const timeoutMs = record.timeoutMs ?? 1_200_000;
  if (
    typeof timeoutMs !== "number" ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 1_500_000
  )
    throw new Error("timeoutMs must be 1..1500000");
  return {
    targets: {
      "pre-fix": resolve(targetRecord["pre-fix"]),
      "post-fix": resolve(targetRecord["post-fix"]),
    },
    timeoutMs,
  };
}

async function git(path: string, args: string[]): Promise<string> {
  return (
    await execute("git", ["-C", path, ...args], {
      timeout: 10_000,
      maxBuffer: 1_048_576,
      windowsHide: true,
      env: restrictedChildEnvironment(),
    })
  ).stdout.trim();
}

export async function configuredOrigin(path: string): Promise<string> {
  return git(path, ["config", "--local", "--get", "remote.origin.url"]);
}

async function validateTarget(path: string, side: Side): Promise<void> {
  if ((await git(path, ["rev-parse", "HEAD"])) !== CASE.revisions[side])
    throw new Error(`${side}: revision mismatch`);
  assertOrdinaryTrackedIndex(await git(path, ["ls-files", "-v", "-z"]), `${side} target`);
  if (
    (await git(path, [
      "-c",
      "core.fsmonitor=false",
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
      "--ignore-submodules=none",
    ])) !== ""
  )
    throw new Error(`${side}: target contains uncommitted changes`);
  if ((await configuredOrigin(path)) !== CASE.repository)
    throw new Error(`${side}: repository mismatch`);
  if (digest(await readFile(join(path, "package-lock.json"))) !== CASE.lockSha256)
    throw new Error(`${side}: lockfile mismatch`);
  const pkg = JSON.parse(await readFile(join(path, "package.json"), "utf8"));
  if (pkg.scripts?.dev !== "vite")
    throw new Error(`${side}: trusted Vite start configuration differs`);
  await access(join(path, "node_modules/vite/bin/vite.js"));
}

export async function assertPortFree(): Promise<void> {
  const probe = createServer();
  await new Promise<void>((accept, reject) => {
    probe.once("error", () =>
      reject(
        new Error(
          "Target port 4173 is occupied; leave its owner running and release it explicitly",
        ),
      ),
    );
    probe.listen(4173, "127.0.0.1", () => probe.close(() => accept()));
  });
}

export async function checkPrerequisites(
  root: string,
  config: DemoConfig,
): Promise<{ ok: boolean; diagnostic: string }> {
  try {
    await assertPortFree();
    await access(chromium.executablePath());
    for (const side of sides) await validateTarget(config.targets[side], side);
    if (
      digest(
        await readFile(
          join(root, "spikes/local-functional-regression/generated/safe-unfollow-163.spec.ts"),
        ),
      ) !== CASE.specSha256
    )
      throw new Error("Frozen test hash mismatch");
    if (
      digest(
        await readFile(
          join(root, "spikes/local-functional-regression/generated/playwright.config.ts"),
        ),
      ) !== CASE.configSha256
    )
      throw new Error("Frozen configuration hash mismatch");
    return {
      ok: true,
      diagnostic:
        "Both exact clean revisions, locked source, Chromium, Vite and loopback port are ready",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Prerequisite check failed";
    return {
      ok: false,
      diagnostic: /^[^\r\n]*(?:[A-Za-z]:[\\/]|ENOENT|Command failed)/u.test(message)
        ? "Local prerequisites unavailable; check configured target paths, npm ci and Chromium installation"
        : message,
    };
  }
}

async function jsonIfPresent(path: string): Promise<unknown | null> {
  try {
    const info = await lstat(path);
    assert.ok(
      info.isFile() && !info.isSymbolicLink() && info.size <= 1_048_576,
      "Observation JSON must be a regular file at most 1 MiB",
    );
    const bytes = await readFile(path);
    assert.ok(bytes.length <= 1_048_576, "Observation JSON changed or exceeds 1 MiB");
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function boundedNames(path: string): Promise<string[]> {
  const names: string[] = [];
  const directory = await opendir(path);
  for await (const entry of directory) {
    names.push(entry.name);
    assert.ok(names.length <= 64, "Observation directory exceeds 64 entries");
  }
  return names;
}

/** One explicit local case; no queue, model, arbitrary command API or historical-success fallback. */
export class DemoRunner {
  readonly root: string;
  readonly config: DemoConfig;
  live: LiveRun | null = null;
  private cancellation: AbortController | null = null;
  private completion: Promise<void> | null = null;
  private startup: Promise<string> | null = null;
  private directory: string | null = null;
  private readonly reports = new Map<Side, unknown>();

  constructor(root: string, config: DemoConfig) {
    this.root = root;
    this.config = config;
  }
  get active(): boolean {
    return this.startup !== null || this.completion !== null;
  }
  cancel(): void {
    this.cancellation?.abort();
  }
  async shutdown(): Promise<void> {
    this.cancel();
    await this.startup?.catch(() => {});
    await this.completion;
  }

  start(): Promise<string> {
    if (this.active) return Promise.reject(new Error("One run is already active"));
    this.cancellation = new AbortController();
    this.startup = this.initialize();
    return this.startup.finally(() => {
      this.startup = null;
      if (!this.completion) this.cancellation = null;
    });
  }

  private async initialize(): Promise<string> {
    const parent = join(this.root, "output/demo");
    await mkdir(parent, { recursive: true });
    const resolved = await realpath(parent);
    const distance = relative(await realpath(this.root), resolved);
    if (isAbsolute(distance) || distance === ".." || distance.startsWith(`..${sep}`))
      throw new Error("Demo output resolves outside the repository");
    const id = `${new Date().toISOString().replace(/[^0-9TZ]/gu, "")}-${randomUUID().slice(0, 8)}`;
    this.directory = join(resolved, id);
    await mkdir(this.directory);
    this.reports.clear();
    this.live = {
      run: {
        schemaVersion: 1,
        id,
        caseId: CASE.id,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        status: "preparing",
        phase: "Checking local prerequisites",
        diagnostic: null,
        repeatEach: 20,
        timeoutMs: this.config.timeoutMs,
        executions: [],
        sourceHashes: {},
        modelCalls: 0,
      },
      attempts: [],
      started: 0,
      verification: null,
    };
    await writeCanonicalJsonAtomically({
      outputRoot: this.directory,
      relativePath: "started.json",
      value: this.live.run,
    });
    this.completion = this.perform()
      .catch(() => {
        if (this.live) {
          this.live.run.status = "execution-error";
          this.live.run.finishedAt = new Date().toISOString();
          this.live.run.diagnostic =
            "Evidence finalization failed; already published observations remain in this run directory";
          this.live.verification = {
            integrity: false,
            consistent: false,
            differential: false,
            issues: ["Evidence finalization failed"],
          };
        }
      })
      .finally(() => {
        this.completion = null;
        this.cancellation = null;
      });
    return id;
  }

  async refresh(): Promise<LiveRun | null> {
    if (!this.live || !this.directory || !this.active) return this.live;
    let started = 0;
    const attempts: AttemptRecord[] = [];
    for (const side of sides) {
      const folder = join(this.directory, "observations", side);
      let names: string[];
      try {
        names = await boundedNames(folder);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      const observations: Observation[] = [];
      for (const name of names.filter((name) => /^attempt-\d+\.json$/u.test(name)))
        observations.push((await jsonIfPresent(join(folder, name))) as Observation);
      observations.sort((a, b) => a.attempt - b.attempt);
      for (const name of names.filter((name) => /^started-\d+\.json$/u.test(name))) {
        const value = (await jsonIfPresent(join(folder, name))) as { workerIndex: number };
        if (value.workerIndex >= 0) started += 1;
      }
      const report = reportFromObservations(
        observations,
        (await jsonIfPresent(join(folder, "begin.json"))) ?? {},
        await jsonIfPresent(join(folder, "end.json")),
      );
      this.reports.set(side, report);
      attempts.push(...attemptsFromReport(report, side));
    }
    this.live.started = started;
    this.live.attempts = attempts;
    return this.live;
  }

  private async perform(): Promise<void> {
    const live = this.live;
    const directory = this.directory;
    const control = this.cancellation;
    if (!live || !directory || !control) throw new Error("Run not initialized");
    const deadline = AbortSignal.timeout(this.config.timeoutMs);
    const signal = AbortSignal.any([deadline, control.signal]);
    const stopped = (): void => {
      if (signal.aborted) throw new Error("Run stopped");
    };
    const processes: OwnedProcess[] = [];
    try {
      const generated = join(this.root, "spikes/local-functional-regression/generated");
      for (const name of ["safe-unfollow-163.spec.ts", "playwright.config.ts"])
        live.run.sourceHashes[`generated/${name}`] = digest(await readFile(join(generated, name)));
      for (const name of ["run.ts", "reporter.ts", "evidence.ts", "process.ts"])
        live.run.sourceHashes[`demo/${name}`] = digest(
          await readFile(join(this.root, "src/demo", name)),
        );
      stopped();
      const prerequisites = await checkPrerequisites(this.root, this.config);
      stopped();
      if (!prerequisites.ok) {
        live.run.status = "startup-error";
        throw new Error(prerequisites.diagnostic);
      }
      for (const side of sides) {
        stopped();
        await validateTarget(this.config.targets[side], side);
        await assertPortFree();
        const execution: SideExecution = {
          side,
          revision: CASE.revisions[side],
          cleanBefore: true,
          cleanAfter: false,
          lockSha256: CASE.lockSha256,
          exitCode: null,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          reportSha256: null,
          rawReportSha256: null,
          cleanup: [],
        };
        live.run.executions.push(execution);
        live.run.phase = `Starting ${side} local target`;
        live.run.status = "preparing";
        const target = new OwnedProcess(
          process.execPath,
          [
            join(this.config.targets[side], "node_modules/vite/bin/vite.js"),
            "--host",
            "127.0.0.1",
            "--port",
            "4173",
            "--strictPort",
          ],
          this.config.targets[side],
        );
        processes.push(target);
        let browser: OwnedProcess | null = null;
        try {
          await target.observe();
          const readyBy = Date.now() + 30_000;
          let ready = false;
          while (Date.now() < readyBy && !target.exited) {
            stopped();
            try {
              const response = await fetch(`${CASE.origin}/upload`, {
                redirect: "error",
                signal: AbortSignal.any([signal, AbortSignal.timeout(1_000)]),
              });
              ready = response.ok;
              await response.body?.cancel();
              if (ready) break;
            } catch {
              stopped();
            }
            await delay(200);
          }
          if (!ready) {
            live.run.status = "startup-error";
            throw new Error(`${side}: local target did not become ready within 30 seconds`);
          }
          stopped();
          live.run.status = "running";
          live.run.phase = `Executing ${side}: 20 repetitions`;
          const observationRoot = join(directory, "observations", side);
          await mkdir(observationRoot, { recursive: true });
          await mkdir(join(directory, "raw"), { recursive: true });
          const rawReport = join(directory, "raw", `${side}.json`);
          browser = new OwnedProcess(
            process.execPath,
            [
              join(this.root, "node_modules/@playwright/test/cli.js"),
              "test",
              "--config",
              join(generated, "playwright.config.ts"),
              "--repeat-each=20",
              `--output=${join(directory, "raw", `${side}-artifacts`)}`,
              `--reporter=json,${join(this.root, "src/demo/reporter.ts")}`,
            ],
            this.root,
            {
              TARGET_BASE_URL: CASE.origin,
              PLAYWRIGHT_JSON_OUTPUT_FILE: rawReport,
              REPROLOCK_OBSERVATIONS: observationRoot,
            },
          );
          processes.push(browser);
          await browser.observe();
          execution.exitCode = await new Promise<number>((accept) => {
            const abort = () => accept(control.signal.aborted ? 130 : 124);
            signal.addEventListener("abort", abort, { once: true });
            void browser?.closed.then((code) => {
              signal.removeEventListener("abort", abort);
              accept(code);
            });
            if (signal.aborted) abort();
          });
          stopped();
          if (browser.outputExceeded || target.outputExceeded)
            throw new Error("Owned process output exceeded its bounded limit");
          const rawInfo = await lstat(rawReport);
          assert.ok(
            rawInfo.isFile() && !rawInfo.isSymbolicLink() && rawInfo.size <= 8_388_608,
            "Playwright report must be a regular file at most 8 MiB",
          );
          const raw = await readFile(rawReport);
          assert.ok(raw.length <= 8_388_608, "Playwright report changed or exceeds 8 MiB");
          execution.rawReportSha256 = digest(raw);
          // Validate the actual Playwright JSON report before the portable projection can confirm success.
          const actual = validateGeneratedDemoReport(JSON.parse(raw.toString("utf8")), side);
          await this.refresh();
          const projected = validateGeneratedDemoReport(this.reports.get(side), side);
          const comparable = (results: typeof actual) =>
            results
              .map((entry) => ({
                id: entry.specId,
                file: entry.file,
                title: entry.title,
                status: entry.status,
                retry: entry.retry,
                durationMs: entry.durationMs,
                classification: entry.classification,
                checkpoint: entry.firstFailedCheckpoint,
              }))
              .sort((a, b) => a.id.localeCompare(b.id));
          assert.deepEqual(
            comparable(projected),
            comparable(actual),
            "Streaming observations differ from the actual Playwright report",
          );
        } finally {
          live.run.phase = `Cleaning up ${side} owned processes`;
          if (browser) execution.cleanup.push(await browser.stop());
          execution.cleanup.push(await target.stop());
          await writeCanonicalJsonAtomically({
            outputRoot: directory,
            relativePath: `target-${side}-output.json`,
            value: {
              bytes: Buffer.byteLength(target.output),
              sha256: digest(target.output),
              truncated: target.outputExceeded,
            },
          });
          if (browser)
            await writeCanonicalJsonAtomically({
              outputRoot: directory,
              relativePath: `browser-${side}-output.json`,
              value: {
                bytes: Buffer.byteLength(browser.output),
                sha256: digest(browser.output),
                truncated: browser.outputExceeded,
              },
            });
          execution.finishedAt = new Date().toISOString();
          execution.cleanAfter = await Promise.all([
            git(this.config.targets[side], [
              "-c",
              "core.fsmonitor=false",
              "status",
              "--porcelain=v1",
              "--untracked-files=all",
              "--ignore-submodules=none",
            ]),
            git(this.config.targets[side], ["ls-files", "-v", "-z"]),
          ]).then(
            ([status, index]) => {
              assertOrdinaryTrackedIndex(index, `${side} target`);
              return status === "";
            },
            () => false,
          );
          await this.refresh();
          if (execution.cleanup.some((entry) => !entry.verified)) live.run.status = "cleanup-error";
        }
        if (live.run.status === "cleanup-error")
          throw new Error("Owned process cleanup could not be verified");
        stopped();
      }
      live.run.status = "completed";
      live.run.phase = "Checking current-run evidence";
    } catch (error) {
      if (live.run.status !== "cleanup-error")
        live.run.status = signal.aborted
          ? control.signal.aborted
            ? "cancelled"
            : "timeout"
          : live.run.status === "startup-error"
            ? "startup-error"
            : "execution-error";
      const message = error instanceof Error ? error.message : "Execution failed";
      live.run.diagnostic = signal.aborted
        ? control.signal.aborted
          ? "Cancelled by the user; unexecuted repetitions are not counted"
          : "Run deadline reached; incomplete observations are retained"
        : /[A-Za-z]:[\\/]|ENOENT|Command failed/u.test(message)
          ? "Execution could not complete; inspect retained local diagnostic logs"
          : message;
    } finally {
      // Covers cancellation/errors during startup before the side's normal cleanup block is entered.
      for (const process of processes.filter((process) => !process.exited)) {
        const cleanup = await process.stop();
        if (!cleanup.verified) live.run.status = "cleanup-error";
      }
      await this.refresh();
      live.run.finishedAt = new Date().toISOString();
      live.run.phase = "Finished; current evidence retained";
      const files: Record<string, string> = {
        "safe-unfollow-163.spec.ts": await readFile(
          join(this.root, "spikes/local-functional-regression/generated/safe-unfollow-163.spec.ts"),
          "utf8",
        ),
        "playwright.config.ts": await readFile(
          join(this.root, "spikes/local-functional-regression/generated/playwright.config.ts"),
          "utf8",
        ),
        "attempts.json": serializeCanonicalJson(live.attempts),
      };
      for (const execution of live.run.executions) {
        const report = this.reports.get(execution.side);
        if (report) {
          const contents = serializeCanonicalJson({
            ...(report as object),
            rawReportSha256: execution.rawReportSha256,
          });
          files[`reports/${execution.side}.json`] = contents;
          execution.reportSha256 = digest(contents);
        }
      }
      files["run.json"] = serializeCanonicalJson(live.run);
      const bundle: DemoExport = makeExport(files);
      live.verification = verifyDemoExport(bundle);
      await writeCanonicalJsonAtomically({
        outputRoot: directory,
        relativePath: "export.json",
        value: bundle,
      });
      await writeCanonicalJsonAtomically({
        outputRoot: directory,
        relativePath: "verification.json",
        value: live.verification,
      });
      await writeCanonicalJsonAtomically({
        outputRoot: directory,
        relativePath: "final.json",
        value: live,
      });
    }
  }
}
