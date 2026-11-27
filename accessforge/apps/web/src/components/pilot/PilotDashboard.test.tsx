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
  expect(
    screen.getByText(/Not affiliated with or endorsed by the City of Fremont/),
  ).toBeInTheDocument();
  expect(screen.getByText(/no modeled accessibility estimate for Fremont yet/)).toBeInTheDocument();
  expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/reports/summary");

  const csv = decodeURIComponent(
    screen.getByRole("link", { name: "Download pilot summary (CSV)" }).getAttribute("href") ?? "",
  );
  expect(csv).toContain("status,confirmed,1");
  expect(csv).toContain("barrier_type,missing_curb_ramp,0");
  expect(csv).toContain("Not an official inspection");
  expect(csv).toMatch(/^generated_at,\d{4}-\d{2}-\d{2}T/m);
  expect(screen.getByRole("link", { name: "pilot@example.org" })).toHaveAttribute(
    "href",
    "mailto:pilot@example.org?subject=AccessForge%20pilot%20feedback",
  );
  expect(await axeViolations(container)).toEqual([]);
});

it("counts repairs underway and resolved repairs separately", async () => {
  const repairs = {
    ...summary,
    total: 6,
    by_state: { confirmed: 1, repair_planned: 2, repair_completed: 1, resolved: 2 },
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(repairs)));
  render(<PilotDashboard feedbackEmail={null} />);

  const underway = (await screen.findByText("Repair underway")).closest("div");
  const resolved = screen.getByText("Repair rechecked on site by a reviewer.").closest("div");

  expect(underway).toHaveTextContent("Repair underway3");
  expect(resolved).toHaveTextContent("Resolved2");
  expect(
    screen.getByText(/Repair statuses are recorded by AccessForge reviewers/),
  ).toBeInTheDocument();
  expect(
    screen.getByText("A repair status does not mean the repair happened because of this site."),
  ).toBeInTheDocument();
});

it("invites the first report when empty and offers the form without an email", async () => {
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
  expect(screen.getByRole("form", { name: "Pilot feedback" })).toBeInTheDocument();
  expect(screen.queryByText(/Prefer email/)).not.toBeInTheDocument();
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

it("validates, sends anonymous feedback, and reports rate limits", async () => {
  const fetchMock = vi.fn().mockResolvedValue(reply(summary));
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<PilotDashboard feedbackEmail={null} />);
  await screen.findByRole("table", { name: "By barrier type" });

  await user.click(screen.getByRole("button", { name: "Send feedback" }));
  expect(screen.getByText("Choose what your feedback is about.")).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "What is it about?" })).toHaveFocus();
  expect(fetchMock).toHaveBeenCalledTimes(1);

  fetchMock.mockResolvedValueOnce(new Response("", { status: 201 }));
  await user.selectOptions(
    screen.getByRole("combobox", { name: "What is it about?" }),
    "accessibility",
  );
  await user.type(screen.getByRole("textbox", { name: "Your feedback" }), "  Legend too small  ");
  await user.click(screen.getByRole("button", { name: "Send feedback" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Your feedback was received");
  const [url, init] = fetchMock.mock.calls[1];
  expect(url).toBe("/api/feedback");
  expect(JSON.parse(init.body)).toEqual({
    topic: "accessibility",
    message: "Legend too small",
    website: "",
  });

  fetchMock.mockResolvedValueOnce(new Response("", { status: 429 }));
  await user.selectOptions(screen.getByRole("combobox", { name: "What is it about?" }), "other");
  await user.type(screen.getByRole("textbox", { name: "Your feedback" }), "Again");
  await user.click(screen.getByRole("button", { name: "Send feedback" }));
  expect(await screen.findByText(/Too many messages/)).toBeInTheDocument();
});
