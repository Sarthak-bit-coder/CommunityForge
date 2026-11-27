import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const REPORT_ID = "9b647da6-eae7-47f5-9e14-e5331217cffa";
const MAP_LOAD_TIMEOUT_MS = 30_000;

test("report form validates, selects a map location, and submits an unverified report", async ({
  page,
}) => {
  await page.route("**/api/reports", (route) =>
    route.fulfill({
      status: 201,
      json: { data: { id: REPORT_ID, state: "unverified" }, error: null, meta: {} },
    }),
  );
  await page.goto("/report");
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByRole("group", { name: "Please correct your report" })).toBeFocused();
  await page.getByRole("link", { name: "Choose a barrier type." }).click();
  await expect(page.getByRole("radio", { name: "Missing curb ramp" })).toBeFocused();
  await page.getByRole("radio", { name: "Obstruction", exact: true }).check();
  await page.getByLabel("Description", { exact: true }).fill("Fictional blocked walkway");
  await page
    .getByRole("group", { name: "Severity (1–5)" })
    .getByLabel("3", { exact: true })
    .check();
  const center = page.getByRole("button", { name: "Use map center" });
  await expect(center).toBeVisible({ timeout: MAP_LOAD_TIMEOUT_MS });
  await page.locator(".maplibregl-canvas").click({ position: { x: 120, y: 100 } });
  await expect(page.getByLabel("Latitude", { exact: true })).not.toHaveValue("");
  await expect(page.getByRole("img", { name: "Selected report location" })).toBeVisible();
  await center.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Submit report" }).click();
  const confirmation = page.getByRole("status", { name: "Report submitted" });
  await expect(page.getByRole("heading", { name: "Report submitted" })).toBeFocused();
  await expect(confirmation).toContainText("saved with status Pending");
});

test("coordinates remain usable when the map is unavailable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.route("**/api/reports", (route) =>
    route.fulfill({
      status: 201,
      json: { data: { id: REPORT_ID, state: "unverified" }, error: null, meta: {} },
    }),
  );
  await page.goto("/report");
  await expect(page.getByText(/Enter coordinates using the fields/)).toBeVisible();
  await page.getByRole("radio", { name: "Broken or uneven surface", exact: true }).check();
  await page.getByLabel("Description", { exact: true }).fill("Fictional uneven surface");
  await page.getByLabel("Latitude", { exact: true }).fill("37.5485");
  await page.getByLabel("Longitude", { exact: true }).fill("-121.9886");
  await page
    .getByRole("group", { name: "Severity (1–5)" })
    .getByLabel("3", { exact: true })
    .check();
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByRole("status", { name: "Report submitted" })).toContainText(
    "saved with status Pending",
  );
  const tracking = page.getByRole("link", { name: "Track this report" });
  await expect(tracking).toHaveAttribute("href", `/report/track?id=${REPORT_ID}`);
  const detail = `**/api/reports/${REPORT_ID}`;
  await page.route(detail, (route) => route.fulfill({ status: 503 }));
  await tracking.click();
  await expect(page.getByRole("alert").filter({ hasText: "could not complete" })).toBeVisible();
  await page.route(detail, (route) =>
    route.fulfill({ json: { data: { id: REPORT_ID, state: "confirmed" } } }),
  );
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();
  await expect(page.getByText(REPORT_ID, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
