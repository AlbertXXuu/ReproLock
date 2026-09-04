import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, open, realpath, rm, stat } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";

import { serializeCanonicalJson } from "./canonical-json.ts";

export type AtomicEvidenceWrite = {
  readonly relativePath: string;
  readonly sha256: string;
  readonly bytes: number;
};

/** Raised before a write whose destination is not a bounded file path below the output root. */
export class BoundedPathError extends Error {
  override readonly name = "BoundedPathError";
}

function isWithin(root: string, candidate: string): boolean {
  const fromRoot = relative(root, candidate);
  return (
    fromRoot === "" ||
    (!isAbsolute(fromRoot) && fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`))
  );
}

const windowsReservedName =
  /^(?:con|prn|aux|nul|clock\$|conin\$|conout\$|com[1-9\u00b9\u00b2\u00b3]|lpt[1-9\u00b9\u00b2\u00b3])(?:\.|$)/iu;
const windowsInvalidCharacter = /["<>|?*]/u;

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x1f || codeUnit === 0x7f) {
      return true;
    }
  }
  return false;
}

function parsePortableRelativeFilePath(relativePath: string): readonly string[] {
  if (
    relativePath.length === 0 ||
    relativePath.startsWith("/") ||
    relativePath.includes("\\") ||
    relativePath.includes(":") ||
    windowsInvalidCharacter.test(relativePath) ||
    hasControlCharacter(relativePath) ||
    isAbsolute(relativePath)
  ) {
    throw new BoundedPathError("Evidence path must name a relative file");
  }

  const segments = relativePath.split("/");
  for (const segment of segments) {
    if (
      segment.length === 0 ||
      segment === "." ||
      segment === ".." ||
      /[. ]$/u.test(segment) ||
      windowsReservedName.test(segment)
    ) {
      throw new BoundedPathError("Evidence path contains a non-portable component");
    }
  }

  return segments;
}

async function createBoundedParent(root: string, segments: readonly string[]): Promise<string> {
  let current = root;

  for (const segment of segments) {
    const candidate = join(current, segment);
    try {
      await mkdir(candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }

    const resolvedCandidate = await realpath(candidate);
    if (!isWithin(root, resolvedCandidate) || !(await stat(resolvedCandidate)).isDirectory()) {
      throw new BoundedPathError("Evidence parent resolves outside the output root");
    }
    current = resolvedCandidate;
  }

  return current;
}

/**
 * Write one canonical JSON file through a same-directory temporary file and atomic hard-link
 * publication. The function never overwrites an existing evidence path, bounds the resolved
 * parent directory to `outputRoot`, and reports any failed temporary cleanup.
 */
export async function writeCanonicalJsonAtomically(options: {
  readonly outputRoot: string;
  readonly relativePath: string;
  readonly value: unknown;
}): Promise<AtomicEvidenceWrite> {
  const pathSegments = parsePortableRelativeFilePath(options.relativePath);

  await mkdir(options.outputRoot, { recursive: true });
  const root = await realpath(options.outputRoot);
  const fileName = pathSegments[pathSegments.length - 1];
  if (fileName === undefined) {
    throw new BoundedPathError("Evidence path must name a relative file");
  }

  const parentSegments = pathSegments.slice(0, -1);
  const lexicalTarget = join(root, ...pathSegments);
  if (!isWithin(root, lexicalTarget)) {
    throw new BoundedPathError("Evidence path escapes the output root");
  }

  const parent = await createBoundedParent(root, parentSegments);

  const target = join(parent, fileName);
  if (!isWithin(root, target)) {
    throw new BoundedPathError("Evidence target resolves outside the output root");
  }

  const contents = serializeCanonicalJson(options.value);
  const bytes = Buffer.from(contents, "utf8");
  const temporary = join(parent, `.${fileName}.${randomUUID()}.tmp`);
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  let operationFailed = false;
  let operationError: unknown;

  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await link(temporary, target);
  } catch (error) {
    operationFailed = true;
    operationError = error;
  }

  const cleanupErrors: unknown[] = [];
  if (handle !== undefined) {
    try {
      await handle.close();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  try {
    await rm(temporary, { force: true });
  } catch (error) {
    cleanupErrors.push(error);
  }

  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      operationFailed ? [operationError, ...cleanupErrors] : cleanupErrors,
      "Evidence write cleanup failed",
    );
  }
  if (operationFailed) {
    throw operationError;
  }

  return {
    relativePath: relative(root, target).split(sep).join("/"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.byteLength,
  };
}
