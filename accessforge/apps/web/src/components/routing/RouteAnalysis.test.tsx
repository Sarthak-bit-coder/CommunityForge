import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import corridorPlan from "@/test/corridor-plan.json";
import corridorRoute from "@/test/corridor-route.json";
import { RouteAnalysis } from "./RouteAnalysis";

const fetchMock = vi.fn();

function respond(url: string): Response {
  if (url.startsWith("/api/planning/plans")) return Response.json({ data: corridorPlan });
  if (url.startsWith("/api/routing/analysis")) return Response.json({ data: corridorRoute });
  return new Response("{}", { status: 500 });
}

beforeEach(() => {
  fetchMock.mockImplementation((url: string) => Promise.resolve(respond(url)));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

it("loads the network's start and end choices and explains the corridor route", async () => {
  const user = userEvent.setup();
  const { container } = render(<RouteAnalysis defaultDataset="corridor" />);
  const start = await screen.findByRole("combobox", { name: "Start" });
  expect(within(start).getByRole("option", { name: "home (corridor)" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Check route" }));

  const summary = await screen.findByRole("heading", { name: /Route summary for Wheelchair user/ });
  const list = summary.nextElementSibling as HTMLElement;
  expect(within(list).getByText(/Current network: no modeled route/)).toBeInTheDocument();
  expect(
    within(list).getByText(/Simulation with recommended repairs: modeled route of 50 m/),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole("table", { name: /Current network compared/ })).getByRole("row", {
      name: /Simulation with recommended repairs \(r0, r1\)/,
    }),
  ).toBeInTheDocument();
  expect(screen.getByText(/Synthetic demonstration, not Fremont data/)).toBeInTheDocument();
  expect(await axeViolations(container)).toEqual([]);
});

it("rejects an unusable budget without calling the route service", async () => {
  const user = userEvent.setup();
  render(<RouteAnalysis defaultDataset="corridor" />);
  await screen.findByRole("combobox", { name: "Start" });
  const budget = screen.getByRole("textbox", { name: "Repair budget (cost units)" });
  await user.clear(budget);
  await user.type(budget, "-4");
  await user.click(screen.getByRole("button", { name: "Check route" }));

  expect(screen.getByText("Enter a budget between 0 and 1,000,000.")).toBeInTheDocument();
  expect(budget).toHaveAttribute("aria-invalid", "true");
  expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("/api/routing"))).toBe(false);
});

it("explains a not-found start or end instead of showing an empty result", async () => {
  const user = userEvent.setup();
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(
      url.startsWith("/api/routing") ? new Response("{}", { status: 404 }) : respond(url),
    ),
  );
  render(<RouteAnalysis defaultDataset="corridor" />);
  await screen.findByRole("combobox", { name: "Start" });
  await user.click(screen.getByRole("button", { name: "Check route" }));

  expect(
    await screen.findByText("That start, end or profile is not in this demonstration network."),
  ).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: /Route summary/ })).not.toBeInTheDocument();
});

const CHECK = "Check route";
const SUMMARY = /Route summary/;
type User = ReturnType<typeof userEvent.setup>;

async function checkRoute(user: User): Promise<void> {
  await user.click(screen.getByRole("button", { name: CHECK }));
  await screen.findByRole("heading", { name: SUMMARY });
}

function otherValue(select: HTMLElement): string {
  const { options, value } = select as HTMLSelectElement;
  return Array.from(options).find((option) => option.value !== value)?.value ?? value;
}

function routeCalls(): string[] {
  return fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.startsWith("/api/routing"));
}

function respondWith(
  routeResponse: (url: string, signal: AbortSignal | undefined) => Promise<Response>,
) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) =>
    url.startsWith("/api/routing")
      ? routeResponse(url, init?.signal ?? undefined)
      : Promise.resolve(respond(url)),
  );
}

function pendingUntilAborted(_url: string, signal: AbortSignal | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });
}

it("clears the shown route when the start changes", async () => {
  const user = userEvent.setup();
  render(<RouteAnalysis defaultDataset="corridor" />);
  const start = await screen.findByRole("combobox", { name: "Start" });
  await checkRoute(user);

  await user.selectOptions(start, otherValue(start));

  expect(screen.queryByRole("heading", { name: SUMMARY })).not.toBeInTheDocument();
});

