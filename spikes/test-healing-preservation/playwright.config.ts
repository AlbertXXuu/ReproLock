import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["control.spec.ts", "model-proposal.spec.ts"],
  repeatEach: 3,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 8_000,
  expect: { timeout: 800 },
  outputDir: "../../output/healing-preservation/artifacts",
  reporter: "json",
  use: {
    browserName: "chromium",
    headless: true,
    actionTimeout: 800,
    screenshot: "off",
    trace: "off",
    video: "off",
  },
});
