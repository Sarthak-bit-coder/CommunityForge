import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import VerificationPage from "@/app/verify/page";
import { axeViolations } from "@/test/axe";
import { fakeMapControl, resetFakeMaplibre } from "@/test/fake-maplibre";

vi.mock("maplibre-gl", () => import("@/test/fake-maplibre"));
const report = {
  id: "9b647da6-eae7-47f5-9e14-e5331217cffa",
  type: "obstruction",
  description: "Submitted walkway obstruction",
  severity: 3,
  state: "unverified",
  location: { longitude: -121.9886, latitude: 37.5485 },
  created_at: "2026-11-16T12:00:00Z",
  evidence: [
    {
      source: "community_report",
      source_ref: "submission-reference",
      source_version: null,
      observed_at: "2026-11-16T12:00:00Z",
      recorded_at: "2026-11-16T12:00:01Z",
    },
  ],
};
function response(data: unknown, total = 1) {
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

it("defaults to pending and shows report facts, provenance, and read-only access for visitors", async () => {
  const { container } = render(<VerificationPage />);
  expect(screen.getByText("Loading reports…")).toBeInTheDocument();
  const card = (await screen.findByText(report.description)).closest("li")!;
  expect(fetch).toHaveBeenCalledWith(
    "/api/reports?page=1&limit=20&state=unverified",
    expect.anything(),
  );
  expect(card).toHaveTextContent("37.5485, -121.9886");
  expect(card).toHaveTextContent("Obstruction");
  expect(card).toHaveTextContent(report.created_at);
  expect(card).toHaveTextContent("submission-reference");
  expect(card).toHaveTextContent("Not supplied");
  expect(card).toHaveTextContent("not a verified site visit");
  expect(
    screen.getByRole("complementary", { name: "Read-only verification dashboard" }),
  ).toHaveTextContent("Only signed-in reviewers can verify or reject them");
  expect(screen.queryByRole("button", { name: /approve|reject/i })).not.toBeInTheDocument();
  await waitFor(() => expect(fakeMapControl.instances).toHaveLength(1));
  act(() => fakeMapControl.instances[0].emit("load"));
  expect(await axeViolations(container)).toEqual([]);
});

it("opens independently fetched details with the keyboard and never sends review writes", async () => {
  render(<VerificationPage />);
  const button = await screen.findByRole("button", {
    name: `View details for Report ${report.id}`,
  });
  button.focus();
  await userEvent.setup().keyboard("{Enter}");
  const detail = await screen.findByRole("region", { name: `Report ${report.id}` });
  expect(within(detail).getByText("submission-reference")).toBeInTheDocument();
  expect(within(detail).getByText(report.description)).toBeInTheDocument();
  expect(button).toHaveFocus();
  expect(fetch).toHaveBeenCalledWith(`/api/reports/${report.id}`, expect.anything());
  expect(
    vi
      .mocked(fetch)
      .mock.calls.every(([, options]) => !options?.method || options.method === "GET"),
  ).toBe(true);
});

it("filters by status using the API, including verified/confirmed and rejected", async () => {
  const user = userEvent.setup();
  render(<VerificationPage />);
  await screen.findByText(report.description);
  vi.mocked(fetch).mockResolvedValueOnce(response([{ ...report, state: "confirmed" }]));
  await user.selectOptions(screen.getByLabelText("Verification status"), "confirmed");
  expect(await screen.findByText("Page 1. 1 reports match.")).toBeInTheDocument();
  expect(fetch).toHaveBeenLastCalledWith(
    "/api/reports?page=1&limit=20&state=confirmed",
    expect.anything(),
  );
  vi.mocked(fetch).mockResolvedValueOnce(response([{ ...report, state: "rejected" }]));
  await user.selectOptions(screen.getByLabelText("Verification status"), "rejected");
  await screen.findByText("Page 1. 1 reports match.");
  expect(fetch).toHaveBeenLastCalledWith(
    "/api/reports?page=1&limit=20&state=rejected",
    expect.anything(),
  );
});

it("announces list failures, supports retry, and renders empty success results", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
  const { container } = render(<VerificationPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("could not complete");
  vi.mocked(fetch).mockResolvedValueOnce(response([], 0));
  await userEvent.setup().click(screen.getByRole("button", { name: "Retry reports" }));
  expect(await screen.findByText("Page 1. 0 reports match.")).toBeInTheDocument();
  expect(screen.getByText("No barriers match these filters.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  expect(await axeViolations(container)).toEqual([]);
});

it("handles missing details without inventing a review success", async () => {
  render(<VerificationPage />);
  const button = await screen.findByRole("button", {
    name: `View details for Report ${report.id}`,
  });
  vi.mocked(fetch).mockResolvedValueOnce(new Response("missing", { status: 404 }));
  await userEvent.setup().click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent("Report not found");
  expect(screen.queryByRole("button", { name: /approve|reject/i })).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole("button", { name: "Retry report details" }));
  const detail = await screen.findByRole("region", { name: `Report ${report.id}` });
  expect(within(detail).getByText(report.description)).toBeInTheDocument();
});
