import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  opendir,
  readFile,
  readdir,
  realpath,
  stat,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { createRequire } from "node:module";
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
import {
  assertOrdinaryTrackedIndex,
  initializeCase,
  type InitOptions,
  validateServedPaths,
} from "./workspace.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const exec = promisify(execFile);
const requireFromHere = createRequire(import.meta.url);
type Target = { path: string; revision: string };
export type Config = {
  schemaVersion: 1;
  candidate: string;
  targets: [Target, Target];
  start: { nodeScript: string; args: string[] };
  servedPaths: string[];
  origin: string;
  readyPath: string;
  resetDescription: string;
  repetitions: number;
  timeoutMs: number;
  testTimeoutMs: number;
  outputRoot: string;
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
const exactKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void => {
  const unknown = Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .sort();
  assert.deepEqual(unknown, [], `Unknown ${label} key(s): ${unknown.join(", ")}`);
};
const bounded = (value: unknown, fallback: number, max: number): number => {
  const result = value === undefined ? fallback : value;
  assert.ok(
    typeof result === "number" && Number.isInteger(result) && result >= 1 && result <= max,
    "Numeric limit out of range",
  );
  return result;
};

/** Paths resolve against the configuration file, not the invoking shell. Commands are explicit data. */
export async function readConfig(path: string): Promise<Config> {
  const configPath = resolve(path);
  const input = await lstat(configPath);
  assert.ok(
    input.isFile() && !input.isSymbolicLink() && input.size <= 262_144,
    "Configuration must be a regular file at most 256 KiB",
  );
  const base = await realpath(dirname(configPath));
  const configBytes = await readFile(configPath);
  assert.ok(configBytes.length <= 262_144, "Configuration changed or exceeds 256 KiB");
  const c = object(JSON.parse(configBytes.toString("utf8")));
  exactKeys(
    c,
    [
      "schemaVersion",
      "candidate",
      "targets",
      "start",
      "servedPaths",
      "origin",
      "readyPath",
      "resetDescription",
      "repetitions",
      "timeoutMs",
      "testTimeoutMs",
      "outputRoot",
    ],
    "configuration",
  );
  assert.equal(c.schemaVersion, 1, "Unsupported configuration version");
  assert.ok(
    typeof c.candidate === "string" &&
      c.candidate.length > 0 &&
      c.candidate.length <= 1024 &&
      !c.candidate.includes("\0"),
    "A bounded candidate file path is required",
  );
  assert.ok(
    Array.isArray(c.targets) && c.targets.length === 2,
    "Supply pre-fix then post-fix worktrees",
  );
  const targets = c.targets.map((value) => {
    const t = object(value);
    exactKeys(t, ["path", "revision"], "target");
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
  exactKeys(start, ["nodeScript", "args"], "start");
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
      Number(url.port) >= 1 &&
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
      c.resetDescription.length <= 1000 &&
      !/\bREPROLOCK_TODO\b/u.test(c.resetDescription),
    "Replace the reset description placeholder with its observed postcondition",
  );
  const outputRoot = c.outputRoot === undefined ? "./runs" : c.outputRoot;
  assert.ok(
    typeof outputRoot === "string" &&
      outputRoot.length > 0 &&
      outputRoot.length <= 256 &&
      /^(?:\.\/)?[a-zA-Z0-9_.@-]+$/u.test(outputRoot) &&
      !isAbsolute(outputRoot) &&
      ![".", "..", "./.", "./..", ".git", "./.git"].includes(outputRoot.toLowerCase()),
    "outputRoot must name one relative directory beside the configuration",
  );
  return {
    schemaVersion: 1,
    candidate: resolve(base, c.candidate),
    targets,
    start: { nodeScript: start.nodeScript, args: start.args as string[] },
    servedPaths: validateServedPaths(c.servedPaths === undefined ? [] : c.servedPaths),
    origin: url.origin,
    readyPath: c.readyPath,
    resetDescription: c.resetDescription,
    repetitions: bounded(c.repetitions, 3, 20),
    timeoutMs: bounded(c.timeoutMs, 180_000, 1_500_000),
    testTimeoutMs: bounded(c.testTimeoutMs, 15_000, 60_000),
    outputRoot: resolve(base, outputRoot),
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
async function git(path: string, args: string[], signal?: AbortSignal): Promise<string> {
  return (
    await exec("git", ["-C", path, ...args], {
      timeout: 10_000,
      maxBuffer: 1_048_576,
      windowsHide: true,
      env: environment(),
      ...(signal ? { signal } : {}),
    })
  ).stdout.trim();
}

async function servedSources(
  path: string,
  servedPaths: readonly string[],
  signal: AbortSignal,
): Promise<Record<string, string>> {
  const sources: Record<string, string> = {};
  let entries = 0;
  let bytes = 0;
  const visit = async (absolute: string, portable: string): Promise<void> => {
    signal.throwIfAborted();
    assert.notEqual(
      portable.split("/").at(-1)?.toLowerCase(),
      ".git",
      `servedPaths cannot contain Git metadata: ${portable}`,
    );
    entries++;
    assert.ok(entries <= 10_000, "servedPaths exceeds 10,000 entries");
    const info = await lstat(absolute);
    signal.throwIfAborted();
    assert.ok(!info.isSymbolicLink(), `servedPaths cannot contain symlinks: ${portable}`);
    if (info.isDirectory()) {
      const names: string[] = [];
      const directory = await opendir(absolute);
      for await (const entry of directory) {
        signal.throwIfAborted();
        names.push(entry.name);
        assert.ok(entries + names.length <= 10_000, "servedPaths exceeds 10,000 entries");
      }
      names.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      if (names.length === 0) sources[`served-directory:${portable}`] = hash("");
      for (const name of names) await visit(join(absolute, name), `${portable}/${name}`);
      return;
    }
    assert.ok(info.isFile(), `servedPaths accepts only regular files and directories: ${portable}`);
    assert.ok(info.size <= 16_777_216, `Served file exceeds 16 MiB: ${portable}`);
    const contents = await readFile(absolute, { signal });
    signal.throwIfAborted();
    assert.ok(contents.length <= 16_777_216, `Served file changed or exceeds 16 MiB: ${portable}`);
    bytes += contents.length;
    assert.ok(bytes <= 536_870_912, "servedPaths exceeds 512 MiB");
    sources[`served-file:${portable}`] = hash(contents);
  };
  for (const portable of servedPaths) {
    signal.throwIfAborted();
    let cursor = path;
    for (const segment of portable.split("/")) {
      cursor = join(cursor, segment);
      assert.ok(
        !(await lstat(cursor)).isSymbolicLink(),
        `servedPaths cannot traverse symlinks: ${portable}`,
      );
    }
    const rootPath = await realpath(cursor);
    assert.ok(inside(path, rootPath), `servedPaths escaped its target: ${portable}`);
    await visit(rootPath, portable);
  }
  return sources;
}

async function boundedTargetFile(
  targetRoot: string,
  portable: string,
  limit: number,
  label: string,
  signal: AbortSignal,
): Promise<Buffer> {
  signal.throwIfAborted();
  const absolute = await realpath(join(targetRoot, portable));
  assert.ok(inside(targetRoot, absolute), `${label} must stay inside its target`);
  const info = await lstat(absolute);
  assert.ok(info.isFile() && !info.isSymbolicLink(), `${label} must be a regular file`);
  assert.ok(info.size <= limit, `${label} exceeds its ${limit / 1_048_576} MiB limit`);
  const contents = await readFile(absolute, { signal });
  assert.ok(contents.length <= limit, `${label} changed or exceeds its size limit`);
  return contents;
}

async function targetIdentity(
  target: Target,
  script: string,
  servedPaths: readonly string[],
  signal: AbortSignal = AbortSignal.timeout(30_000),
): Promise<{ common: string; fingerprint: string }> {
  signal.throwIfAborted();
  const path = await realpath(target.path);
  assert.equal(
    await realpath(await git(path, ["rev-parse", "--show-toplevel"], signal)),
    path,
    "Target must be a Git root",
  );
  assert.equal(
    await git(path, ["rev-parse", "HEAD"], signal),
    target.revision,
    "Target revision mismatch",
  );
  assertOrdinaryTrackedIndex(await git(path, ["ls-files", "-v", "-z"], signal), "Target");
  assert.equal(
    await git(
      path,
      [
        "-c",
        "core.fsmonitor=false",
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "--ignore-submodules=none",
      ],
      signal,
    ),
    "",
    "Target must be clean",
  );
  const common = await realpath(
    resolve(path, await git(path, ["rev-parse", "--git-common-dir"], signal)),
  );
  await git(path, ["ls-files", "--error-unmatch", "package.json"], signal);
  const sources: Record<string, string> = {
    entry: hash(await boundedTargetFile(path, script, 16_777_216, "Start entry", signal)),
    package: hash(
      await boundedTargetFile(path, "package.json", 4_194_304, "Package manifest", signal),
    ),
  };
  let locks = 0;
  for (const name of ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]) {
    try {
      const lock = await boundedTargetFile(path, name, 67_108_864, "Dependency lockfile", signal);
      await git(path, ["ls-files", "--error-unmatch", name], signal);
      sources[name] = hash(lock);
      locks++;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  assert.ok(locks > 0, "A committed target lockfile is required");
  Object.assign(sources, await servedSources(path, servedPaths, signal));
  return { common, fingerprint: hash(serializeCanonicalJson(sources)) };
}
async function candidateSource(path: string): Promise<string> {
  const candidateStat = await lstat(path);
  assert.ok(
    candidateStat.isFile() && !candidateStat.isSymbolicLink() && candidateStat.size <= 131_072,
    "Candidate must be a regular non-symlink file at most 128 KiB",
  );
  const sourceBytes = await readFile(path);
  assert.ok(sourceBytes.length <= 131_072, "Candidate changed or exceeds 128 KiB");
  const source = sourceBytes.toString("utf8");
  assert.ok(
    !/\bREPROLOCK_TODO\b/u.test(source),
    "Candidate is incomplete: replace every REPROLOCK_TODO marker after human review",
  );
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
    !/\bimport(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*(?:\r?\n|$))*\(/u.test(source),
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
export type CheckResult = { revisions: [string, string]; fingerprints: [string, string] };

async function checkOutputRoot(path: string): Promise<void> {
  try {
    const info = await lstat(path);
    assert.ok(
      info.isDirectory() && !info.isSymbolicLink(),
      "Existing outputRoot must be a real directory, not a file or symlink",
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function check(config: Config, cancellation?: AbortSignal): Promise<CheckResult> {
  const signal = cancellation
    ? AbortSignal.any([cancellation, AbortSignal.timeout(config.timeoutMs)])
    : AbortSignal.timeout(config.timeoutMs);
  signal.throwIfAborted();
  await candidateSource(config.candidate);
  signal.throwIfAborted();
  const roots = (await Promise.all(config.targets.map((target) => realpath(target.path)))) as [
    string,
    string,
  ];
  const outputRoot = resolve(config.outputRoot);
  await checkOutputRoot(outputRoot);
  for (const target of roots)
    assert.ok(
      !inside(target, outputRoot) && !inside(outputRoot, target),
      "outputRoot must not overlap a target worktree",
    );
  const pre = await targetIdentity(
    config.targets[0],
    config.start.nodeScript,
    config.servedPaths,
    signal,
  );
  const post = await targetIdentity(
    config.targets[1],
    config.start.nodeScript,
    config.servedPaths,
    signal,
  );
  assert.equal(
    pre.common,
    post.common,
    "Targets must be worktrees of the same supplied repository",
  );
  assert.notEqual(roots[0], roots[1], "Choose two different target worktrees");
  await access(chromium.executablePath());
  await portFree(config.origin);
  return {
    revisions: [config.targets[0].revision, config.targets[1].revision],
    fingerprints: [pre.fingerprint, post.fingerprint],
  };
}

/** Execute a reviewed local candidate unchanged on two exact clean worktrees; never infer commands. */
export type RunResult = { directory: string; diagnostic: string | null };

/** CJS facade that preserves Playwright's callable default plus statically discoverable names. */
export function playwrightShimSource(): string {
  return `const api = require(process.env.REPROLOCK_PLAYWRIGHT_MODULE_PATH ?? "");
module.exports = api;
module.exports._android = api._android;
module.exports._baseTest = api._baseTest;
module.exports._electron = api._electron;
module.exports._utilityTest = api._utilityTest;
module.exports.chromium = api.chromium;
module.exports.defineConfig = api.defineConfig;
module.exports.devices = api.devices;
module.exports.errors = api.errors;
module.exports.expect = api.expect;
module.exports.firefox = api.firefox;
module.exports.mergeExpects = api.mergeExpects;
module.exports.mergeTests = api.mergeTests;
module.exports.request = api.request;
module.exports.selectors = api.selectors;
module.exports.test = api.test;
module.exports.webkit = api.webkit;
`;
}

export async function run(config: Config, cancellation: AbortSignal): Promise<RunResult> {
  const signal = AbortSignal.any([cancellation, AbortSignal.timeout(config.timeoutMs)]);
  signal.throwIfAborted();
  const candidate = await candidateSource(config.candidate);
  await check(config, signal);
  const parent = config.outputRoot;
  await mkdir(parent, { recursive: true });
  await checkOutputRoot(parent);
  const directory = await mkdtemp(join(parent, "run-"));
  const shimDirectory = join(directory, "node_modules", "@playwright", "test");
  const shimPackage = '{"type":"commonjs","exports":"./index.cjs"}\n';
  const shimSource = playwrightShimSource();
  const guard = `import { test } from '@playwright/test';\nimport './candidate.spec.ts';\nconst allowedOrigin = ${JSON.stringify(config.origin)};\ntest.beforeEach(async ({ context }) => {\n  await context.route('**/*', route => new URL(route.request().url()).origin === allowedOrigin ? route.continue() : route.abort());\n  await context.routeWebSocket('**/*', socket => { const url = new URL(socket.url()); url.protocol = url.protocol === 'ws:' ? 'http:' : 'https:'; if (url.origin === allowedOrigin) socket.connectToServer(); else socket.close(); });\n});\n`;
  const runtimeFiles = {
    cli: join(root, "src/verify/cli.ts"),
    workspace: join(root, "src/verify/workspace.ts"),
    reporter: join(root, "src/verify/reporter.ts"),
    evidence: join(root, "src/verify/evidence.ts"),
    process: join(root, "src/demo/process.ts"),
  };
  const sourceHashes: Record<string, string> = {
    candidate: hash(candidate),
    guard: hash(guard),
    playwrightShim: hash(shimSource),
    playwrightShimPackage: hash(shimPackage),
  };
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
      servedPathsSha256: hash(serializeCanonicalJson(config.servedPaths)),
      timeoutMs: config.timeoutMs,
      testTimeoutMs: config.testTimeoutMs,
      resetDescriptionSha256: hash(config.resetDescription),
    },
  };
  let diagnostic: string | null = null;
  const stopped = (): void => {
    signal.throwIfAborted();
  };
  await writeFile(join(directory, "candidate.spec.ts"), candidate, { flag: "wx" });
  await writeFile(join(directory, "guard.spec.ts"), guard, { flag: "wx" });
  await mkdir(shimDirectory, { recursive: true });
  await writeFile(join(shimDirectory, "package.json"), shimPackage, { flag: "wx" });
  await writeFile(join(shimDirectory, "index.cjs"), shimSource, { flag: "wx" });
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
    assert.equal(
      hash(await readFile(join(shimDirectory, "package.json"))),
      sourceHashes.playwrightShimPackage,
      "Playwright shim package changed",
    );
    assert.equal(
      hash(await readFile(join(shimDirectory, "index.cjs"))),
      sourceHashes.playwrightShim,
      "Playwright shim changed",
    );
  };
  // Preserve only data-minimized local metadata; caller paths, raw arguments and input prose stay out.
  await writeCanonicalJsonAtomically({
    outputRoot: directory,
    relativePath: "local-config.json",
    value: {
      schemaVersion: 1,
      revisions: config.targets.map((target) => target.revision),
      candidateSha256: bundle.candidateSha256,
      startScript: config.start.nodeScript,
      startArgsSha256: bundle.settings.startArgsSha256,
      servedPathsSha256: bundle.settings.servedPathsSha256,
      origin: config.origin,
      readyPath: config.readyPath,
      resetDescriptionSha256: bundle.settings.resetDescriptionSha256,
      repetitions: config.repetitions,
      timeoutMs: config.timeoutMs,
      testTimeoutMs: config.testTimeoutMs,
    },
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
    for (const target of config.targets)
      bundle.fingerprints.push(
        (await targetIdentity(target, config.start.nodeScript, config.servedPaths, signal))
          .fingerprint,
      );
    for (const [index, target] of config.targets.entries()) {
      stopped();
      await portFree(config.origin);
      const before = await targetIdentity(
        target,
        config.start.nodeScript,
        config.servedPaths,
        signal,
      );
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
          preserveOutput: "never",
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
          {
            ...environment(),
            REPROLOCK_PLAYWRIGHT_MODULE_PATH: requireFromHere.resolve("@playwright/test"),
          },
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
        if (execution.report.planned === 0 && diagnostic === null)
          diagnostic = "Playwright discovered no runnable candidate test; inspect the candidate";
      } finally {
        const cleanups = [];
        for (const owned of [...processes].reverse()) cleanups.push(await owned.stop());
        execution.cleanup = cleanups.length > 0 && cleanups.every((c) => c.verified);
        execution.fingerprintAfter = await targetIdentity(
          target,
          config.start.nodeScript,
          config.servedPaths,
        ).then(
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
          await writeCanonicalJsonAtomically({
            outputRoot: directory,
            relativePath: `local-process-${index}-${n}.json`,
            value: {
              bytes: Buffer.byteLength(owned.output),
              sha256: hash(owned.output),
              truncated: owned.outputExceeded,
            },
          });
      }
      assert.ok(execution.cleanup && execution.cleanAfter, "Target or cleanup verification failed");
      await assertSources();
    }
    bundle.status = "completed";
  } catch (error) {
    diagnostic =
      error instanceof Error
        ? (error.message.split(/\r?\n/u)[0] ?? "Execution failed")
        : "Execution failed";
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
  return { directory, diagnostic };
}

const help = `ReproLock 0.0.0 — experimental reviewed-candidate differential verifier

Usage:
  pnpm reprolock init <case-dir> --issue <file> --pre <worktree> --post <worktree>
    --start-node <relative-entry> --origin <http://127.0.0.1:port>
    [--workflow <file>] [--start-arg <value> ...] [--served-path <path> ...]
    [--ready-path </path>]
  pnpm reprolock check <reprolock.local.json>
  pnpm reprolock run <reprolock.local.json>
  pnpm reprolock verify <export.json>
  pnpm reprolock --help | --version

init copies issue/workflow text as inert local data and creates an incomplete Playwright scaffold.
It does not interpret the issue or generate a finished test. Review the candidate and both targets:
run executes them as trusted code under your user account; ReproLock is not a sandbox.`;

function parseInit(args: string[]): InitOptions {
  const directory = args.shift();
  assert.ok(directory && !directory.startsWith("--"), "init requires a new <case-dir>");
  const values = new Map<string, string>();
  const startArgs: string[] = [];
  const servedPaths: string[] = [];
  const repeatable = new Map([
    ["--start-arg", startArgs],
    ["--served-path", servedPaths],
  ]);
  const supported = new Set([
    "--issue",
    "--workflow",
    "--pre",
    "--post",
    "--start-node",
    "--origin",
    "--ready-path",
    ...repeatable.keys(),
  ]);
  while (args.length > 0) {
    const flag = args.shift();
    assert.ok(flag && supported.has(flag), `Unknown init option: ${flag ?? ""}`);
    const value = args.shift();
    assert.ok(value !== undefined, `${flag} requires a value`);
    const list = repeatable.get(flag);
    if (list) list.push(value);
    else {
      assert.ok(!values.has(flag), `${flag} may be supplied only once`);
      values.set(flag, value);
    }
  }
  const required = (flag: string): string => {
    const value = values.get(flag);
    assert.ok(value, `init requires ${flag}`);
    return value;
  };
  const workflow = values.get("--workflow");
  return {
    directory,
    issue: required("--issue"),
    ...(workflow ? { workflow } : {}),
    pre: required("--pre"),
    post: required("--post"),
    startNode: required("--start-node"),
    startArgs,
    servedPaths,
    origin: required("--origin"),
    readyPath: values.get("--ready-path") ?? "/",
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (
    args.length === 0 ||
    (args.length === 1 && ["--help", "-h"].includes(args[0] ?? "")) ||
    (args.length === 2 && args[0] === "init" && ["--help", "-h"].includes(args[1] ?? ""))
  ) {
    console.log(help);
    return;
  }
  if (args.length === 1 && ["--version", "-V"].includes(args[0] ?? "")) {
    const manifest = object(JSON.parse(await readFile(join(root, "package.json"), "utf8")));
    console.log(String(manifest.version));
    return;
  }
  const command = args.shift();
  if (command === "init") {
    const initialized = await initializeCase(parseInit(args));
    console.log(JSON.stringify({ ok: true, ...initialized }));
    return;
  }
  const [file, ...extra] = args;
  assert.ok(
    file && extra.length === 0 && ["check", "run", "verify"].includes(command ?? ""),
    "Use --help to see the supported commands and arguments",
  );
  if (command === "verify") {
    const exportStat = await lstat(file);
    assert.ok(
      exportStat.isFile() && !exportStat.isSymbolicLink() && exportStat.size <= 8_388_608,
      "Export must be a regular non-symlink file at most 8 MiB",
    );
    const bytes = await readFile(file);
    assert.ok(bytes.length <= 8_388_608, "Export changed or exceeds 8 MiB");
    const result = verifyBundle(JSON.parse(bytes.toString("utf8")));
    console.log(JSON.stringify(result));
    process.exitCode = result.differential ? 0 : 2;
    return;
  }
  const config = await readConfig(file);
  if (command === "check") {
    const result = await check(config);
    console.log(
      JSON.stringify({
        ok: true,
        ...result,
        repetitions: config.repetitions,
        servedPaths: config.servedPaths,
        outputRoot: config.outputRoot,
      }),
    );
    return;
  }
  const controller = new AbortController();
  const cancel = (): void => controller.abort();
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  try {
    let runResult: RunResult;
    try {
      runResult = await run(config, controller.signal);
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (controller.signal.aborted || name === "AbortError" || name === "TimeoutError") {
        const status = controller.signal.aborted ? "cancelled" : "timeout";
        console.log(
          JSON.stringify({
            directory: null,
            status,
            diagnostic:
              status === "cancelled"
                ? "Run cancelled during preflight; no evidence directory was created"
                : "Run deadline reached during preflight; no evidence directory was created",
            differential: false,
            outcomes: [[], []],
            issues: ["Execution did not reach evidence creation"],
          }),
        );
        process.exitCode = status === "cancelled" ? 130 : 124;
        return;
      }
      throw error;
    }
    const bundle = JSON.parse(await readFile(join(runResult.directory, "export.json"), "utf8"));
    const result = verifyBundle(bundle);
    console.log(
      JSON.stringify({
        directory: runResult.directory,
        status: bundle.status,
        diagnostic: runResult.diagnostic,
        ...result,
      }),
    );
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
  await main().catch((error: unknown) => {
    const message =
      error instanceof Error
        ? (error.message.split(/\r?\n/u)[0] ?? "Command failed")
        : "Command failed";
    console.error(`reprolock: ${message}`);
    process.exitCode = 2;
  });
}
