import assert from "node:assert/strict";
import { spawn } from "node:child_process";
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

  console.log(`package smoke passed (${archiveStats.size} bytes)`);
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
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
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
