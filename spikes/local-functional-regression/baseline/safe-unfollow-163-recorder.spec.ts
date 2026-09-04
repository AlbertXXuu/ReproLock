import { expect, test } from "@playwright/test";

const targetOrigin = process.env.TARGET_BASE_URL ?? "http://127.0.0.1:4173";
const interruptedState = JSON.stringify({
  state: {
    filters: [],
    currentFileName: "interrupted.zip",
    uploadStatus: "loading",
    uploadError: null,
    fileMetadata: null,
    language: "en",
  },
  version: 5,
});

test("upload is usable after an interrupted analysis", async ({ context, page }) => {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1") {
      await route.continue();
      return;
    }
    await route.abort("blockedbyclient");
  });
  await context.clearCookies();

  await page.goto(`${targetOrigin}/robots.txt`);
  await page.evaluate(async (fixture) => {
    localStorage.clear();
    sessionStorage.clear();
    if (indexedDB.databases) {
      const databases = await indexedDB.databases();
      await Promise.all(
        databases.flatMap((database) => {
          if (!database.name) return [];
          return [
            new Promise<void>((resolve, reject) => {
              const request = indexedDB.deleteDatabase(database.name as string);
              request.onsuccess = () => resolve();
              request.onerror = () => reject(request.error);
              request.onblocked = () =>
                reject(new Error(`IndexedDB deletion blocked: ${database.name}`));
            }),
          ];
        }),
      );
    }
    if ("caches" in globalThis) {
      await Promise.all((await caches.keys()).map((name) => caches.delete(name)));
    }
    if ("serviceWorker" in navigator) {
      await Promise.all(
        (await navigator.serviceWorker.getRegistrations()).map((registration) =>
          registration.unregister(),
        ),
      );
    }
    localStorage.setItem("unfollow-radar-store", fixture);
  }, interruptedState);

  await page.goto(`${targetOrigin}/upload`, { waitUntil: "networkidle" });
  await expect(page.locator("h1")).toContainText("Upload Your Instagram ZIP");
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );

  await expect(page.locator("h3", { hasText: "Analyzing locally..." })).toBeHidden();
  await expect(
    page.locator('[role="status"]', { hasText: "Processing your file, please wait..." }),
  ).toBeHidden();
  await expect(page.locator("#upload-file-input")).toBeEnabled();
  await expect(page.locator("h3", { hasText: "Drop your Instagram ZIP file here" })).toBeVisible();
});
