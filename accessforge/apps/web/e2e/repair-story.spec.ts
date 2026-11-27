import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 375, height: 800 };
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

function step(page: Page, label: string) {
  return page.getByRole("heading", { name: label, level: 3 }).locator("xpath=ancestor::li[1]");
}

async function readStep(page: Page, label: string) {
  // Bring the step to the middle of the viewport, where it takes over the figure.
  await step(page, label).evaluate((element) =>
    element.scrollIntoView({ block: "center", behavior: "instant" }),
  );
}

test.describe("desktop with motion", () => {
  test.use({ viewport: DESKTOP });

  test("scrolling through the steps drives the scenario and pins the figure", async ({ page }) => {
    await page.goto("/");
    const figure = page.getByRole("img", { name: /trip/i });

    await readStep(page, "Fix one corner");
    await expect(page.getByRole("radio", { name: "Fix one corner" })).toBeChecked();
    await expect(figure).toHaveAccessibleName(/still blocked at the second corner/i);
    await expect(step(page, "Fix one corner")).toHaveAttribute("aria-current", "step");
    await expect(figure).toBeInViewport();

    await readStep(page, "Fix both corners");
    await expect(page.getByRole("radio", { name: "Fix both corners" })).toBeChecked();
    await expect(figure).toHaveAccessibleName(/whole trip is open/i);
    await expect(figure).toBeInViewport();
    await expect(page.locator("figure svg circle.fill-marker")).toHaveCount(1);
    await expect(page.locator("figure [aria-live='polite']")).toHaveText(/whole trip is open/i);
  });

  test("keyboard focus passes straight through the pinned area", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("radio", { name: "Today" }).focus();

    await page.keyboard.press("Tab");

    // Nothing in the steps or the figure is focusable, so Tab leaves the story section.
    const focusedInsideStory = await page.evaluate(() =>
      Boolean(document.activeElement?.closest('[aria-labelledby="story-heading"]')),
    );
    expect(focusedInsideStory).toBe(false);
    // The next stop is the first step card's link in the following section.
    await expect(page.locator(":focus")).toHaveAttribute("href", "/report");
  });

  test("has no axe violations with the whole trip open", async ({ page }) => {
    await page.goto("/");
    await readStep(page, "Fix both corners");
    await page.waitForFunction(() =>
      document.getAnimations().every((animation) => animation.playState !== "running"),
    );

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});

test.describe("reduced motion", () => {
  test.use({ viewport: DESKTOP, reducedMotion: "reduce" });

  test("scrolling does not change the scenario; the buttons do", async ({ page }) => {
    await page.goto("/");

    await readStep(page, "Fix both corners");
    await expect(page.getByRole("radio", { name: "Today" })).toBeChecked();

    await page
      .getByRole("group", { name: "Choose a scenario" })
      .getByText("Fix both corners")
      .click();
    await expect(page.getByRole("radio", { name: "Fix both corners" })).toBeChecked();
    // The marker rests at the clinic at once instead of travelling.
    await expect(page.locator("figure svg circle.fill-marker")).toHaveCount(1);
  });
});

test.describe("phone", () => {
  test.use({ viewport: PHONE });

  test("scrolling does not change the scenario without a pinned figure", async ({ page }) => {
    await page.goto("/");

    await readStep(page, "Fix both corners");

    await expect(page.getByRole("radio", { name: "Today" })).toBeChecked();
  });
});
