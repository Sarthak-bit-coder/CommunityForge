import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { fakeMapControl, resetFakeMaplibre } from "@/test/fake-maplibre";
import { ReviewDashboard } from "./ReviewDashboard";

vi.mock("maplibre-gl", () => import("@/test/fake-maplibre"));

const REVIEWER = "3f0c7a1e-5c1d-4a57-9b1a-0d7f6d0f8a11";
const report = {
  id: "9b647da6-eae7-47f5-9e14-e5331217cffa",
  type: "obstruction",
  description: "Submitted walkway obstruction",
  severity: 3,
  state: "unverified",
  location: { longitude: -121.9886, latitude: 37.5485 },
  created_at: "2026-11-16T12:00:00Z",
  evidence: [],
};
const review = {
  id: "5d3c0a44-0d6e-4f0b-8f2e-6f6f3c9d2b10",
  report_id: report.id,
  reviewer_id: REVIEWER,
  to_state: "confirmed",
  reason: "Checked on site",
  reviewed_at: "2026-11-16T13:00:00Z",
};
type Call = { url: string; method: string; body: unknown };
let signedIn: boolean;
let reviews: unknown[];
let reviewStatus: number;
let calls: Call[];
let reportState: string;

function reply(data: unknown, status = 200) {
  return new Response(
    status === 204
      ? null
      : JSON.stringify({ data, error: null, meta: { page: 1, limit: 20, total: 1 } }),
    { status },
  );
}

beforeEach(() => {
  resetFakeMaplibre();
  signedIn = false;
  reviews = [];
  reviewStatus = 201;
  calls = [];
  reportState = "unverified";
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
      const method = init.method ?? "GET";
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });
      if (url === "/api/reviewer/session") {
        if (method === "POST") {
          if (body.key !== "right-key") return Promise.resolve(reply(null, 401));
          signedIn = true;
        }
        if (method === "DELETE") {
          signedIn = false;
          return Promise.resolve(reply(null, 204));
        }
        return Promise.resolve(signedIn ? reply({ reviewer_id: REVIEWER }) : reply(null, 401));
      }
      if (url.endsWith("/reviews"))
        return Promise.resolve(
          method === "POST"
            ? reply(review, reviewStatus)
            : reply(signedIn ? reviews : null, signedIn ? 200 : 401),
        );
      const current = { ...report, state: reportState };
      return Promise.resolve(reply(url.includes("?") ? [current] : current));
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

async function signInAndOpenReport(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("Reviewer access key"), "right-key");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  await screen.findByRole("heading", { name: "Signed in as a reviewer" });
  // The queue opens on pending reports; reviewers switch the filter to reach repair steps.
  if (reportState !== "unverified")
    await user.selectOptions(screen.getByLabelText("Verification status"), reportState);
  await user.click(
    await screen.findByRole("button", { name: `View details for Report ${report.id}` }),
  );
  return screen.findByRole("region", { name: `Report ${report.id}` });
}

it("hides decisions from visitors and refuses a wrong key", async () => {
  const user = userEvent.setup();
  const { container } = render(<ReviewDashboard />);
  await user.click(
    await screen.findByRole("button", { name: `View details for Report ${report.id}` }),
  );
  await screen.findByRole("region", { name: `Report ${report.id}` });
  expect(screen.queryByRole("button", { name: /verify report|reject report/i })).toBeNull();
  expect(calls.some((call) => call.url.endsWith("/reviews"))).toBe(false);

  const key = screen.getByLabelText("Reviewer access key");
  expect(key).toHaveAttribute("type", "password");
  await user.type(key, "wrong-key");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("That access key was not accepted.");
  expect(screen.getByRole("heading", { name: "Read-only verification dashboard" })).toBeVisible();
  await waitFor(() => expect(fakeMapControl.instances).toHaveLength(1));
  act(() => fakeMapControl.instances[0].emit("load"));
  expect(await axeViolations(container)).toEqual([]);
});

it("lets a signed-in reviewer verify a pending report with a required reason", async () => {
  const user = userEvent.setup();
  const { container } = render(<ReviewDashboard />);
  const detail = await signInAndOpenReport(user);
  expect(await within(detail).findByText(/No review has been recorded/)).toBeInTheDocument();

  await user.click(within(detail).getByRole("button", { name: "✓ Verify report" }));
  const reason = within(detail).getByLabelText("Reason for your decision");
  expect(reason).toHaveAccessibleDescription(/Give a reason/);
  // Focus returns to the field so a screen reader announces the error with it.
  await waitFor(() => expect(reason).toHaveFocus());
  expect(calls.some((call) => call.method === "POST" && call.url.endsWith("/reviews"))).toBe(false);
  expect(await axeViolations(container)).toEqual([]);

  await user.type(reason, "  Checked on site  ");
  await user.click(within(detail).getByRole("button", { name: "✓ Verify report" }));
  expect(await screen.findByText(`Report ${report.id} was marked verified.`)).toBeInTheDocument();
  expect(calls.find((call) => call.method === "POST" && call.url.endsWith("/reviews"))).toEqual({
    url: `/api/reports/${report.id}/reviews`,
    method: "POST",
    body: { status: "verified", reason: "Checked on site" },
  });
});

