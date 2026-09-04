import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  stat,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";
import { OwnedProcess } from "../demo/process.ts";
import { serializeCanonicalJson } from "../evidence/canonical-json.ts";
import { writeCanonicalJsonAtomically } from "../evidence/writer.ts";
import {
  type Bundle,
  configurationDigest,
  type Execution,
  hash,
  parseReport,
  verifyBundle,
} from "./evidence.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const exec = promisify(execFile);
type Target = { path: string; revision: string };
export type Config = {
  schemaVersion: 1;
  candidate: string;
  targets: [Target, Target];
  start: { nodeScript: string; args: string[] };
  origin: string;
  readyPath: string;
  resetDescription: string;
  repetitions: number;
  timeoutMs: number;
  testTimeoutMs: number;
};
const inside = (parent: string, child: string): boolean => {
  const distance = relative(parent, child);
  return distance !== ".." && !distance.startsWith(`..${sep}`) && !isAbsolute(distance);
};
const object = (value: unknown): Record<string, unknown> => {
  assert.ok(
    value && typeof value === "object" && !Array.isArray(value),
    "Configuration must contain objects",
  );
  return value as Record<string, unknown>;
};
const bounded = (value: unknown, fallback: number, max: number): number => {
  const result = value ?? fallback;
  assert.ok(
    typeof result === "number" && Number.isInteger(result) && result >= 1 && result <= max,
    "Numeric limit out of range",
  );
  return result;
};

/** Paths resolve against the configuration file, not the invoking shell. Commands are explicit data. */
export async function readConfig(path: string): Promise<Config> {
  const base = dirname(resolve(path));
  const c = object(JSON.parse(await readFile(path, "utf8")));
  assert.equal(c.schemaVersion, 1, "Unsupported configuration version");
  assert.ok(typeof c.candidate === "string", "A candidate file is required");
  assert.ok(
    Array.isArray(c.targets) && c.targets.length === 2,
    "Supply pre-fix then post-fix worktrees",
  );
  const targets = c.targets.map((value) => {
    const t = object(value);
    assert.ok(
      typeof t.path === "string" &&
        typeof t.revision === "string" &&
        /^[a-f0-9]{40}$/u.test(t.revision),
      "Full target path and commit are required",
    );
    return { path: resolve(base, t.path), revision: t.revision };
  }) as [Target, Target];
  assert.notEqual(targets[0].revision, targets[1].revision, "Choose two different revisions");
  const start = object(c.start);
  assert.ok(
    typeof start.nodeScript === "string" &&
      /^[a-zA-Z0-9_./-]+\.(?:[cm]?js|ts)$/u.test(start.nodeScript) &&
      !isAbsolute(start.nodeScript) &&
      !start.nodeScript.split("/").includes(".."),
    "Use a relative trusted Node entry point",
  );
  assert.ok(
    Array.isArray(start.args) &&
      start.args.length <= 32 &&
      start.args.every(
        (a) => typeof a === "string" && a.length <= 512 && !a.includes("\0") && !/[\r\n]/u.test(a),
      ),
    "Supply a bounded argument array",
  );
  assert.ok(typeof c.origin === "string");
  const url = new URL(c.origin);
  assert.ok(
    url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      url.port &&
      !url.username &&
      !url.password &&
      url.href === `${url.origin}/`,
    "Use an explicit http://127.0.0.1:port origin",
  );
  assert.ok(
    typeof c.readyPath === "string" &&
      c.readyPath.startsWith("/") &&
      new URL(c.readyPath, url).origin === url.origin &&
      !c.readyPath.includes("?"),
    "Use a local readiness path",
  );
  assert.ok(
    typeof c.resetDescription === "string" &&
      c.resetDescription.trim().length >= 10 &&
      c.resetDescription.length <= 1000,
    "Describe the reviewed reset and its observable postcondition",
  );
  return {
    schemaVersion: 1,
    candidate: resolve(base, c.candidate),
    targets,
    start: { nodeScript: start.nodeScript, args: start.args as string[] },
    origin: url.origin,
    readyPath: c.readyPath,
    resetDescription: c.resetDescription,
    repetitions: bounded(c.repetitions, 3, 20),
    timeoutMs: bounded(c.timeoutMs, 180_000, 1_500_000),
    testTimeoutMs: bounded(c.testTimeoutMs, 15_000, 60_000),
  };
}

const environment = (): NodeJS.ProcessEnv =>
  Object.fromEntries(
    Object.entries(process.env).filter(([key]) =>
      /^(?:PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|LOCALAPPDATA|APPDATA|PLAYWRIGHT_BROWSERS_PATH)$/iu.test(
        key,
      ),
    ),
  );
