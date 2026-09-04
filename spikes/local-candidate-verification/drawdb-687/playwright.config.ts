import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "candidate.spec.ts",
  workers: 1,
  retries: 0,
  repeatEach: 20,
  forbidOnly: true,
  timeout: 20_000,
  globalTimeout: 600_000,
  outputDir: "../../../output/drawdb-standalone",
  reporter: "json",
  use: {
    baseURL: "http://127.0.0.1:4175",
    browserName: "chromium",
    headless: true,
    viewport: { width: 1280, height: 720 },
    serviceWorkers: "block",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