it("rejects a report, shows audit history, and explains an already-reviewed conflict", async () => {
  const user = userEvent.setup();
  reviews = [review];
  reviewStatus = 409;
  render(<ReviewDashboard />);
  const detail = await signInAndOpenReport(user);
  expect(await within(detail).findByText(/Reason: Checked on site/)).toBeInTheDocument();
  expect(within(detail).getByText(new RegExp(`by reviewer ${REVIEWER}`))).toBeInTheDocument();

  await user.type(within(detail).getByLabelText("Reason for your decision"), "Duplicate");
  await user.click(within(detail).getByRole("button", { name: "✕ Reject report" }));
  expect(await within(detail).findByRole("alert")).toHaveTextContent("status already changed");
  expect(calls.at(-1)?.body).toEqual({ status: "rejected", reason: "Duplicate" });
  expect(within(detail).getByRole("button", { name: "✕ Reject report" })).toBeEnabled();
});

it.each([
  ["confirmed", "Mark repair planned", "repair_planned", "marked repair planned"],
  ["repair_planned", "Mark repair completed", "repair_completed", "marked repair completed"],
  ["repair_completed", "Mark resolved after site visit", "resolved", "marked resolved"],
])("offers only the next repair step for a %s report", async (state, action, decision, message) => {
  const user = userEvent.setup();
  reportState = state;
  const { container } = render(<ReviewDashboard />);
  const detail = await signInAndOpenReport(user);
  expect(within(detail).queryByRole("button", { name: /verify report|reject report/i })).toBeNull();
  expect(await axeViolations(container)).toEqual([]);

  await user.type(within(detail).getByLabelText("Note for this repair update"), "Crew booked");
  await user.click(within(detail).getByRole("button", { name: action }));

  expect(await screen.findByText(`Report ${report.id} was ${message}.`)).toBeInTheDocument();
  const posted = calls.filter((call) => call.method === "POST" && call.url.endsWith("/reviews"));
  expect(posted.at(-1)?.body).toEqual({ status: decision, reason: "Crew booked" });
});

it("shows no further steps for a resolved report", async () => {
  const user = userEvent.setup();
  reportState = "resolved";
  render(<ReviewDashboard />);
  const detail = await signInAndOpenReport(user);
  expect(await within(detail).findByText(/No further steps remain/)).toBeInTheDocument();
  expect(within(detail).queryByRole("textbox")).toBeNull();
});

it("restores an existing session and signs out back to read-only", async () => {
  signedIn = true;
  const user = userEvent.setup();
  render(<ReviewDashboard />);
  expect(await screen.findByText(new RegExp(`Reviewer ID ${REVIEWER}`))).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Sign out" }));
  expect(await screen.findByText("Signed out.")).toBeInTheDocument();
  expect(screen.getByLabelText("Reviewer access key")).toHaveValue("");
});

it("prints selected visits without report text, removes entries and clears them on sign-out", async () => {
  const user = userEvent.setup();
  const print = vi.fn();
  vi.stubGlobal("print", print);
  render(<ReviewDashboard />);
  expect(screen.queryByRole("region", { name: "Field visit checklist" })).toBeNull();
  const detail = await signInAndOpenReport(user);
  const add = within(detail).getByRole("button", { name: "Add to field checklist" });
  await user.click(add);
  const checklist = screen.getByRole("region", { name: "Field visit checklist" });
  expect(checklist).toHaveTextContent("Obstruction");
  expect(checklist).toHaveTextContent("37.5485, -121.9886");
  expect(checklist).not.toHaveTextContent(report.description);
  expect(checklist).not.toHaveTextContent(REVIEWER);
  await user.click(within(checklist).getByRole("button", { name: "Print field checklist" }));
  expect(print).toHaveBeenCalledOnce();
  await user.click(within(checklist).getByRole("button", { name: /Remove report/ }));
  expect(within(checklist).queryByRole("listitem")).toBeNull();
  await user.click(add);
  await user.click(screen.getByRole("button", { name: "Sign out" }));
  expect(screen.queryByRole("region", { name: "Field visit checklist" })).toBeNull();
});