async function git(path: string, args: string[]): Promise<string> {
  return (
    await exec("git", ["-C", path, ...args], {
      timeout: 10_000,
      maxBuffer: 1_048_576,
      windowsHide: true,
      env: environment(),
    })
  ).stdout.trim();
}
async function targetIdentity(
  target: Target,
  script: string,
): Promise<{ common: string; fingerprint: string }> {
  const path = await realpath(target.path);
  assert.equal(
    await realpath(await git(path, ["rev-parse", "--show-toplevel"])),
    path,
    "Target must be a Git root",
  );
  assert.equal(await git(path, ["rev-parse", "HEAD"]), target.revision, "Target revision mismatch");
  assert.equal(await git(path, ["status", "--porcelain"]), "", "Target must be clean");
  const entry = await realpath(join(path, script));
  assert.ok(inside(path, entry), "Start entry must stay inside its target");
  const common = await realpath(resolve(path, await git(path, ["rev-parse", "--git-common-dir"])));
  await git(path, ["ls-files", "--error-unmatch", "package.json"]);
  const sources: Record<string, string> = {
    entry: hash(await readFile(entry)),
    package: hash(await readFile(join(path, "package.json"))),
  };
  let locks = 0;
  for (const name of ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]) {
    try {
      sources[name] = hash(await readFile(join(path, name)));
      await git(path, ["ls-files", "--error-unmatch", name]);
      locks++;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  assert.ok(locks > 0, "A committed target lockfile is required");
  return { common, fingerprint: hash(serializeCanonicalJson(sources)) };
}
async function candidateSource(path: string): Promise<string> {
  assert.ok((await stat(path)).size <= 131_072, "Candidate exceeds 128 KiB");
  const source = await readFile(path, "utf8");
  // Parse without evaluating candidate code, using the pinned Node runtime's module parser.
  const parsed = await exec(
    process.execPath,
    [
      "--experimental-vm-modules",
      "--input-type=module",
      "-e",
      "import {SourceTextModule} from 'node:vm'; import {stripTypeScriptTypes} from 'node:module'; import {readFileSync} from 'node:fs'; console.log(JSON.stringify(new SourceTextModule(stripTypeScriptTypes(readFileSync(process.argv[1],'utf8'))).dependencySpecifiers));",
      path,
    ],
    { timeout: 10_000, maxBuffer: 1_048_576, windowsHide: true, env: environment() },
  );
  const imports: unknown = JSON.parse(parsed.stdout);
  assert.ok(
    Array.isArray(imports) &&
      imports.length > 0 &&
      imports.every((value) => value === "@playwright/test"),
    "V1 candidates import only @playwright/test",
  );
  assert.ok(
    !/\bimport\s*\(/u.test(source),
    "Dynamic imports are outside the self-contained candidate contract",
  );
  return source;
}
async function portFree(origin: string): Promise<void> {
  const server = createServer();
  await new Promise<void>((accept, reject) => {
    server.once("error", () =>
      reject(new Error("Target port is occupied; its owner was left running")),
    );
    server.listen(Number(new URL(origin).port), "127.0.0.1", () => server.close(() => accept()));
  });
}
export async function check(config: Config): Promise<void> {
  await candidateSource(config.candidate);
  await access(chromium.executablePath());
  await portFree(config.origin);
  const pre = await targetIdentity(config.targets[0], config.start.nodeScript);
  const post = await targetIdentity(config.targets[1], config.start.nodeScript);
  assert.equal(
    pre.common,
    post.common,
    "Targets must be worktrees of the same supplied repository",
  );
  assert.notEqual(await realpath(config.targets[0].path), await realpath(config.targets[1].path));
}

/** Execute a reviewed local candidate unchanged on two exact clean worktrees; never infer commands. */
export async function run(config: Config, cancellation: AbortSignal): Promise<string> {
  const candidate = await candidateSource(config.candidate);
  const parent = join(root, "output/verify");
  await mkdir(parent, { recursive: true });
  assert.ok(inside(await realpath(root), await realpath(parent)), "Output escaped the coordinator");
  const directory = await mkdtemp(join(parent, "run-"));
  const guard = `import { test } from '@playwright/test';\nimport './candidate.spec.ts';\ntest.beforeEach(async ({ context, baseURL }) => {\n  await context.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());\n  await context.routeWebSocket('**/*', socket => { const url = new URL(socket.url()); url.protocol = url.protocol === 'ws:' ? 'http:' : 'https:'; if (url.origin === baseURL) socket.connectToServer(); else socket.close(); });\n});\n`;
  const runtimeFiles = {
    cli: join(root, "src/verify/cli.ts"),
    reporter: join(root, "src/verify/reporter.ts"),
    evidence: join(root, "src/verify/evidence.ts"),
    process: join(root, "src/demo/process.ts"),
  };
  const sourceHashes: Record<string, string> = { candidate: hash(candidate), guard: hash(guard) };
  for (const [name, path] of Object.entries(runtimeFiles))
    sourceHashes[name] = hash(await readFile(path));
  const bundle: Bundle = {
    schemaVersion: 1,
    candidate,
    candidateSha256: hash(candidate),
    repetitions: config.repetitions,
    status: "error",
    executions: [],
    revisions: [config.targets[0].revision, config.targets[1].revision],
    fingerprints: [],
    sourceHashes,
    settings: {
      origin: config.origin,
      readyPath: config.readyPath,
      startScript: config.start.nodeScript,
      startArgsSha256: hash(serializeCanonicalJson(config.start.args)),
      timeoutMs: config.timeoutMs,
      testTimeoutMs: config.testTimeoutMs,
      resetDescriptionSha256: hash(config.resetDescription),
    },
  };
  const signal = AbortSignal.any([cancellation, AbortSignal.timeout(config.timeoutMs)]);
  const stopped = (): void => {
    signal.throwIfAborted();
  };
  await writeFile(join(directory, "candidate.spec.ts"), candidate, { flag: "wx" });
  await writeFile(join(directory, "guard.spec.ts"), guard, { flag: "wx" });
  const assertSources = async (): Promise<void> => {
    for (const [name, path] of Object.entries(runtimeFiles))
      assert.equal(hash(await readFile(path)), sourceHashes[name], "Runtime source changed");
    assert.equal(
      hash(await readFile(config.candidate)),
      bundle.candidateSha256,
      "Candidate changed",
    );
    assert.equal(
      hash(await readFile(join(directory, "candidate.spec.ts"))),
      bundle.candidateSha256,
      "Frozen candidate changed",
    );
    assert.equal(
      hash(await readFile(join(directory, "guard.spec.ts"))),
      sourceHashes.guard,
      "Guard changed",
    );
  };
  // Configuration is local-only: it may contain paths and reviewed startup arguments.
  await writeCanonicalJsonAtomically({
    outputRoot: directory,
    relativePath: "local-config.json",
    value: config,
  });
  await writeCanonicalJsonAtomically({
    outputRoot: directory,
    relativePath: "started.json",
    value: {
      schemaVersion: 1,
      startedAt: new Date().toISOString(),
      candidateSha256: hash(candidate),
    },
  });
  try {
    stopped();
    await check(config);
    stopped();
    for (const target of config.targets)
      bundle.fingerprints.push((await targetIdentity(target, config.start.nodeScript)).fingerprint);
    for (const [index, target] of config.targets.entries()) {
      stopped();
      await portFree(config.origin);
      const before = await targetIdentity(target, config.start.nodeScript);
      assert.equal(before.fingerprint, bundle.fingerprints[index]);
      await assertSources();
      const execution: Execution = {
        revision: target.revision,
        cleanBefore: true,
        cleanAfter: false,
        exitCode: null,
        cleanup: false,
        report: null,
        reportSha256: null,
        fingerprintBefore: before.fingerprint,
        fingerprintAfter: null,
        configurationSha256: configurationDigest(bundle),
      };
      bundle.executions.push(execution);
      const processes: OwnedProcess[] = [];
      const reportFile = join(directory, `report-${index}.json`);
      try {
        const app = new OwnedProcess(
          process.execPath,
          [join(target.path, config.start.nodeScript), ...config.start.args],
          target.path,
          environment(),
          false,
        );
        processes.push(app);
        await app.observe();
        const until = Date.now() + Math.min(30_000, config.timeoutMs);
        let ready = false;
        while (Date.now() < until && !app.exited) {
          stopped();
          try {
            const response = await fetch(new URL(config.readyPath, config.origin), {
              redirect: "error",
              signal: AbortSignal.any([signal, AbortSignal.timeout(1_000)]),
            });
            ready = response.ok;
            await response.body?.cancel();
            if (ready) break;
          } catch {
            stopped();
          }
          await delay(100, undefined, { signal });
        }
        assert.ok(ready && !app.exited, "Target readiness failed");
        stopped();
        const pwConfig = {
          testDir: directory,
          testMatch: "guard.spec.ts",
          workers: 1,
          retries: 0,
          repeatEach: config.repetitions,
          forbidOnly: true,
          timeout: config.testTimeoutMs,
          globalTimeout: config.timeoutMs,
          outputDir: join(directory, `local-artifacts-${index}`),
          use: {
            baseURL: config.origin,
            trace: "off",
            screenshot: "off",
            video: "off",
            serviceWorkers: "block",
          },
          reporter: [[join(root, "src/verify/reporter.ts"), { outputFile: reportFile }]],
        };
        const configPath = join(directory, `playwright-${index}.config.mjs`);
        const configSource = `export default ${JSON.stringify(pwConfig)};\n`;
        await writeFile(configPath, configSource, { flag: "wx" });
        await assertSources();
        assert.equal(
          hash(await readFile(configPath)),
          hash(configSource),
          "Effective configuration changed",
        );
        const browser = new OwnedProcess(
          process.execPath,
          [join(root, "node_modules/@playwright/test/cli.js"), "test", "--config", configPath],
          root,
          environment(),
          false,
        );
        processes.push(browser);
        await browser.observe();
        execution.exitCode = await new Promise<number>((accept) => {
          const abort = () => accept(cancellation.aborted ? 130 : 124);
          signal.addEventListener("abort", abort, { once: true });
          void browser.closed.then((code) => {
            signal.removeEventListener("abort", abort);
            accept(code);
          });
          if (signal.aborted) abort();
        });
        stopped();
        assert.ok(
          !app.exited && !processes.some((p) => p.outputExceeded),
          "Execution environment failed",
        );
        assert.equal(
          hash(await readFile(configPath)),
          hash(configSource),
          "Effective configuration changed",
        );
        assert.ok((await stat(reportFile)).size <= 4_194_304, "Report exceeded 4 MiB");
        execution.report = parseReport(JSON.parse(await readFile(reportFile, "utf8")));
        execution.reportSha256 = hash(serializeCanonicalJson(execution.report));
      } finally {
        const cleanups = [];
        for (const owned of [...processes].reverse()) cleanups.push(await owned.stop());
        execution.cleanup = cleanups.length > 0 && cleanups.every((c) => c.verified);
        execution.fingerprintAfter = await targetIdentity(target, config.start.nodeScript).then(
          (after) => after.fingerprint,
          () => null,
        );
        execution.cleanAfter = execution.fingerprintAfter === before.fingerprint;
        if (!execution.report) {
          // Preserve completed attempts after termination without claiming an unfinished report is complete.
          const partials = (await readdir(directory))
            .filter(
              (name) =>
                name.startsWith(`report-${index}.json.partial-`) && /partial-\d+$/u.test(name),
            )
            .sort((a, b) => Number(b.split("-").at(-1)) - Number(a.split("-").at(-1)));
          for (const name of partials) {
            try {
              assert.ok((await stat(join(directory, name))).size <= 4_194_304);
              execution.report = parseReport(
                JSON.parse(await readFile(join(directory, name), "utf8")),
              );
              execution.reportSha256 = hash(serializeCanonicalJson(execution.report));
              break;
            } catch {
              /* An interrupted atomic publication cannot become a completed observation. */
            }
          }
        }
        for (const [n, owned] of processes.entries())
          await writeFile(join(directory, `local-process-${index}-${n}.log`), owned.output, {
            flag: "wx",
          });
      }
      assert.ok(execution.cleanup && execution.cleanAfter, "Target or cleanup verification failed");
      await assertSources();
    }
    bundle.status = "completed";
  } catch {
    bundle.status = signal.aborted ? (cancellation.aborted ? "cancelled" : "timeout") : "error";
  } finally {
    await writeCanonicalJsonAtomically({
      outputRoot: directory,
      relativePath: "export.json",
      value: bundle,
    });
    await writeCanonicalJsonAtomically({
      outputRoot: directory,
      relativePath: "verification.json",
      value: verifyBundle(bundle),
    });
  }
  return directory;
}

async function main(): Promise<void> {
  const [command, file, ...extra] = process.argv.slice(2);
  assert.ok(
    file && extra.length === 0 && ["check", "run", "verify"].includes(command ?? ""),
    "Usage: pnpm regression <check|run> config.json | pnpm regression verify export.json",
  );
  if (command === "verify") {
    assert.ok((await stat(file)).size <= 8_388_608, "Export exceeds 8 MiB");
    const result = verifyBundle(JSON.parse(await readFile(file, "utf8")));
    console.log(JSON.stringify(result));
    process.exitCode = result.differential ? 0 : 2;
    return;
  }
  const config = await readConfig(file);
  if (command === "check") {
    await check(config);
    console.log("Local configuration, revisions, dependencies and port are ready");
    return;
  }
  const controller = new AbortController();
  const cancel = (): void => controller.abort();
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  try {
    const directory = await run(config, controller.signal);
    const bundle = JSON.parse(await readFile(join(directory, "export.json"), "utf8"));
    const result = verifyBundle(bundle);
    console.log(JSON.stringify({ directory, status: bundle.status, ...result }));
    process.exitCode = result.differential
      ? 0
      : bundle.status === "cancelled"
        ? 130
        : bundle.status === "timeout"
          ? 124
          : 2;
  } finally {
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await main().catch(() => {
    console.error(
      "Configuration or preflight failed. Check the documented schema, clean revisions, dependencies and loopback port.",
    );
    process.exitCode = 2;
  });
}
