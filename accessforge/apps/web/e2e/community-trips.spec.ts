import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
test("nominates, opens, and revisits a trip at 320px without horizontal scrolling", async ({
  page,
}) => {
  const id = "9b647da6-eae7-47f5-9e14-e5331217cffa";
  const landmarks = [
    { key: "osm:node/11", name: "Station" },
    { key: "osm:way/22", name: "Library" },
  ];
  const trip = {
    id,
    start_name: "Station",
    end_name: "Library",
    purpose: "education",
    supports: 0,
    field_nominated: false,
  };
  let saved = false;
  await page.route("**/api/trips", (route) => {
    if (route.request().method() === "POST") {
      expect(route.request().postDataJSON()).toEqual({
        start_key: landmarks[0].key,
        end_key: landmarks[1].key,
        purpose: "education",
        source: "online",
      });
      saved = true;
      return route.fulfill({ status: 201, json: { data: { id } } });
    }
    return route.fulfill({
      json: {
        data: { landmarks, trips: saved ? [trip] : [] },
        meta: { page: 1, limit: 20, total: Number(saved) },
      },
    });
  });
  await page.route(`**/api/trips/${id}`, (route) =>
    route.fulfill({
      json: { data: { ...trip, created_at: "2026-11-18T12:00:00Z", events: [], analysis: null } },
    }),
  );
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/trips");
  // Search each field, then choose with the keyboard, as a keyboard-only visitor would.
  for (const [label, landmark] of [
    ["Start landmark", landmarks[0]],
    ["End landmark", landmarks[1]],
  ] as const) {
    await page.getByRole("combobox", { name: label }).fill(landmark.name);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("combobox", { name: label })).toHaveValue(landmark.name);
  }
  await page.getByLabel("Why this trip matters").selectOption("education");
  await page.getByRole("button", { name: "Nominate trip" }).focus();
  await page.keyboard.press("Enter");
  const receipt = page.getByRole("link", { name: "View saved trip" });
  await expect(receipt).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await receipt.click();
  await expect(page).toHaveURL(`/trips?trip=${id}`);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Station to Library" })).toBeVisible();
  await expect(
    page.getByText("Mapped trip analysis is unavailable for these landmarks."),
  ).toBeVisible();
  await page.getByRole("link", { name: "All community trips" }).click();
  await expect(page.getByRole("link", { name: "Station to Library" })).toBeVisible();
});
