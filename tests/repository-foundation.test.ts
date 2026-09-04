import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

type PackageManifest = {
  readonly version: string;
  readonly private: boolean;
  readonly engines: Record<string, string>;
  readonly packageManager: string;
  readonly scripts: Record<string, string>;
  readonly devDependencies: Record<string, string>;
};

const repositoryRoot = new URL("../", import.meta.url);

async function readPackageManifest(): Promise<PackageManifest> {
  const contents = await readFile(new URL("package.json", repositoryRoot), "utf8");
  return JSON.parse(contents) as PackageManifest;
}

test("the repository root stays private and unreleased", async () => {
  const manifest = await readPackageManifest();

  assert.equal(manifest.private, true);
  assert.equal(manifest.version, "0.0.0");
});

test("the supported runtime and toolchain are pinned", async () => {
  const manifest = await readPackageManifest();
  const primaryNodeVersion = await readFile(new URL(".nvmrc", repositoryRoot), "utf8");

  assert.equal(primaryNodeVersion.trim(), "24.20.0");
  assert.equal(manifest.engines.node, ">=22.23.2 <25");
  assert.equal(manifest.engines.pnpm, "11.19.0");
  assert.equal(manifest.packageManager, "pnpm@11.19.0");
  assert.equal(manifest.devDependencies.typescript, "7.0.2");
  assert.equal(manifest.devDependencies["@types/node"], "22.20.1");
  assert.equal(manifest.devDependencies["@biomejs/biome"], "2.5.11");
});

test("the required verification entry points remain available", async () => {
  const manifest = await readPackageManifest();
  const requiredScripts = [
    "format:check",
    "lint",
    "typecheck",
    "test:unit",
    "test:browser",
    "test",
    "package:smoke",
    "reprolock",
    "quickstart",
    "brand:verify",
    "evidence:verify",
    "demo:verify:recorded",
    "drawdb:verify:recorded",
  ];

  for (const scriptName of requiredScripts) {
    assert.equal(typeof manifest.scripts[scriptName], "string", `missing script: ${scriptName}`);
  }

  assert.equal(manifest.devDependencies["@playwright/test"], "1.62.1");
});

test("CI invokes the complete package quality gate", async () => {
  const workflow = await readFile(new URL(".github/workflows/ci.yml", repositoryRoot), "utf8");
  assert.match(workflow, /^\s*run: pnpm check\s*$/mu);
  assert.doesNotMatch(workflow, /pull_request_target/u);
});
