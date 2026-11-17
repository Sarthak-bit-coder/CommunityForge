// Mirrors FastAPI's PlanView (services/api/accessforge_api/planning_schemas.py).
// Every number here is a modeled engine output on a synthetic network.

export const DATASETS = ["corridor", "grid_scattered", "grid_clustered"] as const;
export type Dataset = (typeof DATASETS)[number];

export const DATASET_LABELS: Record<Dataset, string> = {
  corridor: "Two-barrier corridor",
  grid_scattered: "Street grid, scattered barriers",
  grid_clustered: "Street grid, clustered barriers",
};
export const DATASET_NOTES: Record<Dataset, string> = {
  corridor:
    "One home, one clinic, and two step barriers in a row. Fixing only one of them opens nothing for a wheelchair user.",
  grid_scattered: "A 4 by 3 block grid with eight barriers placed at random.",
  grid_clustered: "A 4 by 3 block grid with eight barriers placed next to each other.",
};

export const METHODS = ["exhaustive", "B3", "B1", "B2"] as const;
export type Method = (typeof METHODS)[number];
export const RECOMMENDED_METHOD: Method = "exhaustive";

export const METHOD_LABELS: Record<Method, string> = {
  exhaustive: "Best combination",
  B3: "One repair at a time",
  B1: "Worst severity first",
  B2: "Nearby destinations and residents",
};
export const METHOD_NOTES: Record<Method, string> = {
  exhaustive: "Checks every affordable combination. Proven best for this model, not for reality.",
  B3: "Keeps adding the single repair with the most gain per cost. Misses repairs that only help together.",
  B1: "Funds the most severe barriers first and ignores how routes connect.",
  B2: "Scores each barrier by what is nearby and ignores how routes connect.",
};

export type Explanation = {
  readonly repair_id: string;
  readonly marginal_delta_a: number;
  readonly profiles_benefiting: readonly string[];
  readonly destination_categories: readonly string[];
  readonly complementary_repair_ids: readonly string[];
  readonly stable_under_cost_perturbation: boolean;
};
export type MethodPlan = {
  readonly method: Method;
  readonly selected_repair_ids: readonly string[];
  readonly total_cost: number;
  readonly accessibility_after: number;
  readonly delta_a: number;
  readonly delta_a_by_profile: Readonly<Record<string, number>>;
  readonly delta_a_by_group: Readonly<Record<string, number>>;
  readonly optimality_proven: boolean;
  readonly explanations: readonly Explanation[];
};
export type Network = {
  readonly nodes: readonly { id: string; x_m: number; y_m: number }[];
  readonly edges: readonly { id: string; u: string; v: string; length_m: number }[];
  readonly barriers: readonly {
    id: string;
    edge_id: string | null;
    node_id: string | null;
    type: string;
    severity: number;
  }[];
  readonly repairs: readonly { id: string; barrier_ids: readonly string[]; cost: number }[];
  readonly origins: readonly { id: string; node_id: string; weight: number; group: string }[];
  readonly destinations: readonly {
    id: string;
    node_id: string;
    category: string;
    weight: number;
  }[];
  readonly profiles: readonly {
    id: string;
    weight: number;
    impassable_types: readonly string[];
    threshold_m: number;
  }[];
};
export type Plan = {
  readonly dataset: Dataset;
  readonly synthetic: boolean;
  readonly budget: number;
  readonly total_repair_cost: number;
  readonly accessibility_before: number;
  readonly cost_perturbation_fraction: number;
  readonly engine_version: string;
  readonly network: Network;
  readonly plans: readonly MethodPlan[];
};

export const MAX_BUDGET = 1_000_000;
const REQUEST_TIMEOUT_MS = 30_000;
const TOO_MANY_REQUESTS = 429;

/** Returns the budget, or null when the text is not a usable amount. */
export function parseBudget(text: string): number | null {
  const value = Number(text);
  return text.trim() !== "" && Number.isFinite(value) && value >= 0 && value <= MAX_BUDGET
    ? value
    : null;
}

export async function fetchPlan(
  dataset: Dataset,
  budget: number,
  signal: AbortSignal,
): Promise<Plan> {
  const query = new URLSearchParams({ dataset, budget: String(budget) });
  let response: Response;
  try {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    response = await fetch(`/api/planning/plans?${query}`, {
      signal: AbortSignal.any([signal, timeout]),
      cache: "no-store",
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error("Cannot reach the planning service. Please try again.");
  }
  if (response.status === TOO_MANY_REQUESTS)
    throw new Error("Too many planning runs. Wait a minute before trying again.");
  if (!response.ok)
    throw new Error("The planning service could not complete this run. Please try again.");
  try {
    return (await response.json()).data as Plan;
  } catch {
    throw new Error("The planning service returned an unreadable response. Please try again.");
  }
}

export function recommended(plan: Plan): MethodPlan {
  const best = plan.plans.find((item) => item.method === RECOMMENDED_METHOD);
  if (!best) throw new Error("Planning result is missing the recommended method.");
  return best;
}

const NUMBER_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
export function formatNumber(value: number): string {
  return NUMBER_FORMAT.format(value);
}

/** Plain words for the first barrier a repair removes, e.g. "step on segment e0". */
export function repairTarget(network: Network, repairId: string): string {
  const repair = network.repairs.find((item) => item.id === repairId);
  return (repair?.barrier_ids ?? [])
    .map((id) => network.barriers.find((barrier) => barrier.id === id))
    .map((barrier) =>
      barrier
        ? `${barrier.type} on ${barrier.edge_id ? `segment ${barrier.edge_id}` : `node ${barrier.node_id}`}`
        : "unknown barrier",
    )
    .join(", ");
}

export const EXPORT_NOTICE =
  "Modeled estimate on a synthetic demonstration network. Not an inspection, a compliance determination, a cost estimate, or a safe route.";

function csvCell(value: string | number | boolean): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** One row per method and selected repair, with provenance in the leading rows. */
export function planCsv(plan: Plan): string {
  const rows: (string | number | boolean)[][] = [
    ["notice", EXPORT_NOTICE],
    ["dataset", plan.dataset],
    ["engine_version", plan.engine_version],
    ["budget_cost_units", plan.budget],
    ["modeled_access_before", plan.accessibility_before],
    [],
    [
      "method",
      "repair_id",
      "fixes",
      "cost_units",
      "method_total_cost",
      "method_modeled_gain",
      "modeled_access_after",
    ],
  ];
  for (const item of plan.plans) {
    const costs = new Map(plan.network.repairs.map((repair) => [repair.id, repair.cost]));
    const ids = item.selected_repair_ids.length ? item.selected_repair_ids : [""];
    for (const id of ids)
      rows.push([
        item.method,
        id,
        id ? repairTarget(plan.network, id) : "no repair selected",
        id ? (costs.get(id) ?? "") : 0,
        item.total_cost,
        item.delta_a,
        item.accessibility_after,
      ]);
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function dataUri(mediaType: string, text: string): string {
  return `data:${mediaType};charset=utf-8,${encodeURIComponent(text)}`;
}