it("clears the shown route when the budget changes", async () => {
  const user = userEvent.setup();
  render(<RouteAnalysis defaultDataset="corridor" />);
  await screen.findByRole("combobox", { name: "Start" });
  await checkRoute(user);
  const budget = screen.getByRole("textbox", { name: "Repair budget (cost units)" });

  await user.clear(budget);
  await user.type(budget, "5");

  expect(screen.queryByRole("heading", { name: SUMMARY })).not.toBeInTheDocument();
});

it("shows no earlier result when a retry fails", async () => {
  const user = userEvent.setup();
  render(<RouteAnalysis defaultDataset="corridor" />);
  await screen.findByRole("combobox", { name: "Start" });
  await checkRoute(user);
  respondWith(() => Promise.resolve(new Response("{}", { status: 500 })));

  await user.click(screen.getByRole("button", { name: CHECK }));

  expect(await screen.findByText(/could not complete this check/)).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: SUMMARY })).not.toBeInTheDocument();
});

it("re-enables the check when the network changes during a request", async () => {
  const user = userEvent.setup();
  respondWith(pendingUntilAborted);
  render(<RouteAnalysis defaultDataset="corridor" />);
  await screen.findByRole("combobox", { name: "Start" });
  await user.click(screen.getByRole("button", { name: CHECK }));
  expect(await screen.findByText("Checking the modeled route…")).toBeInTheDocument();

  const network = screen.getByRole("combobox", { name: "Network" });
  await user.selectOptions(network, otherValue(network));

  await waitFor(() => expect(screen.getByRole("button", { name: CHECK })).toBeEnabled());
  expect(screen.queryByText("Checking the modeled route…")).not.toBeInTheDocument();
});

it("sends the last seen snapshot and explains a stale one", async () => {
  const user = userEvent.setup();
  render(<RouteAnalysis defaultDataset="corridor" />);
  await screen.findByRole("combobox", { name: "Start" });
  await checkRoute(user);
  respondWith(() => Promise.resolve(new Response("{}", { status: 409 })));

  await user.click(screen.getByRole("button", { name: CHECK }));

  expect(
    await screen.findByText(
      "The network data changed since your last check. Check the route again.",
    ),
  ).toBeInTheDocument();
  expect(routeCalls().at(-1)).toContain(`snapshot_id=${corridorRoute.snapshot_id}`);
});

it("explains an empty network instead of offering a check", async () => {
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(
      url.startsWith("/api/planning/plans")
        ? Response.json({
            data: { ...corridorPlan, network: { ...corridorPlan.network, origins: [] } },
          })
        : respond(url),
    ),
  );
  render(<RouteAnalysis defaultDataset="corridor" />);

  expect(
    await screen.findByText(
      "This demonstration network has no starts, ends or profiles to choose from.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: CHECK })).toBeDisabled();
});

it("shows modeled repair impacts and which repairs contribute", async () => {
  const user = userEvent.setup();
  const impacts = [
    {
      profile_id: "wheelchair",
      origin_id: "home",
      destination_id: "clinic",
      modeled_reach_before: 0,
      modeled_reach_after: 0.75,
      contributing_repair_ids: ["r0"],
    },
  ];
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(
      url.startsWith("/api/routing")
        ? Response.json({ data: { ...corridorRoute, route_impacts: impacts } })
        : respond(url),
    ),
  );
  render(<RouteAnalysis defaultDataset="corridor" />);
  await screen.findByRole("combobox", { name: "Start" });
  await checkRoute(user);

  const table = screen.getByRole("table", { name: /Modeled reach for this trip/ });
  expect(within(table).getByRole("row", { name: /home to clinic/ })).toHaveTextContent("75%");
  expect(within(table).getByRole("row", { name: /home to clinic/ })).toHaveTextContent("r0");
  expect(screen.getAllByText(/Simulation with recommended repairs/).length).toBeGreaterThan(0);
});

it("reports an unreadable response instead of crashing when the snapshot is missing", async () => {
  const user = userEvent.setup();
  const withoutSnapshot = Object.fromEntries(
    Object.entries(corridorRoute).filter(([key]) => key !== "snapshot_id"),
  );
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(
      url.startsWith("/api/routing") ? Response.json({ data: withoutSnapshot }) : respond(url),
    ),
  );
  render(<RouteAnalysis defaultDataset="corridor" />);
  await screen.findByRole("combobox", { name: "Start" });

  await user.click(screen.getByRole("button", { name: CHECK }));

  expect(
    await screen.findByText("The route service returned an unreadable response. Please try again."),
  ).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: SUMMARY })).not.toBeInTheDocument();
});

