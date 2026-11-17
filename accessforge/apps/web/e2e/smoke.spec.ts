import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { NAV_ITEMS } from "../src/lib/navigation";

const VIEWPORT_WIDTHS = [320, 375, 768, 1440] as const;
const VIEWPORT_HEIGHT = 800;
const DESKTOP_WIDTH = 1440;
const MOBILE_WIDTH = 375;
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

for (const width of VIEWPORT_WIDTHS) {
  test.describe(`${width}px viewport`, () => {
    test.use({ viewport: { width, height: VIEWPORT_HEIGHT } });

    for (const item of NAV_ITEMS) {
      test(`${item.href} has no horizontal overflow or axe violations`, async ({ page }) => {
        await page.goto(item.href);

        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          item.heading ?? item.label,
        );
        expect(await horizontalOverflow(page)).toBe(0);
        const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
        expect(results.violations.map((violation) => violation.id)).toEqual([]);
      });
    }
  });
}

test.describe("desktop navigation", () => {
  test.use({ viewport: { width: DESKTOP_WIDTH, height: VIEWPORT_HEIGHT } });

  test("sidebar links reach every section and mark the current page", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();

    for (const item of NAV_ITEMS) {
      await nav.getByRole("link", { name: item.label, exact: true }).click();

      await expect(page).toHaveURL(item.href);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(item.heading ?? item.label);
      await expect(nav.locator('[aria-current="page"]')).toHaveText(item.label);
    }
  });

  test("skip link is the first tab stop and moves focus to main content", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeInViewport();

    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
  });
});

test.describe("mobile navigation", () => {
  test.use({ viewport: { width: MOBILE_WIDTH, height: VIEWPORT_HEIGHT } });

  test("menu opens, navigates, and closes after choosing a link", async ({ page }) => {
    await page.goto("/");
    const menuButton = page.getByRole("button", { name: "Menu" });
    const barriersLink = page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Barriers" });
    await expect(barriersLink).toBeHidden();

    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await barriersLink.click();

    await expect(page).toHaveURL("/barriers");
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(barriersLink).toBeHidden();
  });

  test("Escape closes the open menu", async ({ page }) => {
    await page.goto("/");
    const menuButton = page.getByRole("button", { name: "Menu" });

    await menuButton.click();
    await page.keyboard.press("Escape");

    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(menuButton).toBeFocused();
  });
});
