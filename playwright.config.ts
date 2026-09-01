import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/playwright",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 10_000,
  expect: {
    timeout: 3_000,
  },
  outputDir: "output/playwright/artifacts",
  reporter: "line",
  use: {
    browserName: "chromium",
    headless: true,
    screenshot: "off",
    trace: "off",
    video: "off",
    viewport: { width: 1_280, height: 720 },
  },
});
