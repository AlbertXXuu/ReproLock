import { expect, test } from "@playwright/test";
import { createFixture } from "./fixture.ts";

for (const ui of ["old", "new"] as const) {
  for (const buggy of [false, true]) {
    for (const strategy of ["original", "repaired", "weakened"] as const) {
      test(`${ui} / ${buggy ? "bug" : "correct"} / ${strategy}`, async ({
        page,
        browser,
      }, testInfo) => {
        const fixture = await createFixture(ui, buggy);
        let failure: Error | undefined;
        try {
          await page.goto(fixture.url);
          try {
            if (strategy === "original") {
              await page.locator("#quantity").fill("2");
              await page.locator("#shipping").selectOption("express");
              await page.locator("#coupon").fill("FLAT2");
              await page.locator("#place").click();
            } else {
              await page.getByLabel("Quantity", { exact: true }).fill("2");
              await page.getByLabel("Shipping", { exact: true }).selectOption("express");
              await page.getByLabel("Coupon", { exact: true }).fill("FLAT2");
              await page.getByRole("button", { name: "Place order", exact: true }).click();
            }
            await expect(
              page.getByRole("status", { name: "Order acknowledgement", exact: true }),
            ).toHaveText("Order received");
            if (strategy !== "weakened")
              await expect(page.getByLabel("Charged amount")).toHaveText("$23.00");
          } catch (error) {
            if (!(error instanceof Error)) throw error;
            failure = error;
          }
          const charges = fixture.readCommittedCharges();
          const locatorFailure = strategy === "original" && ui === "new";
          if (locatorFailure) {
            expect(charges).toEqual([]);
            expect(failure?.name).toBe("TimeoutError");
          } else {
            expect(charges).toEqual([buggy ? 2500 : 2300]);
            expect(Boolean(failure)).toBe(buggy && strategy !== "weakened");
            if (failure) expect(failure.message).toContain("getByLabel('Charged amount')");
          }
          const classification = locatorFailure
            ? "locator-failure"
            : failure
              ? "business-bug-captured"
              : buggy
                ? "false-green"
                : "correct-pass";
          await testInfo.attach("business-observation", {
            body: Buffer.from(
              JSON.stringify({
                ui,
                buggy,
                strategy,
                repeat: testInfo.repeatEachIndex,
                testOutcome: failure ? "fail" : "pass",
                committedChargesCents: charges,
                requiredChargeCents: 2300,
                classification,
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
    test(`${ui} / ${buggy ? "bug" : "correct"} / skipped`, async () => {
      test.fixme(true, "A skipped output has no executable business-bug coverage.");
    });
  }
}
