// Mirrors FastAPI's RouteAnalysisView (services/api/accessforge_api/routing_schemas.py).
// Every route is a modeled path on a synthetic network, never a safe-route determination.
import { fetchPlan, formatNumber, type Dataset, type Network } from "./planning-api";

export type RouteStatus = "accessible" | "uncertain" | "no_route";
export type RouteReason = "barrier" | "distance_or_disconnected";

export type RouteBarrier = {
  readonly id: string;
  readonly edge_id: string | null;
  readonly node_id: string | null;
  readonly type: string;
  readonly severity: number;
  readonly verified: boolean;
  readonly blocks_profile: boolean;
};

export type RouteOutcome = {
  readonly status: RouteStatus;
  readonly reason: RouteReason | null;
  readonly generalized_cost: number | null;
  readonly distance_m: number | null;
  readonly node_ids: readonly string[];
  readonly edge_ids: readonly string[];
  readonly barriers_on_route: readonly RouteBarrier[];
};

/** Modeled reach of one trip before and after the recommended repairs (a simulation). */
export type RouteImpact = {
  readonly profile_id: string;
  readonly origin_id: string;
  readonly destination_id: string;
  readonly modeled_reach_before: number;
  readonly modeled_reach_after: number;
  readonly contributing_repair_ids: readonly string[];
};

export type RouteAnalysis = {
  readonly dataset: Dataset;
  readonly synthetic: boolean;
  readonly budget: number;
  readonly engine_version: string;
  readonly snapshot_id: string;
  /** Present only when the API reports repair impacts; absent means not reported. */
  readonly route_impacts?: readonly RouteImpact[];
  readonly origin_id: string;
  readonly destination_id: string;
  readonly profile_id: string;
  readonly threshold_m: number;
  readonly recommended_repair_ids: readonly string[];
  readonly recommended_cost: number;
  readonly current: RouteOutcome;
  readonly after_repairs: RouteOutcome;
  readonly affecting_barriers: readonly RouteBarrier[];
  readonly limitations: readonly string[];
};

export type RouteQuery = {
  readonly dataset: Dataset;
  readonly origin: string;
  readonly destination: string;
  readonly profile: string;
  readonly budget: number;
  /** Snapshot the user last saw; the API refuses the check if the network has changed. */
  readonly snapshotId?: string;
};

/** The network changed since the snapshot the caller expected. */
export class StaleSnapshotError extends Error {
  constructor() {
    super("The network data changed since your last check. Check the route again.");
    this.name = "StaleSnapshotError";
  }
}

const PROFILE_LABELS: Record<string, string> = {
  wheelchair: "Wheelchair user",
  low_vision: "Low-vision pedestrian",
  pedestrian: "Typical pedestrian",
};

export function profileLabel(profileId: string): string {
  return PROFILE_LABELS[profileId] ?? profileId;
}

export const STATUS_WORDS: Record<RouteStatus, string> = {
  accessible: "Modeled route found",
  uncertain: "Route depends on unverified barriers",
  no_route: "No modeled route",
};

const REQUEST_TIMEOUT_MS = 30_000;
const TOO_MANY_REQUESTS = 429;
const NOT_FOUND = 404;
const CONFLICT = 409;

