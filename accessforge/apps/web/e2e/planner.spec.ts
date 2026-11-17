import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import corridor from "../src/test/corridor-plan.json" with { type: "json" };

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const WIDTHS = [320, 1440] as const;

// The response body is a captured real engine result; only the transport is intercepted.
for (const width of WIDTHS) {
  test(`planner results are accessible and fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.route("**/api/planning/plans?*", (route) =>
      route.fulfill({ json: { data: corridor, error: null, meta: {} } }),
    );
    await page.goto("/planner");

    await expect(
      page.getByRole("heading", { name: "Recommended plan", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("20 of 20")).toBeVisible();
    await expect(page.getByRole("img", { name: /2 barriers, 2 repaired/ })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(
      results.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 120)).join(" | ")}`,
      ),
    ).toEqual([]);
  });
}

test("a keyboard user can change the budget, rerun, and save a scenario", async ({ page }) => {
  const requested: string[] = [];
  await page.route("**/api/planning/plans?*", (route) => {
    requested.push(new URL(route.request().url()).search);
    return route.fulfill({ json: { data: corridor, error: null, meta: {} } });
  });
  await page.goto("/planner");
  await expect(page.getByText("20 of 20")).toBeVisible();

  const budget = page.getByLabel("Budget (cost units)");
  await budget.focus();
  await budget.fill("-3");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Enter a budget between 0 and/)).toBeVisible();

  await budget.fill("15");
  await page.keyboard.press("Enter");
  await expect.poll(() => requested.at(-1)).toBe("?dataset=corridor&budget=15");

  const save = page.getByRole("button", { name: "Save scenario to compare" });
  await save.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("table", { name: /Saved scenarios/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download summary (CSV)" })).toHaveAttribute(
    "download",
    /accessforge-plan-corridor/,
  );
});
