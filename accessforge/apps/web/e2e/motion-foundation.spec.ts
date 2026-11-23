import { expect, test } from "@playwright/test";

const DESKTOP = { width: 1440, height: 900 };
// Sidebar indicator token (--color-sidebar-accent #f2c230); the page ring is too dark on navy.
const SIDEBAR_FOCUS_RGB = "rgb(242, 194, 48)";
// Long enough for one frame, far shorter than any animation token.
const INSTANT_MS = 100;

test.use({ viewport: DESKTOP });

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("shows the headline route finished, with no drawing", async ({ page }) => {
    await page.goto("/");

    const heroRoute = page.locator("h1 svg");
    await expect(heroRoute).toHaveCSS("opacity", "1");
  });

  test("jumps the repair route to its final state without drawing it", async ({ page }) => {
    await page.goto("/");
    const scenarios = page.getByRole("group", { name: "Choose a scenario" });

    await scenarios.getByText("Fix both corners").click();

    await expect(page.getByRole("img", { name: /whole trip is open/i })).toBeVisible();
    // Three route segments, each fully drawn at once rather than over the 300ms token.
    const routes = page.locator("figure svg path[stroke-width='6']");
    await expect(routes).toHaveCount(3);
    for (const route of await routes.all()) {
      await expect(route).toHaveCSS("opacity", "1", { timeout: INSTANT_MS });
    }
  });
});

test("sidebar focus ring uses the high-contrast sidebar indicator", async ({ page }) => {
  await page.goto("/");
  const firstNavLink = page.getByRole("navigation", { name: "Main" }).getByRole("link").first();

  await firstNavLink.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");

  await expect(firstNavLink).toBeFocused();
  await expect(firstNavLink).toHaveCSS("outline-color", SIDEBAR_FOCUS_RGB);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("every landing section is present and visible", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const sectionHeadings = page.getByRole("main").getByRole("heading", { level: 2 });
    await expect(sectionHeadings).not.toHaveCount(0);
    for (const heading of await sectionHeadings.all()) {
      await expect(heading).toBeVisible();
      // Playwright treats opacity:0 as visible, and the fade lives on a wrapper, so multiply up.
      // Polled: CSS entrances still play without JavaScript, so wait for the settled value.
      await expect
        .poll(() =>
          heading.evaluate((element) => {
            let opacity = 1;
            for (let node: Element | null = element; node; node = node.parentElement) {
              opacity *= Number(getComputedStyle(node).opacity);
            }
            return opacity;
          }),
        )
        .toBe(1);
    }
    await expect(page.getByText(/illustration, not a map or a real result/i)).toBeVisible();
    await expect(page.getByText(/does not provide routes/i)).toBeVisible();
  });
});
