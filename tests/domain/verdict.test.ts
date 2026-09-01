import assert from "node:assert/strict";
import test from "node:test";

import type { AttemptResult } from "../../src/domain/verdict.ts";
import { serializeAttemptResult } from "../../src/domain/verdict.ts";
import { CanonicalJsonError, serializeCanonicalJson } from "../../src/evidence/canonical-json.ts";

test("attempt results serialize to stable versioned bytes", () => {
  const result: AttemptResult = {
    schemaVersion: 1,
    attemptId: "attempt-001",
    status: "completed",
    stage: "persisted",
    verdict: {
      kind: "fail",
      firstFailedCheckpoint: {
        id: "preference-persists-after-reload",
        expected: "enabled",
        observed: "disabled",
      },
      evidence: [
        {
          path: "attempts/attempt-001.json",
          sha256: "0123456789abcdef",
        },
      ],
    },
  };

  assert.equal(
    serializeAttemptResult(result),
    '{"attemptId":"attempt-001","schemaVersion":1,"stage":"persisted","status":"completed","verdict":{"evidence":[{"path":"attempts/attempt-001.json","sha256":"0123456789abcdef"}],"firstFailedCheckpoint":{"expected":"enabled","id":"preference-persists-after-reload","observed":"disabled"},"kind":"fail"}}\n',
  );
});

test("canonical JSON sorts object keys while preserving array order", () => {
  assert.equal(
    serializeCanonicalJson({ z: 1, nested: { b: 2, a: 1 }, actions: ["open", "save"] }),
    '{"actions":["open","save"],"nested":{"a":1,"b":2},"z":1}\n',
  );
});

test("canonical JSON uses lexical UTF-16 ordering for numeric and Unicode keys", () => {
  assert.equal(
    serializeCanonicalJson({
      2: "two",
      10: "ten",
      "01": "leading",
      "\u00e9": 1,
      "e\u0301": 2,
      "\u{1f600}": 3,
      "\ue000": 4,
    }),
    '{"01":"leading","10":"ten","2":"two","e\u0301":2,"\u00e9":1,"\u{1f600}":3,"\ue000":4}\n',
  );
});

test("canonical JSON preserves an own __proto__ member as data", () => {
  const value: unknown = JSON.parse('{"__proto__":{"admin":true},"safe":1}');
  assert.equal(serializeCanonicalJson(value), '{"__proto__":{"admin":true},"safe":1}\n');
});

test("canonical JSON rejects lossy or cyclic values", () => {
  assert.throws(() => serializeCanonicalJson({ value: Number.NaN }), CanonicalJsonError);
  assert.throws(() => serializeCanonicalJson({ value: undefined }), CanonicalJsonError);

  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  assert.throws(() => serializeCanonicalJson(cyclic), CanonicalJsonError);

  const sparse = new Array<unknown>(1);
  assert.throws(() => serializeCanonicalJson(sparse), CanonicalJsonError);

  let getterExecuted = false;
  const accessor = Object.defineProperty({}, "value", {
    enumerable: true,
    get: () => {
      getterExecuted = true;
      return 1;
    },
  });
  assert.throws(() => serializeCanonicalJson(accessor), CanonicalJsonError);
  assert.equal(getterExecuted, false);

  const hidden = Object.defineProperty({}, "value", { value: 1, enumerable: false });
  assert.throws(() => serializeCanonicalJson(hidden), CanonicalJsonError);

  const arrayWithSymbol = [1];
  Object.defineProperty(arrayWithSymbol, Symbol("hidden"), { value: 2 });
  assert.throws(() => serializeCanonicalJson(arrayWithSymbol), CanonicalJsonError);

  const arrayWithHiddenProperty = [1];
  Object.defineProperty(arrayWithHiddenProperty, "hidden", { value: 2, enumerable: false });
  assert.throws(() => serializeCanonicalJson(arrayWithHiddenProperty), CanonicalJsonError);
});
