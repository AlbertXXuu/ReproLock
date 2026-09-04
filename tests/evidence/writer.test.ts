import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

import { BoundedPathError, writeCanonicalJsonAtomically } from "../../src/evidence/writer.ts";

async function withTemporaryRoot(run: (root: string) => Promise<void>): Promise<void> {
  const prefix = resolve(tmpdir(), "reprolock-writer-");
  const root = await mkdtemp(prefix);
  assert.equal(resolve(root).startsWith(prefix), true);
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("atomic evidence writes expose only canonical final bytes", async () => {
  await withTemporaryRoot(async (root) => {
    const result = await writeCanonicalJsonAtomically({
      outputRoot: root,
      relativePath: "attempts/attempt-001.json",
      value: { z: 2, a: 1 },
    });

    assert.deepEqual(result, {
      relativePath: "attempts/attempt-001.json",
      sha256: "e750fc3b813c1ee27425cbdfce0d76814a07f8397e05a125d99eb23788b94365",
      bytes: 14,
    });
    assert.equal(await readFile(join(root, result.relativePath), "utf8"), '{"a":1,"z":2}\n');
    assert.deepEqual(await readdir(join(root, "attempts")), ["attempt-001.json"]);

    await assert.rejects(
      writeCanonicalJsonAtomically({
        outputRoot: root,
        relativePath: result.relativePath,
        value: { replacement: true },
      }),
      { code: "EEXIST" },
    );
    assert.equal(await readFile(join(root, result.relativePath), "utf8"), '{"a":1,"z":2}\n');
    assert.deepEqual(await readdir(join(root, "attempts")), ["attempt-001.json"]);
  });
});

test("the writer rejects traversal before creating an escaped file", async () => {
  await withTemporaryRoot(async (root) => {
    const escaped = resolve(root, "..", "escaped.json");
    await assert.rejects(
      writeCanonicalJsonAtomically({
        outputRoot: root,
        relativePath: "../escaped.json",
        value: { unsafe: true },
      }),
      BoundedPathError,
    );
    await assert.rejects(readFile(escaped, "utf8"), { code: "ENOENT" });
  });
});

test("the writer rejects non-portable path syntax before creating files", async () => {
  await withTemporaryRoot(async (root) => {
    for (const relativePath of [
      "evidence.json:stream",
      "CON.txt",
      "nested\\escape.json",
      "nested//escape.json",
      "trailing./file.json",
      "invalid?/file.json",
      "invalid*.json",
      'invalid".json',
      "invalid<.json",
      "invalid>.json",
      "invalid|.json",
      "COM\u00b9.txt",
      "LPT\u00b3.log",
      "CONIN$",
      "CONOUT$.json",
      "CLOCK$",
    ]) {
      await assert.rejects(
        writeCanonicalJsonAtomically({
          outputRoot: root,
          relativePath,
          value: { unsafe: true },
        }),
        BoundedPathError,
      );
    }

    assert.deepEqual(await readdir(root), []);
  });
});

test("the writer rejects a parent link that resolves outside the output root", async () => {
  const outsidePrefix = resolve(tmpdir(), "reprolock-outside-");
  const outside = await mkdtemp(outsidePrefix);
  assert.equal(resolve(outside).startsWith(outsidePrefix), true);
  try {
    await withTemporaryRoot(async (root) => {
      await symlink(
        outside,
        join(root, "escape"),
        process.platform === "win32" ? "junction" : "dir",
      );
      await assert.rejects(
        writeCanonicalJsonAtomically({
          outputRoot: root,
          relativePath: "escape/escaped.json",
          value: { unsafe: true },
        }),
        BoundedPathError,
      );
      await assert.rejects(readFile(join(outside, "escaped.json"), "utf8"), { code: "ENOENT" });
    });
  } finally {
    await rm(outside, { recursive: true, force: true });
  }
});

test("a failed final publication removes its temporary file", async () => {
  await withTemporaryRoot(async (root) => {
    await mkdir(join(root, "blocked.json"));
    await assert.rejects(
      writeCanonicalJsonAtomically({
        outputRoot: root,
        relativePath: "blocked.json",
        value: { complete: true },
      }),
    );

    const residual = (await readdir(root)).filter((entry) => entry.endsWith(".tmp"));
    assert.deepEqual(residual, []);
    assert.equal(dirname(join(root, "blocked.json")), root);
  });
});
