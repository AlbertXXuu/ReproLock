import { expect, test, type Page } from "@playwright/test";

const targetOrigin = process.env.TARGET_BASE_URL ?? "http://127.0.0.1:4173";
const interruptedAnalysisFixture = JSON.stringify({
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

async function clearOriginState(page: Page): Promise<void> {
  await page.evaluate(async () => {
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
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  });
}

test("recovers the upload page after interrupted local analysis", async ({ browser }) => {
  const context = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1280, height: 720 },
    hasTouch: false,
  });

  try {
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "127.0.0.1") {
        await route.continue();
        return;
      }
      await route.abort("blockedbyclient");
    });
    await context.clearCookies();
    const page = await context.newPage();

    // Arrange: use a script-free same-origin resource so the app cannot repopulate storage while
    // the explicit reset is being verified.
    await page.goto(`${targetOrigin}/robots.txt`, {
      waitUntil: "domcontentloaded",
      timeout: 10_000,
    });
    await clearOriginState(page);

    const emptyOriginState = await page.evaluate(async () => ({
      cacheStorageEntries: "caches" in globalThis ? (await caches.keys()).length : 0,
      indexedDbDatabases: indexedDB.databases ? (await indexedDB.databases()).length : 0,
      localStorageEntries: localStorage.length,
      serviceWorkerRegistrations:
        "serviceWorker" in navigator
          ? (await navigator.serviceWorker.getRegistrations()).length
          : 0,
      sessionStorageEntries: sessionStorage.length,
    }));
    expect(emptyOriginState, "[reset-checkpoint:origin-storage-cleared]").toEqual({
      cacheStorageEntries: 0,
      indexedDbDatabases: 0,
      localStorageEntries: 0,
      serviceWorkerRegistrations: 0,
      sessionStorageEntries: 0,
    });

    await page.evaluate((fixture) => {
      localStorage.setItem("unfollow-radar-store", fixture);
    }, interruptedAnalysisFixture);
    expect(
      await page.evaluate(() => localStorage.getItem("unfollow-radar-store")),
      "[reset-checkpoint:interrupted-state-seeded]",
    ).toBe(interruptedAnalysisFixture);

    // Act: return to /upload exactly as a user reopening an interrupted analysis would.
    await page.goto(`${targetOrigin}/upload`, {
      waitUntil: "domcontentloaded",
      timeout: 10_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 10_000 });
    await expect(page, "[setup-checkpoint:upload-route-ready]").toHaveURL(/\/upload$/);
    await expect(
      page.getByRole("heading", { name: "Upload Your Instagram ZIP", exact: true }),
      "[setup-checkpoint:upload-page-ready]",
    ).toBeVisible({ timeout: 10_000 });
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );

    // Assert: the final rehydrated UI, not storage or model output, is authoritative.
    await expect(
      page.getByText("Analyzing locally...", { exact: true }),
      "[functional-checkpoint:processing-cleared]",
    ).toBeHidden();
    await expect(
      page.getByRole("status").filter({ hasText: "Processing your file, please wait..." }),
      "[functional-checkpoint:processing-announcement-cleared]",
    ).toBeHidden();
    await expect(
      page.getByLabel("Upload Instagram data ZIP file", { exact: true }),
      "[functional-checkpoint:file-input-enabled]",
    ).toBeEnabled();
    await expect(
      page.getByText("Drop your Instagram ZIP file here", { exact: true }),
      "[functional-checkpoint:idle-prompt-visible]",
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
