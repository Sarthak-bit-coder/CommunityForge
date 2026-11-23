import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ReportTracking } from "./ReportTracking";

const id = "9b647da6-eae7-47f5-9e14-e5331217cffa";
afterEach(() => vi.unstubAllGlobals());

it("looks up only the bookmarked report and refreshes its status", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ data: { id, state: "unverified" } }))
    .mockResolvedValueOnce(Response.json({ data: { id, state: "resolved" } }));
  vi.stubGlobal("fetch", fetch);
  render(<ReportTracking id={id} />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading report status");
  expect(await screen.findByRole("heading", { name: "Pending" })).toBeVisible();
  await userEvent.setup().click(screen.getByRole("button", { name: "Refresh status" }));
  expect(await screen.findByRole("heading", { name: "Resolved" })).toBeVisible();
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    `/api/reports/${id}`,
    `/api/reports/${id}`,
  ]);
});

it.each([undefined, "unrecognized"])("shows unavailable for API state %s", async (state) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: { id, state } })));
  render(<ReportTracking id={id} />);
  expect(await screen.findByRole("heading", { name: "Status unavailable" })).toBeVisible();
});

it("reports a missing record and never displays another report's verification", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json({ data: { id: "another-report", state: "confirmed" } })),
  );
  render(<ReportTracking id={id} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Report not found.");
  await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not confirm");
  expect(screen.queryByRole("heading", { name: "Verified" })).toBeNull();
});