export async function fetchRouteAnalysis(
  query: RouteQuery,
  signal: AbortSignal,
): Promise<RouteAnalysis> {
  const params = new URLSearchParams({
    dataset: query.dataset,
    origin: query.origin,
    destination: query.destination,
    profile: query.profile,
    budget: String(query.budget),
    ...(query.snapshotId ? { snapshot_id: query.snapshotId } : {}),
  });
  let response: Response;
  try {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    response = await fetch(`/api/routing/analysis?${params}`, {
      signal: AbortSignal.any([signal, timeout]),
      cache: "no-store",
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error("Cannot reach the route service. Please try again.");
  }
  if (response.status === TOO_MANY_REQUESTS)
    throw new Error("Too many route checks. Wait a minute before trying again.");
  if (response.status === NOT_FOUND)
    throw new Error("That start, end or profile is not in this demonstration network.");
  if (response.status === CONFLICT) throw new StaleSnapshotError();
  if (!response.ok)
    throw new Error("The route service could not complete this check. Please try again.");
  const unreadable = new Error(
    "The route service returned an unreadable response. Please try again.",
  );
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw unreadable;
  }
  const data = isRecord(body) ? body.data : undefined;
  if (!isRouteAnalysis(data)) throw unreadable;
  return data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOutcome(value: unknown): boolean {
  return (
    isRecord(value) && typeof value.status === "string" && Array.isArray(value.barriers_on_route)
  );
}

/** Checks the fields the results page reads; anything else is treated as unreadable. */
function isRouteAnalysis(value: unknown): value is RouteAnalysis {
  if (!isRecord(value)) return false;
  const text = [
    "dataset",
    "engine_version",
    "snapshot_id",
    "origin_id",
    "destination_id",
    "profile_id",
  ];
  const numbers = ["budget", "threshold_m", "recommended_cost"];
  return (
    text.every((key) => typeof value[key] === "string") &&
    numbers.every((key) => typeof value[key] === "number") &&
    Array.isArray(value.recommended_repair_ids) &&
    Array.isArray(value.affecting_barriers) &&
    Array.isArray(value.limitations) &&
    isOutcome(value.current) &&
    isOutcome(value.after_repairs) &&
    (value.route_impacts === undefined || Array.isArray(value.route_impacts))
  );
}

/** Origins, destinations and profiles the demonstration network supports. */
export async function fetchLocations(dataset: Dataset, signal: AbortSignal): Promise<Network> {
  const plan = await fetchPlan(dataset, 0, signal);
  return plan.network;
}

function barrierCount(outcome: RouteOutcome): string {
  const count = outcome.barriers_on_route.length;
  return `${count} barrier${count === 1 ? "" : "s"} on the route`;
}

/** One plain sentence per route state, without relying on the map or on color. */
export function distanceText(outcome: RouteOutcome): string {
  return outcome.distance_m === null
    ? "distance unavailable"
    : `${formatNumber(outcome.distance_m)} m`;
}

export function describeOutcome(outcome: RouteOutcome, label: string, thresholdM: number): string {
  if (outcome.status === "accessible") {
    const route =
      outcome.distance_m === null
        ? "modeled route, distance unavailable"
        : `modeled route of ${formatNumber(outcome.distance_m)} m`;
    return `${label}: ${route}, ${barrierCount(outcome)}. Not checked on site.`;
  }
  if (outcome.status === "uncertain")
    return `${label}: a modeled route exists only if unverified barriers are absent. ${barrierCount(outcome)} among verified barriers. Not checked on site.`;
  if (outcome.reason === "barrier")
    return `${label}: no modeled route. Recorded barriers block every path.`;
  return `${label}: no modeled route within ${formatNumber(thresholdM)} m.`;
}

/** Full non-map summary in reading order; the same facts the tables show. */
export function routeSummary(analysis: RouteAnalysis): readonly string[] {
  const { threshold_m: threshold, recommended_repair_ids: repairs } = analysis;
  const budget = formatNumber(analysis.budget);
  const recommendation =
    repairs.length === 0
      ? `Within the budget of ${budget} cost units, no repair combination opens a route in the model.`
      : `Within the budget of ${budget} cost units, the recommended repairs are ${repairs.join(", ")}, costing ${formatNumber(analysis.recommended_cost)} units.`;
  const blocking = analysis.affecting_barriers.filter((item) => item.blocks_profile).length;
  const affecting =
    analysis.affecting_barriers.length === 0
      ? "No recorded barrier lies on the direct path."
      : `Barriers on the direct path: ${analysis.affecting_barriers.length}. ${blocking} block this profile.`;
  return [
    describeOutcome(analysis.current, "Current network", threshold),
    describeOutcome(analysis.after_repairs, "Simulation with recommended repairs", threshold),
    recommendation,
    affecting,
  ];
}
