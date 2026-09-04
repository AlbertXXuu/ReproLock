import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "safe-unfollow-163.spec.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 20_000,
  expect: {
    timeout: 3_000,
  },
  outputDir: "../../../output/playwright/safe-unfollow-163/artifacts",
  reporter: "line",
  use: {
    browserName: "chromium",
    headless: true,
    screenshot: "off",
    trace: "off",
    video: "off",
    viewport: { width: 1280, height: 720 },
  },
});
