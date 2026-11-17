import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { PilotDashboard } from "./PilotDashboard";

const summary = {
  total: 3,
  by_state: { confirmed: 1, unverified: 2 },
  by_type: { obstruction: 2, steep_slope: 1 },
  first_report_at: "2026-11-10T09:00:00Z",
  last_report_at: "2026-11-16T12:00:00Z",
};
function reply(data: unknown) {
  return new Response(JSON.stringify({ data, error: null, meta: {} }));
}
afterEach(() => vi.unstubAllGlobals());

it("shows verified and pending counts, provenance, and an honest pilot label", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(summary)));
  const { container } = render(<PilotDashboard feedbackEmail="pilot@example.org" />);
  expect(screen.getByText("Loading report counts…")).toBeInTheDocument();

  const byStatus = await screen.findByRole("table", { name: "By verification status" });
  expect(within(byStatus).getByRole("row", { name: "Verified 1" })).toBeInTheDocument();
  expect(within(byStatus).getByRole("row", { name: "Pending 2" })).toBeInTheDocument();
  expect(within(byStatus).getByRole("row", { name: "Rejected 0" })).toBeInTheDocument();
  const byType = screen.getByRole("table", { name: "By barrier type" });
  expect(within(byType).getByRole("row", { name: "Obstruction 2" })).toBeInTheDocument();
  expect(screen.getByText("2026-11-10")).toBeInTheDocument();
  expect(screen.getByText("2026-11-16")).toBeInTheDocument();
  expect(screen.getByText(/has not reviewed, endorsed, or adopted it/)).toBeInTheDocument();
  expect(screen.getByText(/no modeled accessibility estimate for Fremont yet/)).toBeInTheDocument();
  expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/reports/summary");

  const csv = decodeURIComponent(
    screen.getByRole("link", { name: "Download pilot summary (CSV)" }).getAttribute("href") ?? "",
  );
  expect(csv).toContain("status,confirmed,1");
  expect(csv).toContain("barrier_type,missing_curb_ramp,0");
  expect(csv).toContain("Not an official inspection");
  expect(screen.getByRole("link", { name: "pilot@example.org" })).toHaveAttribute(
    "href",
    "mailto:pilot@example.org?subject=AccessForge%20pilot%20feedback",
  );
  expect(await axeViolations(container)).toEqual([]);
});

it("invites the first report when empty and says when feedback is not set up", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        reply({ total: 0, by_state: {}, by_type: {}, first_report_at: null, last_report_at: null }),
      ),
  );
  render(<PilotDashboard feedbackEmail={null} />);
  expect(await screen.findByRole("link", { name: "Report the first barrier" })).toHaveAttribute(
    "href",
    "/report",
  );
  expect(screen.getAllByText("No reports yet")).toHaveLength(2);
  expect(screen.getByText(/feedback contact has not been set up/)).toBeInTheDocument();
});

it("announces a failed load and retries", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response("", { status: 503 }));
  vi.stubGlobal("fetch", fetchMock);
  render(<PilotDashboard feedbackEmail={null} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("could not complete");
  expect(screen.getAllByText("Unavailable")).toHaveLength(2);
  fetchMock.mockResolvedValueOnce(reply(summary));
  await userEvent.setup().click(screen.getByRole("button", { name: "Retry summary" }));
  expect(await screen.findByRole("table", { name: "By barrier type" })).toBeInTheDocument();
});
