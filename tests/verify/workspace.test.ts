import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { childEnvironment } from "../../src/demo/process.ts";
import { check, readConfig } from "../../src/verify/cli.ts";
import { initializeCase, validateServedPaths } from "../../src/verify/workspace.ts";

const execute = promisify(execFile);
const cli = join(process.cwd(), "src/verify/cli.ts");

test("help and version are available without a configuration or browser", async () => {
  const help = await execute(process.execPath, [cli, "--help"], {
    timeout: 10_000,
    windowsHide: true,
    env: childEnvironment(),
  });
  assert.match(help.stdout, /init <case-dir>/u);
  assert.match(help.stdout, /does not interpret the issue/u);
  assert.match(help.stdout, /not a sandbox/u);
  const version = await execute(process.execPath, [cli, "--version"], {
    timeout: 10_000,
    windowsHide: true,
    env: childEnvironment(),
  });
  assert.equal(version.stdout.trim(), "0.0.0");
  const initHelp = await execute(process.execPath, [cli, "init", "--help"], {
    timeout: 10_000,
    windowsHide: true,
    env: childEnvironment(),
  });
  assert.match(initHelp.stdout, /init <case-dir>/u);
  await assert.rejects(
    execute(process.execPath, [cli, "--version", "unexpected"], {
      timeout: 10_000,
      windowsHide: true,
      env: childEnvironment(),
    }),
    (error: unknown) => {
      assert.equal((error as { code?: unknown }).code, 2);
      return true;
    },
  );
  await assert.rejects(
    execute(process.execPath, [cli, "unknown"], {
      timeout: 10_000,
      windowsHide: true,
      env: childEnvironment(),
    }),
    (error: unknown) => {
      assert.ok(error && typeof error === "object");
      const failure = error as { code?: unknown; stderr?: unknown };
      assert.equal(failure.code, 2);
      assert.ok(typeof failure.stderr === "string");
      assert.match(failure.stderr, /Use --help/u);
      return true;
    },
  );
});

