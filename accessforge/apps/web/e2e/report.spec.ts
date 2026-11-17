import { expect, test } from "@playwright/test";

const MAP_LOAD_TIMEOUT_MS = 30_000;

test("report form validates, selects a map location, and submits an unverified report", async ({
  page,
}) => {
  await page.route("**/api/reports", (route) =>
    route.fulfill({ status: 201, json: { data: { id: "test-report" }, error: null, meta: {} } }),
  );
  await page.goto("/report");
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByRole("alert", { name: "Please correct your report" })).toBeFocused();
  await page.getByRole("link", { name: "Choose a barrier type." }).click();
  await expect(page.getByLabel("Barrier type")).toBeFocused();
  await page.getByLabel("Barrier type").selectOption("obstruction");
  await page.getByLabel("Description", { exact: true }).fill("Fictional blocked walkway");
  await page.getByLabel("Severity (1–5)").selectOption("3");
  const center = page.getByRole("button", { name: "Use map center" });
  await expect(center).toBeVisible({ timeout: MAP_LOAD_TIMEOUT_MS });
  await page.locator(".maplibregl-canvas").click({ position: { x: 120, y: 100 } });
  await expect(page.getByLabel("Latitude", { exact: true })).not.toHaveValue("");
  await expect(page.getByRole("img", { name: "Selected report location" })).toBeVisible();
  await center.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Submit report" }).click();
  const confirmation = page.getByRole("status", { name: "Report submitted" });
  await expect(confirmation).toBeFocused();
  await expect(confirmation).toContainText("saved with status Pending");
});

test("coordinates remain usable when the map is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.route("**/api/reports", (route) =>
    route.fulfill({ status: 201, json: { data: { id: "test-report" }, error: null, meta: {} } }),
  );
  await page.goto("/report");
  await expect(page.getByText(/Enter coordinates using the fields/)).toBeVisible();
  await page.getByLabel("Barrier type").selectOption("surface_problem");
  await page.getByLabel("Description", { exact: true }).fill("Fictional uneven surface");
  await page.getByLabel("Latitude", { exact: true }).fill("37.5485");
  await page.getByLabel("Longitude", { exact: true }).fill("-121.9886");
  await page.getByLabel("Severity (1–5)").selectOption("3");
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByRole("status", { name: "Report submitted" })).toContainText(
    "saved with status Pending",
  );
});
