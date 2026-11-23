import { useState } from "react";
import { formatNumber, recommended, repairNames, type Plan } from "@/lib/planning-api";
import { profileLabel, type RouteImpact } from "@/lib/routing-api";

function tripKey(trip: RouteImpact) {
  return JSON.stringify([trip.profile_id, trip.origin_id, trip.destination_id]);
}

function reachChanges(before: readonly RouteImpact[], after: readonly RouteImpact[]) {
  const first = new Map(before.map((trip) => [tripKey(trip), trip]));
  const second = new Map(after.map((trip) => [tripKey(trip), trip]));
  // The engine returns only trips whose reach improved over the common unrepaired network.
  return [...new Map([...first, ...second])].flatMap(([key, trip]) => {
    const from = first.get(key)?.modeled_reach_after ?? trip.modeled_reach_before;
    const to = second.get(key)?.modeled_reach_after ?? trip.modeled_reach_before;
    return from === to ? [] : [{ key, trip, from, to }];
  });
}

export function BudgetComparison({ current, saved }: { current: Plan; saved: readonly Plan[] }) {
  const [chosen, setChosen] = useState("");
  const otherBudgets = saved.filter(
    (p) => p.dataset === current.dataset && p.budget !== current.budget,
  );
  if (!otherBudgets.length) return null;
  const comparable = otherBudgets.filter(
    (p) =>
      !!current.snapshot_id &&
      p.snapshot_id === current.snapshot_id &&
      p.engine_version === current.engine_version,
  );
  if (!comparable.length)
    return <p>To compare budget changes, run both budgets on the same network snapshot.</p>;
  const baseline = comparable.find((p) => String(p.budget) === chosen) ?? comparable[0];
  const a = recommended(baseline),
    b = recommended(current);
  const added = b.selected_repair_ids.filter((id) => !a.selected_repair_ids.includes(id));
  const removed = a.selected_repair_ids.filter((id) => !b.selected_repair_ids.includes(id));
  const changes =
    a.route_impacts && b.route_impacts ? reachChanges(a.route_impacts, b.route_impacts) : null;
  const cost = b.total_cost - a.total_cost;
  return (
    <section className="mt-4 space-y-2" aria-label="Budget changes">
      <h3 className="text-lg font-semibold">
        What changes at budget {formatNumber(current.budget)}?
      </h3>
      <label className="af-label">
        Compare with saved budget
        <select
          className="af-select"
          value={String(baseline.budget)}
          onChange={(e) => setChosen(e.target.value)}
        >
          {comparable.map((p) => (
            <option key={p.budget} value={String(p.budget)}>
              {formatNumber(p.budget)} cost units
            </option>
          ))}
        </select>
      </label>
      <p>
        Modeled repair spending: {formatNumber(a.total_cost)} to {formatNumber(b.total_cost)} cost
        units ({cost > 0 ? "+" : ""}
        {formatNumber(cost)}).
      </p>
      <p>
        Repairs added: {repairNames(current.network, added)}. Repairs removed:{" "}
        {repairNames(baseline.network, removed)}.
      </p>
      <h4 className="font-semibold">Change in modeled destination reach</h4>
      {changes === null ? (
        <p>Trip details unavailable for this comparison.</p>
      ) : changes.length === 0 ? (
        <p>No trips changed modeled reach.</p>
      ) : (
        <ul className="list-disc pl-5">
          {changes.map(({ key, trip, from, to }) => (
            <li key={key}>
              {profileLabel(trip.profile_id)}, {trip.origin_id} to {trip.destination_id}:{" "}
              {formatNumber(100 * from)}% to {formatNumber(100 * to)}% of modeled scenarios.
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
