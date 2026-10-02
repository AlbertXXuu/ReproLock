import { expect, test } from "@playwright/test";
import { createFixture } from "./fixture.ts";

// Reviewed proposal from one Codex CLI invocation. Only literal newline escapes
// were decoded; the business assertions and actions are unchanged.
for (const buggy of [false, true]) {
  test(`model proposal / new / ${buggy ? "bug" : "correct"}`, async ({
    page,
    browser,
  }, testInfo) => {
    const fixture = await createFixture("new", buggy);
    let failure: Error | undefined;
    try {
      await page.goto(fixture.url);
      try {
        await page.getByLabel("Quantity", { exact: true }).fill("2");
        await page.getByLabel("Shipping", { exact: true }).selectOption("express");
        await page.getByLabel("Coupon", { exact: true }).fill("FLAT2");
        await page.getByRole("button", { name: "Place order", exact: true }).click();
        await expect(
          page.getByRole("status", { name: "Order acknowledgement", exact: true }),
        ).toHaveText("Order received");
        await expect(page.getByLabel("Charged amount", { exact: true })).toHaveText("$23.00");
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        failure = error;
      }
      const charges = fixture.readCommittedCharges();
      expect(charges).toEqual([buggy ? 2500 : 2300]);
      expect(Boolean(failure)).toBe(buggy);
      if (failure) expect(failure.message).toContain("getByLabel('Charged amount'");
      await testInfo.attach("business-observation", {
        body: Buffer.from(
          JSON.stringify({
            ui: "new",
            buggy,
            strategy: "model-proposal",
            repeat: testInfo.repeatEachIndex,
            testOutcome: failure ? "fail" : "pass",
            committedChargesCents: charges,
            requiredChargeCents: 2300,
            classification: failure ? "business-bug-captured" : "correct-pass",
            browserVersion: browser.version(),
          }),
        ),
        contentType: "application/json",
      });
    } finally {
      await fixture.close();
    }
  });
}
