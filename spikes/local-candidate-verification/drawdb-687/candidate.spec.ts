import { expect, test } from "@playwright/test";

test("returns to the homepage after editing a table", async ({ context, page }) => {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port === "4175") {
      await route.continue();
      return;
    }
    await route.abort("blockedbyclient");
  });
  await context.clearCookies();

  await test.step("reset", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("link", { name: /Try it for yourself/i }).click();
    await page.getByText("MySQL", { exact: true }).click();
    await page.getByRole("button", { name: /confirm/i }).click();
    await page.getByRole("tab", { name: "Tables (0)" }).waitFor({ state: "visible" });
    const initialTableCount = await page.locator("svg foreignObject").count();
    expect(initialTableCount, "[reset-checkpoint:empty-diagram]").toBe(0);
  });

  await page.getByText("No changes", { exact: true }).waitFor({ state: "visible", timeout: 5_000 });
  await page.getByRole("button", { name: /Add table/i }).click();
  await page.getByRole("tab", { name: "Tables (1)" }).waitFor({ state: "visible" });
  await page.getByText(/^Last saved /).waitFor({ state: "visible", timeout: 5_000 });

  await test.step("outcome", async () => {
    const observedPathname = await page.evaluate(
      () =>
        new Promise<string>((resolve, reject) => {
          const timer = setTimeout(
            () =>
              reject(new Error("[observation-timeout:popstate] No popstate after history.back()")),
            2_000,
          );
          addEventListener(
            "popstate",
            () => {
              clearTimeout(timer);
              resolve(location.pathname);
            },
            { once: true },
          );
          history.back();
        }),
    );
    expect(observedPathname, "[functional-checkpoint:back-returns-home]").toBe("/");
  });
});
