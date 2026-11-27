import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const REPORT_ID = "9b647da6-eae7-47f5-9e14-e5331217cffa";
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const WIDTHS = [
  { name: "phone", width: 375, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

async function axeViolations(page: Page) {
  // Mid-fade colours are blends; check contrast once entrances have settled.
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running"),
  );
  return (await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations;
}

function acceptReports(page: Page) {
  return page.route("**/api/reports", (route) =>
    route.fulfill({
      status: 201,
      json: { data: { id: REPORT_ID, state: "unverified" }, error: null, meta: {} },
    }),
  );
}

// Keyboard only: focus each control, Space and arrows for radios, typing for text.
async function completeWithKeyboard(page: Page) {
  await page.getByRole("radio", { name: "Obstruction", exact: true }).focus();
  await page.keyboard.press("Space");
  await page.getByLabel("Description", { exact: true }).focus();
  await page.keyboard.type("Fictional blocked walkway");
  await page.getByLabel("Latitude", { exact: true }).focus();
  await page.keyboard.type("37.5485");
  await page.keyboard.press("Tab");
  await page.keyboard.type("-121.9886");
  await page
    .getByRole("group", { name: "Severity (1–5)" })
    .getByLabel("1", { exact: true })
    .focus();
  await page.keyboard.press("ArrowRight");
}

for (const size of WIDTHS) {
  test(`validation, failure, retry, and success on ${size.name} width`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    let calls = 0;
    await page.route("**/api/reports", (route) => {
      calls += 1;
      return calls === 1
        ? route.fulfill({ status: 503, json: { error: { message: "Service unavailable" } } })
        : route.fulfill({
            status: 201,
            json: { data: { id: REPORT_ID, state: "unverified" }, error: null, meta: {} },
          });
    });
    await page.goto("/report");
    await page.getByRole("radio", { name: "Obstruction", exact: true }).check();
    await page.getByLabel("Description", { exact: true }).fill("Fictional blocked walkway");
    await page.getByRole("button", { name: "Submit report" }).click();

    const summary = page.getByRole("group", { name: "Please correct your report" });
    await expect(summary).toBeFocused();
    await expect(summary).toContainText("2 of 2 steps need attention.");
    expect(await axeViolations(page)).toEqual([]);

    await page.getByLabel("Latitude", { exact: true }).fill("37.5485");
    await page.getByLabel("Longitude", { exact: true }).fill("-121.9886");
    await page
      .getByRole("group", { name: "Severity (1–5)" })
      .getByLabel("3", { exact: true })
      .check();
    await expect(summary).toContainText("All steps fixed. Submit the report again.");
    await expect(page.getByText("4 of 4 ready. Ready to submit.")).toBeVisible();

    await page.getByRole("button", { name: "Submit report" }).click();
    const toast = page.getByRole("region", { name: "Notifications" });
    await expect(toast).toContainText("Report not submitted");
    await toast.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("heading", { name: "Report submitted" })).toBeFocused();
    await expect(toast).toContainText("It is pending verification by a reviewer.");
    await expect(toast.getByRole("button", { name: /undo/i })).toHaveCount(0);
    expect(calls).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(await axeViolations(page)).toEqual([]);
  });
}

test("keyboard only with reduced motion shows final states at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await acceptReports(page);
  await page.goto("/report");
  await completeWithKeyboard(page);
  await expect(page.getByText("4 of 4 ready. Ready to submit.")).toBeVisible();
  await page.getByRole("button", { name: "Submit report" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Report submitted" })).toBeFocused();
});

test("steps completed in reverse order still reach Ready to submit", async ({ page }) => {
  await page.goto("/report");
  await page
    .getByRole("group", { name: "Severity (1–5)" })
    .getByLabel("4", { exact: true })
    .check();
  await page.getByLabel("Latitude", { exact: true }).fill("37.5485");
  await page.getByLabel("Longitude", { exact: true }).fill("-121.9886");
  await page.getByLabel("Description", { exact: true }).fill("Fictional blocked walkway");
  await expect(page.getByRole("link", { name: "Next: Barrier type" })).toBeVisible();
  await page.getByRole("radio", { name: "Missing sidewalk", exact: true }).check();
  await expect(page.getByText("4 of 4 ready. Ready to submit.")).toBeVisible();
});
