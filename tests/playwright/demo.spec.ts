/// <reference lib="dom" />
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { startDemo } from "../../src/demo/server.ts";

let temporary: string;
let demo: Awaited<ReturnType<typeof startDemo>>;
test.beforeAll(async () => {
  temporary = await mkdtemp(join(tmpdir(), "reprolock-demo-ui-"));
  const config = join(temporary, "config.json");
  await writeFile(
    config,
    JSON.stringify({
      targets: {
        "pre-fix": join(temporary, "missing-pre"),
        "post-fix": join(temporary, "missing-post"),
      },
    }),
  );
  demo = await startDemo({ configPath: config, port: 0 });
});
test.afterAll(async () => {
  await demo?.close();
  if (temporary) await rm(temporary, { recursive: true, force: true });
});

test("Demo loads standalone brand resources and preserves canonical responsive header geometry", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(demo.address);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const home = page.getByRole("button", { name: "AlvenX — Back to top", exact: true });
  await expect(home).toHaveAttribute("type", "button");
  await expect(home).toHaveAttribute("data-alvenx-home", "");
  await expect(page.locator("#history-verification")).toContainText("frozen inputs verified");
  for (const width of [390, 900, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => document.fonts.ready);
    const styles = await page.locator(".ax-product-header").evaluate((header) => {
      const style = getComputedStyle(header);
      const logo = header.querySelector("img");
      return {
        top: style.top,
        padding: style.padding,
        gap: style.gap,
        radius: style.borderRadius,
        minHeight: style.minHeight,
        logoWidth: logo?.getBoundingClientRect().width,
        loaded: logo?.complete && (logo?.naturalWidth ?? 0) > 0,
        overflow: document.documentElement.scrollWidth > innerWidth,
        font: getComputedStyle(document.body).fontFamily,
        fontReady: document.fonts.check('16px "Instrument Sans"'),
      };
    });
    expect(styles).toEqual({
      top: "14px",
      padding: "12px 18px 12px 22px",
      gap: "28px",
      radius: "26px",
      minHeight: "70px",
      logoWidth: 160,
      loaded: true,
      overflow: false,
      font: '"Instrument Sans", "Microsoft YaHei UI", "PingFang SC", Arial, sans-serif',
      fontReady: true,
    });
  }
  await page.locator("#start").focus();
  expect(
    await page.locator("#start").evaluate((element) => getComputedStyle(element).outlineStyle),
  ).toBe("solid");
  await home.focus();
  expect(await home.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("solid");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe(
    "auto",
  );
  for (const resource of [
    "alvenx-wordmark.svg",
    "alvenx-monogram.svg",
    "alvenx-ui.css",
    "InstrumentSans-wdth-wght.woff2",
    "InstrumentSans-OFL.txt",
  ])
    expect((await page.request.get(`${demo.address}/assets/${resource}`)).ok()).toBe(true);
  expect(errors).toEqual([]);
});

test("saved startup failure survives header home activation without navigation or reloading", async ({
  page,
}) => {
  await page.goto(demo.address);
  await page.getByRole("button", { name: "Run 20 + 20 checks" }).click();
  await expect(page.locator("#state-badge")).toHaveText("Startup failed");
  await expect(page.locator("#observed-count")).toContainText("0 completed");
  await expect(page.locator("#verification")).toContainText("20 + 20 differential: Unconfirmed");
  await expect(page.locator("#history-verification")).toContainText("Stored bundle:");
  const id = (await page.locator("#run-id").innerText()).replace("output/demo/", "");
  await page.locator("#retained-runs").getByText(id, { exact: true }).click();
  await expect(page.locator("#state-badge")).toHaveText("Saved run · Startup failed");
  await expect(page.locator("#timing")).toContainText("Not re-executed");
  const exported = await page.request.get(`${demo.address}/api/export/${id}`);
  expect((await exported.json()).schemaVersion).toBe(1);

  await page.getByRole("link", { name: "ReproLock", exact: true }).click();
  await page.getByText("Inspect the frozen test", { exact: true }).click();
  const retainedState = () =>
    page.evaluate(() => ({
      url: location.href,
      historyLength: history.length,
      historyState: history.state,
      documentStarted: performance.timeOrigin,
      run: document.querySelector(".run-panel")?.textContent,
      export: document.querySelector("#export")?.getAttribute("href"),
      sourceOpen: document.querySelector(".source-detail")?.hasAttribute("open"),
    }));
  const before = await retainedState();
  expect(before.url).toContain("#main");
  expect(before.sourceOpen).toBe(true);
  const home = page.getByRole("button", { name: "AlvenX — Back to top", exact: true });
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion });
    for (const activation of ["click", "Enter", "Space"]) {
      await page.evaluate(() =>
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
      );
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      if (activation === "click") await home.click();
      else await home.press(activation);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      expect(await retainedState()).toEqual(before);
    }
    await home.click();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(await retainedState()).toEqual(before);
  }
});

test("saved run controls reflect a start request still pending after execution finishes", async ({
  page,
}) => {
  const release = Promise.withResolvers<void>();
  const received = Promise.withResolvers<void>();
  await page.route("**/api/start", async (route) => {
    const response = await route.fetch();
    received.resolve();
    await release.promise;
    await route.fulfill({ response });
  });
  try {
    await page.goto(demo.address);
    await page.getByRole("button", { name: "Run 20 + 20 checks" }).click();
    await received.promise;
    await expect(page.locator("#state-badge")).toHaveText("Startup failed");
    const id = (await page.locator("#run-id").innerText()).replace("output/demo/", "");
    const saved = page.locator("#retained-runs").getByText(id, { exact: true });
    await expect(saved).toHaveAttribute("aria-disabled", "true");
    let savedRequests = 0;
    page.on("request", (request) => {
      if (request.url().includes(`/api/run/${id}`)) savedRequests++;
    });
    await saved.dispatchEvent("click");
    expect(savedRequests).toBe(0);
    release.resolve();
    await expect(saved).toHaveAttribute("aria-disabled", "false");
    await saved.click();
    await expect(page.locator("#state-badge")).toHaveText("Saved run · Startup failed");
    await page.waitForResponse((response) => response.url() === `${demo.address}/api/state`);
    await expect(page.locator("#state-badge")).toHaveText("Saved run · Startup failed");
  } finally {
    release.resolve();
  }
});

test("concurrent controls admit exactly one configured run and reject foreign control requests", async ({
  page,
}) => {
  await page.goto(demo.address);
  const statuses = await page.evaluate(async () => {
    const token = document.querySelector<HTMLMetaElement>('meta[name="demo-token"]')?.content ?? "";
    return Promise.all(
      [1, 2].map(
        async () =>
          (
            await fetch("/api/start", {
              method: "POST",
              headers: { "content-type": "application/json", "x-demo-token": token },
              body: "{}",
            })
          ).status,
      ),
    );
  });
  expect(statuses.sort()).toEqual([202, 409]);
  const rejected = await page.request.post(`${demo.address}/api/start`, {
    data: {},
    headers: { Origin: "https://example.invalid" },
  });
  expect(rejected.status()).toBe(403);
  await expect(page.locator("#state-badge")).toHaveText("Startup failed");
});
