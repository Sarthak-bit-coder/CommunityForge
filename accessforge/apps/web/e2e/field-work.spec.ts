import { expect, test } from "@playwright/test";
import corridor from "../src/test/corridor-plan.json";

const report = {
  id: "9b647da6-eae7-47f5-9e14-e5331217cffa",
  type: "obstruction",
  state: "unverified",
  severity: 3,
  description: "Unchecked report text",
  location: { latitude: 37.5, longitude: -122 },
  evidence: [],
  created_at: "2026-11-16T12:00:00Z",
};
const envelope = (data: unknown) => ({ data, meta: { page: 1, limit: 20, total: 1 } });

test("a mobile reporter finds a nearby report and keeps their draft", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.route("**/api/reports?**", (route) => route.fulfill({ json: envelope([report]) }));
  await page.goto("/report");
  await page.getByRole("radio", { name: "Obstruction", exact: true }).check();
  await page.getByLabel("Latitude", { exact: true }).fill("37.5");
  await page.getByLabel("Longitude", { exact: true }).fill("-122");
  await page.getByLabel("Description", { exact: true }).fill("Draft observation");
  await page.getByRole("button", { name: "Check nearby reports" }).click();
  await expect(page.getByRole("link", { name: /about 0 m/ })).toHaveAttribute(
    "href",
    `/report/track?id=${report.id}`,
  );
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue("Draft observation");
  await page.getByLabel("Latitude", { exact: true }).fill("38");
  await expect(page.getByRole("link", { name: /about 0 m/ })).toHaveCount(0);
});

test("print layout includes the selected visit and hides reviewer-only content", async ({
  page,
}) => {
  await page.route("**/api/reviewer/session", (route) =>
    route.fulfill({ json: envelope({ reviewer_id: "field-reviewer" }) }),
  );
  await page.route("**/api/reports**", (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({
      json: envelope(url.search ? [report] : url.pathname.endsWith("/reviews") ? [] : report),
    });
  });
  await page.goto("/verify");
  await page.getByRole("button", { name: `View details for Report ${report.id}` }).click();
  await page.getByRole("button", { name: "Add to field checklist" }).click();
  await page.emulateMedia({ media: "print" });
  const list = page.getByRole("region", { name: "Field visit checklist" });
  await expect(list).toContainText("37.5, -122");
  await expect(list).toContainText(report.id);
  await expect(
    page.getByText(report.description, { exact: true }).filter({ visible: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/Reviewer ID field-reviewer/)).toBeHidden();
  await expect(page.getByRole("button", { name: "Print field checklist" })).toBeHidden();
});

test("compares a saved budget with the current modeled plan", async ({ page }) => {
  await page.route("**/api/planning/plans?**", (route) => {
    const budget = Number(new URL(route.request().url()).searchParams.get("budget"));
    const plans = corridor.plans.map((p) =>
      budget === 0
        ? {
            ...p,
            selected_repair_ids: [],
            total_cost: 0,
            accessibility_after: corridor.accessibility_before,
            delta_a: 0,
            explanations: [],
            route_impacts: [],
          }
        : p,
    );
    return route.fulfill({
      json: envelope({ ...corridor, budget, snapshot_id: "fixture-snapshot", plans }),
    });
  });
  await page.goto("/planner");
  await page.getByRole("button", { name: "Save scenario to compare" }).click();
  await page.getByLabel("Budget (cost units)").fill("0");
  await page.getByRole("button", { name: "Run plan" }).click();
  const changes = page.getByRole("region", { name: "Budget changes" });
  await expect(changes).toContainText("Repairs removed: r0, r1");
  await expect(changes).toContainText("Trip details unavailable");
});