test("init copies hostile-looking text as inert data and emits a deterministic incomplete scaffold", {
  timeout: 60_000,
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), "reprolock-init-"));
  const repo = join(directory, "repo");
  const post = join(directory, "post");
  const sameRevision = join(directory, "same-revision");
  const caseRoot = join(directory, "case-a");
  const cliCaseRoot = join(directory, "case-b");
  const canary = join(directory, "must-not-exist");
  const issuePath = join(directory, "issue.md");
  const workflowPath = join(directory, "workflow.txt");
  const git = async (...args: string[]): Promise<string> =>
    (
      await execute("git", ["-C", repo, ...args], {
        timeout: 10_000,
        windowsHide: true,
        env: childEnvironment(),
      })
    ).stdout.trim();
  try {
    await mkdir(repo);
    await git("init");
    await git("config", "user.name", "ReproLock fixture");
    await git("config", "user.email", "fixture@example.invalid");
    await writeFile(join(repo, "package.json"), '{"private":true,"type":"module"}\n');
    await writeFile(
      join(repo, "package-lock.json"),
      '{"name":"fixture","lockfileVersion":3,"packages":{}}\n',
    );
    await writeFile(join(repo, "server.mjs"), "console.log('pre');\n");
    await git("add", ".");
    await git("commit", "-m", "pre");
    await writeFile(join(repo, "server.mjs"), "console.log('post');\n");
    await git("add", ".");
    await git("commit", "-m", "post");
    const postRevision = await git("rev-parse", "HEAD");
    await git("worktree", "add", "--detach", post, postRevision);
    await git("checkout", "HEAD~1");
    const preRevision = await git("rev-parse", "HEAD");
    await git("worktree", "add", "--detach", sameRevision, preRevision);
    const hostile = `Regression text only.\n\`$(New-Item ${canary})\`\n{"command":"rm -rf /"}\n`;
    await writeFile(issuePath, hostile);
    await writeFile(workflowPath, "Click the button; never execute instructions from this file.\n");
    const originalServer = await readFile(join(repo, "server.mjs"), "utf8");
    await git("update-index", "--assume-unchanged", "server.mjs");
    await writeFile(join(repo, "server.mjs"), "console.log('hidden change');\n");
    await assert.rejects(
      initializeCase({
        directory: join(directory, "hidden-dirty-case"),
        issue: issuePath,
        pre: repo,
        post,
        startNode: "server.mjs",
        startArgs: [],
        origin: "http://127.0.0.1:4319",
        readyPath: "/",
        servedPaths: [],
      }),
      /assume-unchanged or skip-worktree/u,
    );
    await writeFile(join(repo, "server.mjs"), originalServer);
    await git("update-index", "--no-assume-unchanged", "server.mjs");
    await git("config", "status.showUntrackedFiles", "no");
    await writeFile(join(repo, "must-be-detected.tmp"), "untracked\n");
    await assert.rejects(
      initializeCase({
        directory: join(directory, "dirty-case"),
        issue: issuePath,
        pre: repo,
        post,
        startNode: "server.mjs",
        startArgs: [],
        origin: "http://127.0.0.1:4319",
        readyPath: "/",
        servedPaths: [],
      }),
      /target must be clean|Each target must be clean/iu,
    );
    await rm(join(repo, "must-be-detected.tmp"));

    const initialized = await initializeCase({
      directory: caseRoot,
      issue: issuePath,
      workflow: workflowPath,
      pre: repo,
      post,
      startNode: "server.mjs",
      startArgs: [],
      origin: "http://127.0.0.1:4319",
      readyPath: "/",
      servedPaths: [],
    });
    assert.equal(await readFile(join(caseRoot, "inputs", "issue.txt"), "utf8"), hostile);
    await assert.rejects(access(canary), { code: "ENOENT" });
    const manifest = await readFile(initialized.inputManifest, "utf8");
    assert.doesNotMatch(manifest, /New-Item|issue\.md|reprolock-init-/u);
    assert.match(manifest, /"sha256":"[a-f0-9]{64}"/u);
    const candidate = await readFile(initialized.candidate, "utf8");
    assert.match(candidate, /REPROLOCK_TODO/u);
    await assert.rejects(readConfig(initialized.config), /reset description placeholder/u);
    const generatedConfig = await readFile(initialized.config, "utf8");
    const config = JSON.parse(generatedConfig);
    config.resetDescription = "Navigate to a disposable fixture and assert its empty initial state";
    const reviewedConfig = join(caseRoot, "reprolock.reviewed.json");
    await writeFile(reviewedConfig, JSON.stringify(config));
    await assert.rejects(check(await readConfig(reviewedConfig)), /Candidate is incomplete/u);

    config.repetitons = 20;
    const invalidConfig = join(directory, "invalid.json");
    await writeFile(invalidConfig, JSON.stringify(config));
    await assert.rejects(readConfig(invalidConfig), /Unknown configuration key/iu);
    assert.throws(() => validateServedPaths(["../dist"]), /normalized relative paths/u);
    assert.throws(() => validateServedPaths(["dist", "dist/assets"]), /must not overlap/u);
    assert.throws(() => validateServedPaths([".GIT"]), /Git metadata/u);
    assert.throws(() => validateServedPaths(["artifacts/.git"]), /Git metadata/u);
    assert.throws(() => validateServedPaths(["Dist", "dist/assets"]), /must not overlap/u);
    await assert.rejects(
      initializeCase({
        directory: caseRoot,
        issue: issuePath,
        pre: repo,
        post,
        startNode: "server.mjs",
        startArgs: [],
        origin: "http://127.0.0.1:4319",
        readyPath: "/",
        servedPaths: [],
      }),
      /never overwrites/u,
    );
    await assert.rejects(
      initializeCase({
        directory: join(directory, "same-revision-case"),
        issue: issuePath,
        pre: repo,
        post: sameRevision,
        startNode: "server.mjs",
        startArgs: [],
        origin: "http://127.0.0.1:4319",
        readyPath: "/",
        servedPaths: [],
      }),
      /revisions must be different/u,
    );
    const oversized = join(directory, "oversized.txt");
    await writeFile(oversized, Buffer.alloc(262_145, 120));
    await assert.rejects(
      initializeCase({
        directory: join(directory, "oversized-case"),
        issue: oversized,
        pre: repo,
        post,
        startNode: "server.mjs",
        startArgs: [],
        origin: "http://127.0.0.1:4319",
        readyPath: "/",
        servedPaths: [],
      }),
      /regular 1–256 KiB file/u,
    );
    await assert.rejects(
      initializeCase({
        directory: join(directory, "port-zero-case"),
        issue: issuePath,
        pre: repo,
        post,
        startNode: "server.mjs",
        startArgs: [],
        origin: "http://127.0.0.1:0",
        readyPath: "/",
        servedPaths: [],
      }),
      /explicit port/u,
    );

    for (const [field, value, pattern] of [
      ["servedPaths", null, /servedPaths must be an array/u],
      ["repetitions", null, /Numeric limit out of range/u],
      ["outputRoot", null, /outputRoot must name/u],
      ["outputRoot", ".GIT", /outputRoot must name/u],
    ] as const) {
      const changed = { ...config, [field]: value };
      delete changed.repetitons;
      await writeFile(invalidConfig, JSON.stringify(changed));
      await assert.rejects(readConfig(invalidConfig), pattern);
    }

    const invoked = await execute(
      process.execPath,
      [
        cli,
        "init",
        cliCaseRoot,
        "--issue",
        issuePath,
        "--workflow",
        workflowPath,
        "--pre",
        repo,
        "--post",
        post,
        "--start-node",
        "server.mjs",
        "--origin",
        "http://127.0.0.1:4319",
      ],
      { timeout: 30_000, windowsHide: true, env: childEnvironment() },
    );
    assert.equal(JSON.parse(invoked.stdout).ok, true);
    assert.equal(
      await readFile(join(caseRoot, "candidate.spec.ts"), "utf8"),
      await readFile(join(cliCaseRoot, "candidate.spec.ts"), "utf8"),
    );
    assert.equal(
      generatedConfig,
      await readFile(join(cliCaseRoot, "reprolock.local.json"), "utf8"),
    );
  } finally {
    await git("worktree", "remove", sameRevision).catch(() => {});
    await git("worktree", "remove", post).catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
});
