import { formatNumber } from "@/lib/planning-api";
import {
  STATUS_WORDS,
  distanceText,
  profileLabel,
  routeSummary,
  type RouteAnalysis,
  type RouteBarrier,
  type RouteImpact,
  type RouteOutcome,
} from "@/lib/routing-api";

const TH = "border-b border-line px-3 py-2 text-left font-semibold text-ink";
const TD = "border-b border-line px-3 py-2 align-top";
const SNAPSHOT_PREFIX_LENGTH = 12;

function outcomeDetail(outcome: RouteOutcome, thresholdM: number): string {
  if (outcome.status === "no_route")
    return outcome.reason === "barrier"
      ? "Recorded barriers block every path."
      : `No path within ${formatNumber(thresholdM)} m.`;
  const count = outcome.barriers_on_route.length;
  return `${distanceText(outcome)}, ${count} barrier${count === 1 ? "" : "s"} on route`;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function ImpactRow({ impact }: { readonly impact: RouteImpact }) {
  const repairs = impact.contributing_repair_ids.join(", ") || "none";
  return (
    <tr>
      <th scope="row" className={TD}>
        {impact.origin_id} to {impact.destination_id}
      </th>
      <td className={TD}>{percent(impact.modeled_reach_before)}</td>
      <td className={TD}>{percent(impact.modeled_reach_after)}</td>
      <td className={TD}>{repairs}</td>
    </tr>
  );
}

function RepairImpacts({ impacts }: { readonly impacts: readonly RouteImpact[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <caption className="mb-2 text-left font-semibold text-ink">
          Modeled reach for this trip, before and after recommended repairs (simulation)
        </caption>
        <thead>
          <tr>
            <th scope="col" className={TH}>
              Trip
            </th>
            <th scope="col" className={TH}>
              Reach before repairs
            </th>
            <th scope="col" className={TH}>
              Simulated reach after repairs
            </th>
            <th scope="col" className={TH}>
              Repairs that add reach
            </th>
          </tr>
        </thead>
        <tbody>
          {impacts.map((impact) => (
            <ImpactRow key={`${impact.origin_id}-${impact.destination_id}`} impact={impact} />
          ))}
        </tbody>
      </table>
      {impacts.length === 0 ? (
        <p className="mt-2 text-muted">
          No recommended repair improves modeled reach for this trip.
        </p>
      ) : null}
    </div>
  );
}

function BarrierRow({ barrier }: { readonly barrier: RouteBarrier }) {
  return (
    <tr>
      <th scope="row" className={TD}>
        {barrier.id}
      </th>
      <td className={TD}>{barrier.type}</td>
      <td className={TD}>{barrier.severity} of 5</td>
      <td className={TD}>{barrier.verified ? "Verified" : "Unverified"}</td>
      <td className={TD}>{barrier.blocks_profile ? "Blocks this profile" : "Does not block"}</td>
    </tr>
  );
}

/**
 * Impacts for the displayed trip. An empty list means no repair improves it. Impacts that
 * describe other trips are stale or mismatched, so they are hidden rather than shown.
 */
function impactsForTrip(analysis: RouteAnalysis): readonly RouteImpact[] | null {
  const impacts = analysis.route_impacts;
  if (!impacts || impacts.length === 0) return impacts ?? null;
  const matching = impacts.filter(
    (impact) =>
      impact.profile_id === analysis.profile_id &&
      impact.origin_id === analysis.origin_id &&
      impact.destination_id === analysis.destination_id,
  );
  return matching.length > 0 ? matching : null;
}

export function RouteResults({ analysis }: { readonly analysis: RouteAnalysis }) {
  const threshold = analysis.threshold_m;
  const tripImpacts = impactsForTrip(analysis);
  const repairs = analysis.recommended_repair_ids.join(", ") || "none";
  return (
    <div className="space-y-8">
      <section aria-labelledby="route-summary-heading" className="space-y-3">
        <h2 id="route-summary-heading" className="af-h2">
          Route summary for {profileLabel(analysis.profile_id)}
        </h2>
        <ol className="list-decimal space-y-2 pl-6 text-ink">
          {routeSummary(analysis).map((sentence) => (
            <li key={sentence}>{sentence}</li>
          ))}
        </ol>
      </section>

      <p className="text-sm text-muted">
        Network snapshot {analysis.snapshot_id.slice(0, SNAPSHOT_PREFIX_LENGTH)}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <caption className="mb-2 text-left font-semibold text-ink">
            Current network compared with the network after recommended repairs
          </caption>
          <thead>
            <tr>
              <th scope="col" className={TH}>
                Network state
              </th>
              <th scope="col" className={TH}>
                Modeled status
              </th>
              <th scope="col" className={TH}>
                Detail
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className={TD}>
                Current
              </th>
              <td className={TD}>{STATUS_WORDS[analysis.current.status]}</td>
              <td className={TD}>{outcomeDetail(analysis.current, threshold)}</td>
            </tr>
            <tr>
              <th scope="row" className={TD}>
                Simulation with recommended repairs ({repairs})
              </th>
              <td className={TD}>{STATUS_WORDS[analysis.after_repairs.status]}</td>
              <td className={TD}>{outcomeDetail(analysis.after_repairs, threshold)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <caption className="mb-2 text-left font-semibold text-ink">
            Barriers on the direct path
          </caption>
          <thead>
            <tr>
              <th scope="col" className={TH}>
                Barrier
              </th>
              <th scope="col" className={TH}>
                Type
              </th>
              <th scope="col" className={TH}>
                Severity
              </th>
              <th scope="col" className={TH}>
                Verification
              </th>
              <th scope="col" className={TH}>
                Effect on this profile
              </th>
            </tr>
          </thead>
          <tbody>
            {analysis.affecting_barriers.map((barrier) => (
              <BarrierRow key={barrier.id} barrier={barrier} />
            ))}
          </tbody>
        </table>
        {analysis.affecting_barriers.length === 0 ? (
          <p className="mt-2 text-muted">No recorded barrier lies on the direct path.</p>
        ) : null}
      </div>

      {tripImpacts ? <RepairImpacts impacts={tripImpacts} /> : null}

      <section aria-labelledby="route-limits-heading" className="space-y-2">
        <h2 id="route-limits-heading" className="af-h2">
          Limits of this result
        </h2>
        <ul className="list-disc space-y-1 pl-6 text-ink">
          {analysis.limitations.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
