import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resetFakeMaplibre, fakeMapControl } from "@/test/fake-maplibre";
import { axeViolations } from "@/test/axe";
import { ReportsExplorer } from "./ReportsExplorer";

vi.mock("maplibre-gl", () => import("@/test/fake-maplibre"));
const report = {
  id: "9b647da6-eae7-47f5-9e14-e5331217cffa",
  type: "obstruction",
  description: "Submitted walkway obstruction",
  severity: 3,
  state: "unverified",
  location: { longitude: -121.9886, latitude: 37.5485 },
  created_at: "2026-11-16T12:00:00Z",
};
function response(data: unknown, total = 21) {
  return new Response(JSON.stringify({ data, error: null, meta: { page: 1, limit: 20, total } }));
}
beforeEach(() => {
  resetFakeMaplibre();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(response(url.includes("?") ? [report] : report)),
      ),
  );
});
afterEach(() => vi.unstubAllGlobals());

it("loads real reports into map/list, fetches details, filters and paginates", async () => {
  const user = userEvent.setup();
  const { container } = render(<ReportsExplorer />);
  expect(screen.getByText("Loading reports…")).toBeInTheDocument();
  const button = await screen.findByRole("button", {
    name: `View details for Report ${report.id}`,
  });
  await waitFor(() => expect(fakeMapControl.instances).toHaveLength(1));
  act(() => fakeMapControl.instances[0].emit("load"));
  expect(await screen.findByRole("button", { name: /^Report .*Obstruction/ })).toBeInTheDocument();
  expect(fakeMapControl.instances[0].fitBounds).toHaveBeenCalled();
  await user.click(button);
  expect(
    within(await screen.findByRole("region", { name: `Report ${report.id}` })).getByText(
      report.description,
    ),
  ).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith(
    `/api/reports/${report.id}`,
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
  expect(
    within(screen.getByRole("region", { name: `Report ${report.id}` })).queryByText(
      "Fictional sample",
    ),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Next page" }));
  await screen.findByText("Page 2. 21 reports match.");
  expect(fetch).toHaveBeenLastCalledWith("/api/reports?page=2&limit=20", expect.anything());
  await user.selectOptions(screen.getByLabelText("Verification status"), "unverified");
  await screen.findByText("Page 1. 21 reports match.");
  expect(fetch).toHaveBeenLastCalledWith(
    "/api/reports?page=1&limit=20&state=unverified",
    expect.anything(),
  );
  await user.selectOptions(screen.getByLabelText("Barrier type"), "obstruction");
  await waitFor(() =>
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/reports?page=1&limit=20&type=obstruction&state=unverified",
      expect.anything(),
    ),
  );
  expect(await axeViolations(container)).toEqual([]);
});

it("shows errors, retries, and never substitutes fictional data on failure", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
  render(<ReportsExplorer />);
  expect(await screen.findByRole("alert")).toHaveTextContent("could not complete");
  expect(screen.queryByText("Sample barrier 1")).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole("button", { name: "Retry reports" }));
  expect(await screen.findByText(`Report ${report.id}`)).toBeInTheDocument();
});

it("announces missing detail and supports a detail retry", async () => {
  render(<ReportsExplorer />);
  const button = await screen.findByRole("button", {
    name: `View details for Report ${report.id}`,
  });
  vi.mocked(fetch).mockResolvedValueOnce(new Response("missing", { status: 404 }));
  await userEvent.setup().click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent("Report not found");
  await userEvent.setup().click(screen.getByRole("button", { name: "Retry report details" }));
  expect(
    within(await screen.findByRole("region", { name: `Report ${report.id}` })).getByText(
      report.description,
    ),
  ).toBeInTheDocument();
});