it("renders the repair impacts the API returned for the corridor trip", async () => {
  const user = userEvent.setup();
  render(<RouteAnalysis defaultDataset="corridor" />);
  await screen.findByRole("combobox", { name: "Start" });
  await checkRoute(user);

  const table = screen.getByRole("table", { name: /Modeled reach for this trip/ });
  const row = within(table).getByRole("row", { name: /home to clinic/ });
  expect(within(row).getByText("0%")).toBeInTheDocument();
  expect(within(row).getByText("100%")).toBeInTheDocument();
  expect(within(row).getByText("r0, r1")).toBeInTheDocument();
});

it("moves focus to the results and announces the outcome", async () => {
  const user = userEvent.setup();
  render(<RouteAnalysis defaultDataset="corridor" />);
  await screen.findByRole("combobox", { name: "Start" });
  await checkRoute(user);

  const results = screen.getByRole("heading", { name: SUMMARY }).closest("[tabindex='-1']");
  expect(results).toHaveFocus();
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent(/Route check complete\. Current network: No modeled route/);
});

it("announces a request error assertively and moves focus to it", async () => {
  const user = userEvent.setup();
  render(<RouteAnalysis defaultDataset="corridor" />);
  await screen.findByRole("combobox", { name: "Start" });
  respondWith(() => Promise.resolve(new Response("{}", { status: 500 })));

  await user.click(screen.getByRole("button", { name: CHECK }));

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(/could not complete this check/);
  expect(alert).toHaveFocus();
});

it("moves focus to an invalid budget and names the error on the field", async () => {
  const user = userEvent.setup();
  render(<RouteAnalysis defaultDataset="corridor" />);
  await screen.findByRole("combobox", { name: "Start" });
  const budget = screen.getByRole("textbox", { name: "Repair budget (cost units)" });
  await user.clear(budget);
  await user.type(budget, "-4");

  await user.click(screen.getByRole("button", { name: CHECK }));

  expect(budget).toHaveFocus();
  expect(budget).toHaveAccessibleDescription("Enter a budget between 0 and 1,000,000.");
  expect(screen.getByRole("alert")).toHaveTextContent("Enter a budget between 0 and 1,000,000");
});

it("explains an empty choice list in the live status region", async () => {
  const emptyStart = {
    ...corridorPlan,
    network: {
      ...corridorPlan.network,
      origins: [],
      destinations: corridorPlan.network.destinations,
    },
  };
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(
      url.startsWith("/api/planning/plans") ? Response.json({ data: emptyStart }) : respond(url),
    ),
  );
  render(<RouteAnalysis defaultDataset="corridor" />);
  await screen.findByText(/no starts, ends or profiles/);

  expect(screen.getByRole("button", { name: CHECK })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent(/no starts, ends or profiles/);
});

it("hides repair impacts that describe a different trip than the one shown", async () => {
  const user = userEvent.setup();
  const otherTrip = [
    {
      profile_id: "wheelchair",
      origin_id: "clinic",
      destination_id: "home",
      modeled_reach_before: 0,
      modeled_reach_after: 1,
      contributing_repair_ids: ["r0"],
    },
  ];
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(
      url.startsWith("/api/routing")
        ? Response.json({ data: { ...corridorRoute, route_impacts: otherTrip } })
        : respond(url),
    ),
  );
  render(<RouteAnalysis defaultDataset="corridor" />);
  await screen.findByRole("combobox", { name: "Start" });
  await checkRoute(user);

  expect(
    screen.queryByRole("table", { name: /Modeled reach for this trip/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(/No recommended repair improves modeled reach/),
  ).not.toBeInTheDocument();
});

it("says distance is unavailable rather than zero when a route has no distance", async () => {
  const user = userEvent.setup();
  const noDistance = {
    ...corridorRoute,
    after_repairs: { ...corridorRoute.after_repairs, distance_m: null },
  };
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(
      url.startsWith("/api/routing") ? Response.json({ data: noDistance }) : respond(url),
    ),
  );
  render(<RouteAnalysis defaultDataset="corridor" />);
  await screen.findByRole("combobox", { name: "Start" });
  await checkRoute(user);

  const comparison = screen.getByRole("table", { name: /Current network compared/ });
  expect(within(comparison).queryByText(/^0 m/)).not.toBeInTheDocument();
  expect(within(comparison).getByText(/distance unavailable/)).toBeInTheDocument();
});
