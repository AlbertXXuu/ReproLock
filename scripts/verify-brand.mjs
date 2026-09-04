import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Validate only committed resources, so a standalone clone needs no AlvenX parent checkout. */
export async function verifyBrand(root) {
  const provenance = JSON.parse(await readFile(join(root, "docs/assets/provenance.json"), "utf8"));
  assert.equal(provenance.schemaVersion, 1);
  assert.equal(provenance.brandRevision, "2026-08-24.1");
  assert.equal(provenance.interfaceRevision, "2026-08-25.2");
  const names = [
    "alvenx-wordmark.svg",
    "alvenx-monogram.svg",
    "alvenx-ui.css",
    "InstrumentSans-wdth-wght.woff2",
    "InstrumentSans-OFL.txt",
  ];
  assert.deepEqual(
    provenance.assets.map((asset) => asset.path).sort(),
    names.map((name) => `docs/assets/${name}`).sort(),
  );
  for (const asset of provenance.assets) {
    const bytes = await readFile(join(root, asset.path));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256, asset.path);
  }
  const svg = await readFile(join(root, "docs/assets/alvenx-wordmark.svg"), "utf8");
  assert.match(svg, /viewBox="0 0 330 100"/u);
  const readmes = (await readdir(root)).filter((name) => /^README(?:[._-].*)?\.md$/iu.test(name));
  assert.ok(readmes.includes("README.md"));
  for (const name of readmes) {
    const source = await readFile(join(root, name), "utf8");
    assert.match(
      source,
      /^<p align="center">\s*<img src="docs\/assets\/alvenx-wordmark\.svg" width="320" alt="AlvenX"\s*\/?>(?:\s*)<\/p>\s*# ReproLock\b/u,
      `${name}: centered 320px canonical wordmark must precede the title`,
    );
  }
  return {
    ok: true,
    assets: names.length,
    readmes: readmes.length,
    brandRevision: provenance.brandRevision,
    interfaceRevision: provenance.interfaceRevision,
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  console.log(JSON.stringify(await verifyBrand(root)));
}
