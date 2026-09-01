import { expect, test } from "@playwright/test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createConnection } from "node:net";

import type { LoopbackFixture } from "../../fixtures/loopback/server.ts";
import { startLoopbackFixture } from "../../fixtures/loopback/server.ts";

let fixture: LoopbackFixture | undefined;

test.beforeAll(async () => {
  fixture = await startLoopbackFixture();
});

test.afterAll(async () => {
  if (fixture === undefined) {
    return;
  }
  const healthUrl = `${fixture.origin}/health`;
  const origin = new URL(fixture.origin);
  const slowClient = createConnection({ host: origin.hostname, port: Number(origin.port) });
  slowClient.on("error", () => undefined);
  await once(slowClient, "connect");
  slowClient.write(`GET / HTTP/1.1\r\nHost: ${origin.host}\r\n`);
  const slowClientClosed = new Promise<void>((resolveClose) => {
    slowClient.once("close", () => resolveClose());
  });

  const startedAt = performance.now();
  const firstClose = fixture.close();
  const concurrentClose = fixture.close();
  assert.equal(firstClose, concurrentClose);
  await Promise.all([firstClose, concurrentClose, slowClientClosed]);
  assert.ok(performance.now() - startedAt < 1_500, "fixture cleanup exceeded its bound");
  await fixture.close();
  await assert.rejects(fetch(healthUrl, { signal: AbortSignal.timeout(1_000) }));
});

test("a user-visible preference persists after reload", async ({ page }) => {
  if (fixture === undefined) {
    throw new Error("Loopback fixture did not start");
  }
  await page.goto(fixture.origin);

  await expect(page.getByRole("heading", { name: "Notification preferences" })).toBeVisible();
  const preference = page.getByRole("checkbox", { name: "Product updates" });
  await expect(preference).not.toBeChecked();

  await preference.check();
  await expect(page.getByRole("status")).toHaveText("Saved: enabled");

  await page.reload();
  await expect(preference).toBeChecked();
  await expect(page.getByRole("status")).toHaveText("Saved: enabled");
});
