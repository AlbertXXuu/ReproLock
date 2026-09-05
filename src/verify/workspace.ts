import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { serializeCanonicalJson } from "../evidence/canonical-json.ts";
import { hash } from "./evidence.ts";

const execute = promisify(execFile);
const inputLimit = 262_144;

export type InitOptions = {
  directory: string;
  issue: string;
  workflow?: string;
  pre: string;
  post: string;
  startNode: string;
  startArgs: string[];
  origin: string;
  readyPath: string;
  servedPaths: string[];
};

export type InitializedCase = {
  directory: string;
  config: string;
  candidate: string;
  inputManifest: string;
};

/** Reject index flags that let tracked working-tree changes disappear from ordinary Git status. */
export function assertOrdinaryTrackedIndex(value: string, label = "Target"): void {
  const entries = value.split("\0").filter(Boolean);
  assert.ok(
    entries.every((entry) => entry.startsWith("H ")),
    `${label} index must not use assume-unchanged or skip-worktree entries`,
  );
}

export function validateServedPaths(value: unknown): string[] {
  assert.ok(
    Array.isArray(value) && value.length <= 16,
    "servedPaths must be an array of at most 16 paths",
  );
  const paths = value.map((item) => {
    assert.ok(
      typeof item === "string" &&
        item.length > 0 &&
        item.length <= 256 &&
        /^[a-zA-Z0-9_.@/-]+$/u.test(item) &&
        !isAbsolute(item) &&
        item !== "." &&
        !item.startsWith("/") &&
        !item.endsWith("/") &&
        !item.split("/").some((part) => !part || part === ".." || part === "."),
      "servedPaths entries must be normalized relative paths",
    );
    return item;
  });
  assert.equal(new Set(paths).size, paths.length, "servedPaths entries must be unique");
  const folded = paths.map((path) => path.toLowerCase());
  assert.equal(
    new Set(folded).size,
    paths.length,
    "servedPaths entries must be unique across supported filesystems",
  );
  for (const path of folded)
    assert.ok(
      !path.split("/").includes(".git"),
      "servedPaths cannot include Git metadata at any depth",
    );
  for (const [index, path] of folded.entries())
    for (const other of folded.slice(index + 1))
      assert.ok(
        !path.startsWith(`${other}/`) && !other.startsWith(`${path}/`),
        "servedPaths entries must not overlap",
      );
  return paths.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

const inside = (parent: string, child: string): boolean => {
  const distance = relative(parent, child);
  return distance !== ".." && !distance.startsWith(`..${sep}`) && !isAbsolute(distance);
};

const environment = (): NodeJS.ProcessEnv =>
  Object.fromEntries(
    Object.entries(process.env).filter(([key]) =>
      /^(?:PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|HOME|USERPROFILE)$/iu.test(key),
    ),
  );

async function git(path: string, args: string[]): Promise<string> {
  return (
    await execute("git", ["-C", path, ...args], {
      timeout: 10_000,
      maxBuffer: 1_048_576,
      windowsHide: true,
      env: environment(),
    })
  ).stdout.trim();
}

async function target(path: string): Promise<{ path: string; revision: string; common: string }> {
  const root = await realpath(resolve(path));
  assert.equal(
    await realpath(await git(root, ["rev-parse", "--show-toplevel"])),
    root,
    "Each target must be a Git worktree root",
  );
  assertOrdinaryTrackedIndex(await git(root, ["ls-files", "-v", "-z"]), "Target");
  assert.equal(
    await git(root, [
      "-c",
      "core.fsmonitor=false",
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
      "--ignore-submodules=none",
    ]),
    "",
    "Each target must be clean",
  );
  const revision = await git(root, ["rev-parse", "HEAD"]);
  assert.match(revision, /^[a-f0-9]{40}$/u, "Targets require full Git revisions");
  const common = await realpath(resolve(root, await git(root, ["rev-parse", "--git-common-dir"])));
  return { path: root, revision, common };
}

async function inertText(path: string, label: string): Promise<Buffer> {
  const inputPath = resolve(path);
  const info = await lstat(inputPath);
  assert.ok(
    info.isFile() && !info.isSymbolicLink() && info.size > 0 && info.size <= inputLimit,
    `${label} must be a regular 1–256 KiB file`,
  );
  const bytes = await readFile(inputPath);
  assert.ok(bytes.length > 0 && bytes.length <= inputLimit, `${label} changed or exceeds 256 KiB`);
  assert.ok(!bytes.includes(0), `${label} must be plain UTF-8 text`);
  const text = bytes.toString("utf8");
  assert.ok(Buffer.from(text, "utf8").equals(bytes), `${label} must be valid UTF-8 text`);
  return bytes;
}

function savedTarget(caseRoot: string, targetRoot: string): string {
  const distance = relative(caseRoot, targetRoot);
  return (distance && !isAbsolute(distance) ? distance : targetRoot).split(sep).join("/");
}

const candidate = `import { expect, test } from "@playwright/test";

// This file is executable, trusted code. Review the supplied issue/workflow, then replace every
// REPROLOCK_TODO marker with an observed reset, the minimum user action, and one scalar outcome.
const REPROLOCK_TODO = "replace every placeholder before running";

test("describe the functional regression", async ({ page }) => {
  await test.step("reset", async () => {
    await page.goto("/");
    // Assert the real initial state after an explicit reset.
    expect(REPROLOCK_TODO).toBe("observed reset value");
  });

  await test.step("act", async () => {
    // Perform only the user actions needed to reach the business outcome.
    throw new Error(REPROLOCK_TODO);
  });

  await test.step("outcome", async () => {
    // Read one scalar from the application, then compare it at this stable callsite.
    const observed = REPROLOCK_TODO;
    expect(observed).toBe("expected fixed value");
  });
});
`;

function caseReadme(): string {
  return `# ReproLock case workspace

This directory was created from explicit local inputs. ReproLock copied the issue and optional
workflow into \`inputs/\` as inert data; it did not interpret them or generate a finished test.

1. Read \`inputs/issue.txt\` and optional \`inputs/workflow.txt\`.
2. Review and complete \`candidate.spec.ts\`. Remove every \`REPROLOCK_TODO\` marker.
3. Review \`reprolock.local.json\`, including the trusted Node entry, arguments, reset description,
   and any ignored build directories listed in \`servedPaths\`.
4. From the ReproLock checkout, run:

   \`corepack pnpm reprolock check path/to/reprolock.local.json\`

   \`corepack pnpm reprolock run path/to/reprolock.local.json\`

5. Independently recheck the printed portable bundle:

   \`corepack pnpm reprolock verify path/to/runs/run-.../export.json\`

The candidate and both target worktrees are trusted executable code, not sandboxed input. Keep this
workspace outside the target worktrees. The local configuration, copied inputs and run directory are
ignored by default because they can contain local paths or application data. Inspect the standalone
candidate and portable export before sharing either one.
`;
}

/** Create a deterministic, non-overwriting case workspace from explicit user-supplied inputs. */
export async function initializeCase(options: InitOptions): Promise<InitializedCase> {
  const servedPaths = validateServedPaths(options.servedPaths);
  assert.ok(
    /^[a-zA-Z0-9_./-]+\.(?:[cm]?js|ts)$/u.test(options.startNode) &&
      !isAbsolute(options.startNode) &&
      !options.startNode.split("/").includes(".."),
    "--start-node must be a relative trusted Node entry point",
  );
  assert.ok(
    options.startArgs.length <= 32 &&
      options.startArgs.every(
        (value) => value.length <= 512 && !value.includes("\0") && !/[\r\n]/u.test(value),
      ),
    "--start-arg values must be bounded single-line strings",
  );
  const url = new URL(options.origin);
  assert.ok(
    url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      url.port &&
      Number(url.port) >= 1 &&
      !url.username &&
      !url.password &&
      url.href === `${url.origin}/`,
    "--origin must be http://127.0.0.1 with an explicit port",
  );
  assert.ok(
    options.readyPath.startsWith("/") &&
      !options.readyPath.includes("?") &&
      new URL(options.readyPath, url).origin === url.origin,
    "--ready-path must stay on the configured origin",
  );

  const destination = resolve(options.directory);
  const parent = await realpath(dirname(destination));
  assert.ok(
    inside(parent, destination) && basename(destination).length > 0,
    "Invalid case directory",
  );
  await lstat(destination).then(
    () => assert.fail("Case directory already exists; ReproLock never overwrites it"),
    (error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    },
  );
  const [pre, post, issue, workflow] = await Promise.all([
    target(options.pre),
    target(options.post),
    inertText(options.issue, "Issue input"),
    options.workflow ? inertText(options.workflow, "Workflow input") : undefined,
  ]);
  assert.equal(
    pre.common,
    post.common,
    "Targets must be worktrees of the same supplied repository",
  );
  assert.notEqual(pre.path, post.path, "Pre-fix and post-fix targets must be different worktrees");
  assert.notEqual(pre.revision, post.revision, "Pre-fix and post-fix revisions must be different");
  for (const root of [pre.path, post.path])
    assert.ok(
      !inside(root, destination) && !inside(destination, root),
      "Keep the case workspace outside both target worktrees",
    );

  const temporary = await mkdtemp(join(parent, `.${basename(destination)}.reprolock-`));
  try {
    await mkdir(join(temporary, "inputs"));
    await writeFile(join(temporary, "inputs", "issue.txt"), issue, { flag: "wx", mode: 0o600 });
    if (workflow)
      await writeFile(join(temporary, "inputs", "workflow.txt"), workflow, {
        flag: "wx",
        mode: 0o600,
      });
    const inputs = [
      { kind: "issue", path: "inputs/issue.txt", bytes: issue.length, sha256: hash(issue) },
      ...(workflow
        ? [
            {
              kind: "workflow",
              path: "inputs/workflow.txt",
              bytes: workflow.length,
              sha256: hash(workflow),
            },
          ]
        : []),
    ];
    await writeFile(
      join(temporary, "inputs", "manifest.json"),
      serializeCanonicalJson({ schemaVersion: 1, inputs }),
      { flag: "wx", mode: 0o600 },
    );
    await writeFile(join(temporary, "candidate.spec.ts"), candidate, { flag: "wx", mode: 0o600 });
    await writeFile(join(temporary, "README.md"), caseReadme(), { flag: "wx", mode: 0o600 });
    await writeFile(join(temporary, ".gitignore"), "inputs/\nreprolock.local.json\nruns/\n", {
      flag: "wx",
      mode: 0o600,
    });
    const config = {
      schemaVersion: 1,
      candidate: "./candidate.spec.ts",
      targets: [
        { path: savedTarget(destination, pre.path), revision: pre.revision },
        { path: savedTarget(destination, post.path), revision: post.revision },
      ],
      start: { nodeScript: options.startNode, args: options.startArgs },
      servedPaths,
      origin: url.origin,
      readyPath: options.readyPath,
      resetDescription: "REPROLOCK_TODO: describe the reset and its observable postcondition",
      repetitions: 1,
      timeoutMs: 180_000,
      testTimeoutMs: 15_000,
      outputRoot: "./runs",
    };
    await writeFile(join(temporary, "reprolock.local.json"), serializeCanonicalJson(config), {
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
  return {
    directory: destination,
    config: join(destination, "reprolock.local.json"),
    candidate: join(destination, "candidate.spec.ts"),
    inputManifest: join(destination, "inputs", "manifest.json"),
  };
}
