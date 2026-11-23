import { afterEach, describe, expect, it, vi } from "vitest";
import corridorRoute from "@/test/corridor-route.json";
import {
  describeOutcome,
  fetchRouteAnalysis,
  profileLabel,
  routeSummary,
  type RouteAnalysis,
  type RouteOutcome,
} from "./routing-api";

// Captured from the real engine: GET /routing/analysis?dataset=corridor&origin=home&destination=clinic&profile=wheelchair&budget=20.
const route = corridorRoute as RouteAnalysis;
const signal = () => new AbortController().signal;
const QUERY = {
  dataset: "corridor" as const,
  origin: "home",
  destination: "clinic",
  profile: "wheelchair",
  budget: 20,
};

const NO_ROUTE_BARRIER: RouteOutcome = {
  status: "no_route",
  reason: "barrier",
  generalized_cost: null,
  distance_m: null,
  node_ids: [],
  edge_ids: [],
  barriers_on_route: [],
};

afterEach(() => vi.unstubAllGlobals());

describe("describeOutcome", () => {
  it("states the barrier cause plainly when no route exists", () => {
    expect(describeOutcome(NO_ROUTE_BARRIER, "Current network", 100)).toBe(
      "Current network: no modeled route. Recorded barriers block every path.",
    );
  });

  it("states the threshold when a route is too long or disconnected", () => {
    const outcome = { ...NO_ROUTE_BARRIER, reason: "distance_or_disconnected" as const };
    expect(describeOutcome(outcome, "Current network", 1500)).toBe(
      "Current network: no modeled route within 1,500 m.",
    );
  });

  it("reports distance and says the route was not checked on site", () => {
    const outcome: RouteOutcome = {
      ...NO_ROUTE_BARRIER,
      status: "accessible",
      reason: null,
      distance_m: 50,
      generalized_cost: 50,
      node_ids: ["a", "b", "c"],
      edge_ids: ["e0", "e1"],
    };
    expect(describeOutcome(outcome, "After repairs", 100)).toBe(
      "After repairs: modeled route of 50 m, 0 barriers on the route. Not checked on site.",
    );
  });

  it("says uncertainty depends on unverified barriers", () => {
    const outcome = { ...NO_ROUTE_BARRIER, status: "uncertain" as const, reason: null };
    expect(describeOutcome(outcome, "Current", 100)).toBe(
      "Current: a modeled route exists only if unverified barriers are absent. 0 barriers on the route among verified barriers. Not checked on site.",
    );
  });
});

describe("routeSummary", () => {
  it("gives the corridor summary in reading order from the real engine output", () => {
    expect(routeSummary(route)).toEqual([
      "Current network: no modeled route. Recorded barriers block every path.",
      "Simulation with recommended repairs: modeled route of 50 m, 0 barriers on the route. Not checked on site.",
      "Within the budget of 20 cost units, the recommended repairs are r0, r1, costing 20 units.",
      "Barriers on the direct path: 2. 2 block this profile.",
    ]);
  });

  it("says when no repair combination fits the budget", () => {
    const none: RouteAnalysis = {
      ...route,
      budget: 5,
      recommended_repair_ids: [],
      recommended_cost: 0,
    };
    expect(routeSummary(none)[2]).toBe(
      "Within the budget of 5 cost units, no repair combination opens a route in the model.",
    );
  });
});

describe("profileLabel", () => {
  it("names known profiles and falls back to the raw ID", () => {
    expect(profileLabel("wheelchair")).toBe("Wheelchair user");
    expect(profileLabel("custom_profile")).toBe("custom_profile");
  });
});

describe("fetchRouteAnalysis", () => {
  it("requests the analysis with every query parameter and returns its data", async () => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(() =>
      Promise.resolve(new Response(JSON.stringify({ data: route }))),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchRouteAnalysis(QUERY, signal());
    expect(result.current.status).toBe("no_route");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/routing/analysis?dataset=corridor&origin=home&destination=clinic&profile=wheelchair&budget=20",
    );
  });

  it.each([
    [404, "That start, end or profile is not in this demonstration network."],
    [429, "Too many route checks. Wait a minute before trying again."],
    [500, "The route service could not complete this check. Please try again."],
  ])("maps HTTP %i to a user-facing message", async (status, message) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("{}", { status }))),
    );
    await expect(fetchRouteAnalysis(QUERY, signal())).rejects.toThrow(message);
  });

  it("reports an unreachable service without exposing the network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("socket hang up"))),
    );
    await expect(fetchRouteAnalysis(QUERY, signal())).rejects.toThrow(
      "Cannot reach the route service. Please try again.",
    );
  });
});
