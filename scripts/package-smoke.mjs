import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pnpmExecPath = process.env.npm_execpath;

assert.ok(pnpmExecPath, "package:smoke must be launched by pnpm so npm_execpath is available");

const temporaryDirectory = await mkdtemp(join(tmpdir(), "reprolock-package-smoke-"));

try {
  await runPnpm(["pack", "--pack-destination", temporaryDirectory]);

  const archiveNames = (await readdir(temporaryDirectory)).filter((name) => name.endsWith(".tgz"));
  assert.equal(archiveNames.length, 1, "pnpm pack must create exactly one tarball");

  const archivePath = join(temporaryDirectory, archiveNames[0]);
  const archiveStats = await stat(archivePath);
  assert.ok(archiveStats.isFile(), "the packed artifact must be a file");
  assert.ok(archiveStats.size > 0, "the packed artifact must not be empty");

  const entries = execFileSync("tar", ["-tzf", archivePath], {
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 1_048_576,
  })
    .trim()
    .split(/\r?\n/u);
  assert.ok(entries.includes("package/package.json"));
  assert.ok(entries.includes("package/src/domain/verdict.ts"));
  for (const path of [
    "LICENSE",
    "NOTICE",
    "THIRD_PARTY_NOTICES.md",
    "TRADEMARKS.md",
    "src/verify/cli.ts",
    "src/verify/evidence.ts",
    "src/verify/reporter.ts",
    "src/verify/workspace.ts",
    "scripts/quickstart.mjs",
    "docs/local-verification.md",
    "scripts/verify-drawdb-recording.mjs",
    "spikes/local-candidate-verification/drawdb-687/candidate.spec.ts",
    "spikes/local-candidate-verification/drawdb-687/playwright.config.ts",
    "spikes/local-candidate-verification/drawdb-687/tsconfig.json",
    "spikes/local-candidate-verification/drawdb-687/REPORT.md",
    "spikes/local-candidate-verification/drawdb-687/evidence/comparison.json",
    "spikes/local-candidate-verification/drawdb-687/evidence/reprolock.json",
    "src/demo/server.ts",
    "src/demo/public/index.html",
    "src/demo/public/app.js",
    "src/demo/public/app.css",
    "docs/assets/alvenx-wordmark.svg",
    "docs/assets/alvenx-ui.css",
    "docs/assets/InstrumentSans-wdth-wght.woff2",
    "docs/assets/InstrumentSans-OFL.txt",
  ])
    assert.ok(
      entries.includes(`package/${path}`),
      `standalone source archive must contain ${path}`,
    );
  assert.ok(
    !entries.includes("package/docs/brand-registration.patch"),
    "obsolete parent-workspace patch must not ship",
  );
  assert.ok(
    entries.includes(
      "package/spikes/local-functional-regression/generated/safe-unfollow-163.spec.ts",
    ),
  );
  for (const path of entries) {
    assert.ok(
      path.startsWith("package/") && !path.split("/").includes(".."),
      "archive paths must be relative",
    );
    assert.ok(
      !/(?:^|\/)(?:node_modules|output|targets|\.git|\.env)(?:\/|$|\.)/u.test(path),
      "archive must exclude local state",
    );
  }
  const packed = JSON.parse(
    execFileSync("tar", ["-xOf", archivePath, "package/package.json"], {
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 1_048_576,
    }),
  );
  assert.equal(packed.private, true);
  assert.equal(packed.version, "0.0.0");
  console.log(
    `archive content smoke passed (${entries.length} files, ${archiveStats.size} bytes); installability/publication not claimed`,
  );
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}

async function runPnpm(arguments_) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [pnpmExecPath, ...arguments_], {
      cwd: repositoryRoot,
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      timeout: 60_000,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      if (stdout.length + chunk.length > 1_048_576) {
        child.kill();
        reject(new Error("pack output limit exceeded"));
        return;
      }
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length + chunk.length > 1_048_576) {
        child.kill();
        reject(new Error("pack output limit exceeded"));
        return;
      }
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (exitCode) => {
      if (exitCode === 0) {
        resolvePromise();
        return;
      }

      reject(
        new Error(
          [`pnpm ${arguments_.join(" ")} exited with code ${exitCode}`, stdout, stderr]
            .filter(Boolean)
            .join("\n"),
        ),
      );
    });
  });
}