it("shows empty results and explicitly switches to labeled fictional samples", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(response([], 0));
  render(<ReportsExplorer />);
  expect(await screen.findByText("Page 1. 0 reports match.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  await userEvent.setup().selectOptions(screen.getByLabelText("Data source"), "demo");
  expect(screen.getByRole("complementary", { name: "Sample data notice" })).toHaveTextContent(
    "Fictional",
  );
  expect(screen.getByText("Sample barrier 1")).toBeInTheDocument();
});

it("ignores stale responses after filters change", async () => {
  let resolve!: (response: Response) => void;
  vi.mocked(fetch).mockReturnValueOnce(
    new Promise<Response>((done) => {
      resolve = done;
    }),
  );
  render(<ReportsExplorer />);
  vi.mocked(fetch).mockResolvedValueOnce(response([], 0));
  await userEvent.setup().selectOptions(screen.getByLabelText("Barrier type"), "steep_slope");
  await screen.findByText("Page 1. 0 reports match.");
  await act(async () => resolve(response([report])));
  expect(screen.queryByText(`Report ${report.id}`)).not.toBeInTheDocument();
});

it("refreshes changed statuses across markers, cards and open details without reloading", async () => {
  const user = userEvent.setup();
  render(<ReportsExplorer />);
  await user.click(
    await screen.findByRole("button", { name: `View details for Report ${report.id}` }),
  );
  await screen.findByRole("region", { name: `Report ${report.id}` });
  await waitFor(() => expect(fakeMapControl.instances).toHaveLength(1));
  act(() => fakeMapControl.instances[0].emit("load"));
  vi.mocked(fetch).mockImplementation((url) =>
    Promise.resolve(
      response(
        String(url).includes("?")
          ? [{ ...report, state: "confirmed" }]
          : { ...report, state: "confirmed" },
      ),
    ),
  );
  await user.click(screen.getByRole("button", { name: "Refresh reports" }));
  const marker = await screen.findByRole("button", { name: /^Report .*Status: Verified/ });
  expect(marker).toHaveTextContent("V");
  const detail = await screen.findByRole("region", { name: `Report ${report.id}` });
  expect(within(detail).getByText("V Verified")).toBeInTheDocument();
  expect(within(detail).getByText(/A reviewer confirmed/)).toBeInTheDocument();
  expect(
    within(screen.getByRole("region", { name: "List of barriers" })).getByText("V Verified"),
  ).toBeInTheDocument();
});

it("refreshes on window focus and removes reports that no longer match the pending filter", async () => {
  const user = userEvent.setup();
  render(<ReportsExplorer />);
  await screen.findByRole("button", { name: `View details for Report ${report.id}` });
  await user.selectOptions(screen.getByLabelText("Verification status"), "unverified");
  await user.click(
    await screen.findByRole("button", { name: `View details for Report ${report.id}` }),
  );
  await screen.findByRole("region", { name: `Report ${report.id}` });
  vi.mocked(fetch).mockImplementation((url) =>
    Promise.resolve(
      response(String(url).includes("?") ? [] : { ...report, state: "confirmed" }, 0),
    ),
  );
  act(() => window.dispatchEvent(new Event("focus")));
  await screen.findByText("Page 1. 0 reports match.");
  expect(screen.queryByRole("region", { name: `Report ${report.id}` })).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: `View details for Report ${report.id}` }),
  ).not.toBeInTheDocument();
});

it("renders missing and unknown statuses safely and excludes them from verified results", async () => {
  const unknown = { ...report, state: "future_value" };
  const missing = { ...report, id: "missing-status", state: undefined };
  vi.mocked(fetch).mockResolvedValueOnce(response([unknown, missing], 2));
  render(<ReportsExplorer />);
  await screen.findByText("Page 1. 2 reports match.");
  const list = within(screen.getByRole("region", { name: "List of barriers" }));
  expect(list.getAllByText("– Unknown status")).toHaveLength(2);
  vi.mocked(fetch).mockResolvedValueOnce(response([], 0));
  await userEvent.setup().selectOptions(screen.getByLabelText("Verification status"), "confirmed");
  await screen.findByText("Page 1. 0 reports match.");
  expect(list.queryByText("V Verified")).not.toBeInTheDocument();
});
