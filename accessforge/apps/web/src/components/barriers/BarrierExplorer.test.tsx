import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BarriersPage from "@/app/barriers/page";
import { AppShell } from "@/components/layout/AppShell";
import { SAMPLE_BARRIERS } from "@/lib/sample-barriers";
import { axeViolations } from "@/test/axe";
import { fakeMapControl, resetFakeMaplibre } from "@/test/fake-maplibre";

vi.mock("maplibre-gl", () => import("@/test/fake-maplibre"));
vi.mock("next/navigation", () => ({
  usePathname: () => "/barriers",
  useRouter: () => ({ push: vi.fn() }),
}));

async function renderLoadedPage() {
  const view = render(
    <AppShell>
      <BarriersPage />
    </AppShell>,
  );
  await userEvent.setup().selectOptions(screen.getByLabelText("Data source"), "demo");
  await waitFor(() => expect(fakeMapControl.instances.length).toBeGreaterThanOrEqual(1));
  act(() => fakeMapControl.instances.at(-1)!.emit("load"));
  return view;
}

function listSection() {
  return screen.getByRole("region", { name: "List of barriers" });
}

function detailsSection() {
  return screen.getByRole("region", { name: /Barrier details|Sample barrier/ });
}

beforeEach(() => {
  resetFakeMaplibre();
});

describe("Barriers page", () => {
  it("has one h1, a fictional-data notice, and no detectable axe violations", async () => {
    const { container } = await renderLoadedPage();

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("complementary", { name: "Sample data notice" })).toHaveTextContent(
      /fictional sample data/,
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it("lists every sample barrier with its status and source in text", async () => {
    await renderLoadedPage();

    const items = within(listSection()).getAllByRole("listitem");
    expect(items).toHaveLength(SAMPLE_BARRIERS.length);
    expect(items[0]).toHaveTextContent("Verified");
    expect(items[0]).toHaveTextContent("Field verification");
    expect(screen.getByRole("status")).toHaveTextContent("Showing 10 of 10 sample barriers.");
  });

  it("filters the list and the map together by type and verification status", async () => {
    const user = userEvent.setup();
    await renderLoadedPage();

    await user.selectOptions(screen.getByLabelText("Barrier type"), "Missing curb ramp");
    await user.selectOptions(screen.getByLabelText("Verification status"), "Pending");

    expect(screen.getByRole("status")).toHaveTextContent("Showing 1 of 10 sample barriers.");
    expect(within(listSection()).getAllByRole("listitem")).toHaveLength(1);
    expect(
      screen.getAllByRole("button", { name: /^Sample barrier \d+\. Missing curb ramp\./ }),
    ).toHaveLength(1);
  });

  it("explains when no barriers match the filters", async () => {
    const user = userEvent.setup();
    await renderLoadedPage();

    await user.selectOptions(screen.getByLabelText("Barrier type"), "Steep slope");
    await user.selectOptions(screen.getByLabelText("Verification status"), "Resolved");

    expect(screen.getByText("No barriers match these filters.")).toBeInTheDocument();
  });

  it("shows details when a barrier is chosen from the list", async () => {
    const user = userEvent.setup();
    await renderLoadedPage();
    expect(detailsSection()).toHaveTextContent("Select a barrier on the map or in the list");

    await user.click(screen.getByRole("button", { name: "View details for Sample barrier 4" }));

    const details = detailsSection();
    expect(within(details).getByRole("heading", { name: "Sample barrier 4" })).toBeInTheDocument();
    expect(details).toHaveTextContent("Missing sidewalk");
    expect(details).toHaveTextContent("Repair planned");
    expect(details).toHaveTextContent("City record");
    expect(details).toHaveTextContent("Fictional sample");
  });

  it("shows details when a barrier is chosen on the map, and syncs the list", async () => {
    const user = userEvent.setup();
    await renderLoadedPage();

    await user.click(screen.getByRole("button", { name: /^Sample barrier 2\./ }));

    expect(
      within(detailsSection()).getByRole("heading", { name: "Sample barrier 2" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View details for Sample barrier 2" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("clears the details when the selected barrier is filtered out", async () => {
    const user = userEvent.setup();
    await renderLoadedPage();
    await user.click(screen.getByRole("button", { name: "View details for Sample barrier 1" }));

    await user.selectOptions(screen.getByLabelText("Verification status"), "Pending");

    expect(detailsSection()).toHaveTextContent("Select a barrier on the map or in the list");
  });

  it("lets small-screen users fold the filters away and back", async () => {
    const user = userEvent.setup();
    await renderLoadedPage();
    const toggle = screen.getByRole("button", { name: "Filters" });
    const filters = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(filters).toHaveClass("hidden");
    await user.click(toggle);
    expect(filters).not.toHaveClass("hidden");
  });
});
