import { expect, test, type Page } from "@playwright/test";

// Headless Chromium renders WebGL in software; with the whole suite in parallel the map can take
// well over the default 5 s to fire "load".
const MAP_LOAD_TIMEOUT_MS = 30_000;
const SAMPLE_COUNT = 10;
const MARKER = /^Sample barrier \d+\./;

async function openLoadedMap(page: Page): Promise<void> {
  await page.goto("/barriers");
  await page.getByLabel("Data source").selectOption("demo");
  await expect(page.getByText("Loading map…")).toBeHidden({ timeout: MAP_LOAD_TIMEOUT_MS });
}

test.describe("barrier map", () => {
  test("renders the MapLibre map with a marker per barrier", async ({ page }) => {
    await openLoadedMap(page);

    await expect(page.getByText("The map could not be loaded")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Accessibility barrier map" })).toBeVisible();
    await expect(page.getByRole("button", { name: MARKER })).toHaveCount(SAMPLE_COUNT);
  });

  test("Tab moves from the map to its markers and Enter selects one", async ({ page }) => {
    await openLoadedMap(page);
    const firstMarker = page.getByRole("button", { name: /^Sample barrier 1\./ });

    await page.getByRole("region", { name: "Accessibility barrier map" }).focus();
    await page.keyboard.press("Tab");
    await expect(firstMarker).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(firstMarker).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { level: 2, name: "Sample barrier 1" })).toBeVisible();
  });

  test("filters update the map markers and the list together", async ({ page }) => {
    await openLoadedMap(page);

    await page.getByLabel("Verification status").selectOption({ label: "Pending" });

    await expect(page.getByRole("status")).toHaveText("Showing 3 of 10 sample barriers.");
    await expect(page.getByRole("button", { name: MARKER })).toHaveCount(3);
    await expect(page.getByRole("button", { name: /^View details for/ })).toHaveCount(3);
  });
});
