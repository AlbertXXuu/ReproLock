/** JSON values accepted by ReproLock's deterministic evidence serializer. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** Raised when a value cannot be represented without lossy JSON coercion. */
export class CanonicalJsonError extends Error {
  override readonly name = "CanonicalJsonError";
}

function emitCanonicalJson(value: unknown, seen: WeakSet<object>): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new CanonicalJsonError("Canonical JSON rejects non-finite numbers");
    }

    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }

  if (typeof value !== "object") {
    throw new CanonicalJsonError(`Canonical JSON rejects values of type ${typeof value}`);
  }

  if (seen.has(value)) {
    throw new CanonicalJsonError("Canonical JSON rejects cyclic values");
  }

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getOwnPropertySymbols(value).length > 0) {
        throw new CanonicalJsonError("Canonical JSON rejects symbol keys");
      }

      const descriptors = Object.getOwnPropertyDescriptors(value);
      const ownKeys = Object.keys(descriptors);
      if (ownKeys.length !== value.length + 1 || descriptors.length === undefined) {
        throw new CanonicalJsonError("Canonical JSON rejects sparse arrays or extra array keys");
      }

      const items = Array.from({ length: value.length }, (_, index) => {
        const descriptor = descriptors[String(index)];
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
          throw new CanonicalJsonError("Canonical JSON rejects array accessors");
        }
        return emitCanonicalJson(descriptor.value, seen);
      });
      return `[${items.join(",")}]`;
    }

    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new CanonicalJsonError("Canonical JSON accepts only plain objects and arrays");
    }

    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new CanonicalJsonError("Canonical JSON rejects symbol keys");
    }

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const members: string[] = [];
    // Default sort is a stable, locale-independent UTF-16 code-unit ordering. Emit members
    // directly because JSON.stringify reorders integer-index keys even after sorted insertion.
    for (const key of Object.keys(descriptors).sort()) {
      const descriptor = descriptors[key];
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        throw new CanonicalJsonError("Canonical JSON rejects accessors or hidden properties");
      }
      members.push(`${JSON.stringify(key)}:${emitCanonicalJson(descriptor.value, seen)}`);
    }
    return `{${members.join(",")}}`;
  } finally {
    seen.delete(value);
  }
}

/**
 * Serialize a value as UTF-8-compatible JSON with recursively sorted object keys, semantic array
 * order, and exactly one trailing LF.
 */
export function serializeCanonicalJson(value: unknown): string {
  return `${emitCanonicalJson(value, new WeakSet<object>())}\n`;
}
