import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const report = {
  id: "9b647da6-eae7-47f5-9e14-e5331217cffa",
  type: "obstruction",
  description: "Submitted walkway obstruction",
  severity: 3,
  state: "unverified",
  location: { longitude: -121.9886, latitude: 37.5485 },
  created_at: "2026-11-16T12:00:00Z",
};

test("live reports filter, paginate, load details, and stay accessible on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const requests: string[] = [];
  await page.route("**/api/reports**", (route) => {
    const url = new URL(route.request().url());
    requests.push(url.pathname + url.search);
    return route.fulfill({
      json: {
        data: url.pathname.endsWith(report.id) ? report : [report],
        error: null,
        meta: { page: Number(url.searchParams.get("page") ?? 1), limit: 20, total: 21 },
      },
    });
  });
  await page.goto("/barriers");
  await page.getByRole("button", { name: `View details for Report ${report.id}` }).click();
  await expect(
    page.getByRole("region", { name: `Report ${report.id}` }).getByText(report.description),
  ).toBeVisible();
  expect(requests).toContain(`/api/reports/${report.id}`);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Page 2. 21 reports match.")).toBeVisible();
  await page.getByLabel("Verification status").selectOption("unverified");
  await expect(page.getByText("Page 1. 21 reports match.")).toBeVisible();
  expect(requests).toContain("/api/reports?page=1&limit=20&state=unverified");
  await page.getByRole("button", { name: `View details for Report ${report.id}` }).click();
  await expect(
    page.getByRole("region", { name: `Report ${report.id}` }).getByText(report.description),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
});

test("submission failure keeps fields and retries only on user action", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/reports", (route) => {
    calls++;
    expect(route.request().postDataJSON()).toEqual({
      type: "obstruction",
      description: "Blocked walkway",
      severity: 3,
      location: { latitude: 37.5485, longitude: -121.9886 },
    });
    return route.fulfill(
      calls === 1
        ? { status: 503, json: { error: { code: "database_unavailable" } } }
        : { status: 201, json: { data: report, error: null, meta: {} } },
    );
  });
  await page.goto("/report");
  await page.getByLabel("Barrier type").selectOption("obstruction");
  await page.getByLabel("Description", { exact: true }).fill("Blocked walkway");
  await page.getByLabel("Latitude", { exact: true }).fill("37.5485");
  await page.getByLabel("Longitude", { exact: true }).fill("-121.9886");
  await page.getByLabel("Severity (1–5)").selectOption("3");
  await page.getByRole("button", { name: "Submit report", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not complete");
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue("Blocked walkway");
  expect(calls).toBe(1);
  await page.getByRole("button", { name: "Submit report", exact: true }).click();
  await expect(page.getByRole("status", { name: "Report submitted" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Report submitted" })).toBeDisabled();
  expect(calls).toBe(2);
});

for (const width of [320, 1440]) {
  test(`verification dashboard is read-only and accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const sourceRef = "submission-reference-" + "a".repeat(200);
    await page.route("**/api/reports**", (route) => {
      expect(route.request().method()).toBe("GET");
      const url = new URL(route.request().url());
      if (url.search) expect(url.searchParams.get("state")).toBe("unverified");
      const record = {
        ...report,
        evidence: [
          {
            source: "community_report",
            source_ref: sourceRef,
            source_version: "fixture-version",
            observed_at: report.created_at,
            recorded_at: report.created_at,
          },
        ],
      };
      return route.fulfill({
        json: {
          data: url.search ? [record] : record,
          error: null,
          meta: { page: 1, limit: 20, total: 1 },
        },
      });
    });
    await page.goto("/verify");
    await expect(
      page.getByRole("complementary", { name: "Read-only verification dashboard" }),
    ).toContainText("reviewer authentication and protected review endpoints are not implemented");
    await expect(page.getByRole("button", { name: /approve|reject/i })).toHaveCount(0);
    await page.getByRole("button", { name: `View details for Report ${report.id}` }).click();
    const detail = page.getByRole("region", { name: `Report ${report.id}` });
    await expect(detail.getByText(sourceRef)).toBeVisible();
    await expect(detail.getByText("fixture-version")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
  });
}
