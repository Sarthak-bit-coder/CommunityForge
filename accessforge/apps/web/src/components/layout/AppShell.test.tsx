import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OverviewPage from "@/app/page";
import AccessibilityPage from "@/app/accessibility/page";
import PilotPage from "@/app/pilot/page";
import PlannerPage from "@/app/planner/page";
import ReportPage from "@/app/report/page";
import VerifyPage from "@/app/verify/page";
import { axeViolations } from "@/test/axe";
import { AppShell } from "./AppShell";

const pathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("maplibre-gl", () => import("@/test/fake-maplibre"));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

beforeEach(() => {
  pathname.current = "/";
});

describe("AppShell", () => {
  it("provides a skip link to the main landmark", () => {
    render(<AppShell>content</AppShell>);

    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    expect(skipLink).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("marks only the current page in the main navigation", () => {
    pathname.current = "/barriers";
    render(<AppShell>content</AppShell>);

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Barriers" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });

  it("toggles the mobile menu and closes it with Escape", async () => {
    const user = userEvent.setup();
    render(<AppShell>content</AppShell>);
    const menuButton = screen.getByRole("button", { name: "Menu" });

    await user.click(menuButton);
    expect(menuButton).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the required disclaimers on every page", () => {
    render(<AppShell>content</AppShell>);

    expect(screen.getByText(/not an official inspection/)).toBeInTheDocument();
    expect(screen.getByText(/cannot tell you whether a path is safe/)).toBeInTheDocument();
  });
});

describe.each([
  ["overview", "/", OverviewPage],
  ["demo reporting", "/report", ReportPage],
  ["verification queue", "/verify", VerifyPage],
  ["repair planner", "/planner", PlannerPage],
  ["pilot dashboard", "/pilot", PilotPage],
  ["accessibility statement", "/accessibility", AccessibilityPage],
])("%s page", (_name, path, Page) => {
  it("has one h1 and no detectable axe violations", async () => {
    pathname.current = path;
    const { container } = render(
      <AppShell>
        <Page />
      </AppShell>,
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(await axeViolations(container)).toEqual([]);
  });
});
