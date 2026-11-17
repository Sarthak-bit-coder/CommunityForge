import {
  METHOD_LABELS,
  METHOD_NOTES,
  formatNumber,
  recommended,
  repairTarget,
  type Plan,
} from "@/lib/planning-api";
import { NetworkDiagram } from "./NetworkDiagram";

const PERCENT = 100;
const TH = "border-b border-line px-3 py-2 text-left font-semibold text-ink";
const TD = "border-b border-line px-3 py-2 align-top";

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-bold text-ink">{value}</dd>
      <dd className="mt-1 text-sm text-muted">{note}</dd>
    </div>
  );
}

function list(values: readonly string[]): string {
  return values.length ? values.join(", ") : "None";
}

export function PlanResults({ plan }: { readonly plan: Plan }) {
  const best = recommended(plan);
  const costs = new Map(plan.network.repairs.map((repair) => [repair.id, repair.cost]));
  const cheapest = Math.min(...costs.values());
  const swing = Math.round(plan.cost_perturbation_fraction * PERCENT);
  const gainShare =
    plan.accessibility_before > 0 ? (best.delta_a / plan.accessibility_before) * PERCENT : null;

  return (
    <div className="space-y-10">
      <section aria-labelledby="plan-heading">
        <h2 id="plan-heading" className="text-xl font-semibold text-ink">
          Recommended plan
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <Stat
            label="Budget used"
            value={`${formatNumber(best.total_cost)} of ${formatNumber(plan.budget)}`}
            note={`Cost units. All ${plan.network.repairs.length} repairs together cost ${formatNumber(plan.total_repair_cost)}.`}
          />
          <Stat
            label="Modeled access"
            value={`${formatNumber(plan.accessibility_before)} → ${formatNumber(best.accessibility_after)}`}
            note={
              gainShare === null
                ? `Gain of ${formatNumber(best.delta_a)} weighted reachable destinations.`
                : `Gain of ${formatNumber(best.delta_a)} weighted reachable destinations (${formatNumber(gainShare)}%).`
            }
          />
          <Stat
            label="Repairs selected"
            value={`${best.selected_repair_ids.length} of ${plan.network.repairs.length}`}
            note="Chosen together, not ranked one by one."
          />
        </dl>
        {best.selected_repair_ids.length === 0 ? (
          <p className="mt-4 rounded-lg border border-warning bg-warning-soft p-4 text-ink">
            No combination of repairs within this budget improves modeled access. The cheapest
            single repair costs {formatNumber(cheapest)} cost units, and some repairs only help when
            funded together. Try a larger budget.
          </p>
        ) : null}
      </section>

      {best.explanations.length ? (
        <section aria-labelledby="why-heading">
          <h2 id="why-heading" className="text-xl font-semibold text-ink">
            Why these repairs
          </h2>
          <div
            role="region"
            aria-label="Why these repairs, scrollable table"
            tabIndex={0}
            className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface"
          >
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <caption className="sr-only">
                Each selected repair, what it fixes, and what the model loses without it
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={TH}>
                    Repair
                  </th>
                  <th scope="col" className={TH}>
                    Fixes
                  </th>
                  <th scope="col" className={TH}>
                    Cost
                  </th>
                  <th scope="col" className={TH}>
                    Access lost without it
                  </th>
                  <th scope="col" className={TH}>
                    Works together with
                  </th>
                  <th scope="col" className={TH}>
                    Who gains
                  </th>
                  <th scope="col" className={TH}>
                    Still chosen if costs shift ±{swing}%
                  </th>
                </tr>
              </thead>
              <tbody>
                {best.explanations.map((item) => (
                  <tr key={item.repair_id}>
                    <th scope="row" className={`${TD} text-left font-semibold text-ink`}>
                      {item.repair_id}
                    </th>
                    <td className={TD}>{repairTarget(plan.network, item.repair_id)}</td>
                    <td className={TD}>{formatNumber(costs.get(item.repair_id) ?? 0)}</td>
                    <td className={TD}>{formatNumber(item.marginal_delta_a)}</td>
                    <td className={TD}>{list(item.complementary_repair_ids)}</td>
                    <td className={TD}>
                      {list(item.profiles_benefiting)}
                      <span className="block text-muted">
                        Reaching: {list(item.destination_categories)}
                      </span>
                    </td>
                    <td className={TD}>{item.stable_under_cost_perturbation ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm text-muted">
            “Access lost without it” is the modeled gain that disappears if that one repair is
            dropped from the plan. These amounts overlap and do not add up to the total.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="network-heading">
        <h2 id="network-heading" className="text-xl font-semibold text-ink">
          Network and repair candidates
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <NetworkDiagram network={plan.network} selected={best.selected_repair_ids} />
          <div
            role="region"
            aria-label="Repair candidates, scrollable table"
            tabIndex={0}
            className="overflow-x-auto rounded-lg border border-line bg-surface"
          >
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">All repair candidates in this network</caption>
              <thead>
                <tr>
                  <th scope="col" className={TH}>
                    Repair
                  </th>
                  <th scope="col" className={TH}>
                    Fixes
                  </th>
                  <th scope="col" className={TH}>
                    Cost
                  </th>
                  <th scope="col" className={TH}>
                    In plan
                  </th>
                </tr>
              </thead>
              <tbody>
                {plan.network.repairs.map((repair) => (
                  <tr key={repair.id}>
                    <th scope="row" className={`${TD} text-left font-semibold text-ink`}>
                      {repair.id}
                    </th>
                    <td className={TD}>{repairTarget(plan.network, repair.id)}</td>
                    <td className={TD}>{formatNumber(repair.cost)}</td>
                    <td className={TD}>
                      {best.selected_repair_ids.includes(repair.id) ? "✓ Yes" : "No"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section aria-labelledby="methods-heading">
        <h2 id="methods-heading" className="text-xl font-semibold text-ink">
          How other ways of choosing compare
        </h2>
        <p className="mt-1 max-w-prose text-muted">
          Same network, same budget. Methods that rank barriers one at a time can spend money on
          repairs that open no complete route.
        </p>
        <div
          role="region"
          aria-label="Method comparison, scrollable table"
          tabIndex={0}
          className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface"
        >
          <table className="w-full min-w-[38rem] border-collapse text-sm">
            <caption className="sr-only">Modeled gain of each selection method</caption>
            <thead>
              <tr>
                <th scope="col" className={TH}>
                  Method
                </th>
                <th scope="col" className={TH}>
                  Repairs chosen
                </th>
                <th scope="col" className={TH}>
                  Cost
                </th>
                <th scope="col" className={TH}>
                  Modeled gain
                </th>
              </tr>
            </thead>
            <tbody>
              {plan.plans.map((item) => {
                const share = best.delta_a > 0 ? (item.delta_a / best.delta_a) * PERCENT : 0;
                return (
                  <tr key={item.method}>
                    <th scope="row" className={`${TD} text-left text-ink`}>
                      <span className="font-semibold">{METHOD_LABELS[item.method]}</span>
                      <span className="block font-normal text-muted">
                        {METHOD_NOTES[item.method]}
                      </span>
                    </th>
                    <td className={TD}>{list(item.selected_repair_ids)}</td>
                    <td className={TD}>{formatNumber(item.total_cost)}</td>
                    <td className={TD}>
                      {formatNumber(item.delta_a)}
                      <span className="block text-muted">
                        {formatNumber(share)}% of the best plan
                      </span>
                      <span
                        aria-hidden="true"
                        className="mt-1 block h-2 rounded bg-accent"
                        style={{ width: `${Math.max(share, 1)}%` }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="who-heading">
        <h2 id="who-heading" className="text-xl font-semibold text-ink">
          Who gains in the recommended plan
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(
            [
              ["By mobility profile", best.delta_a_by_profile],
              ["By origin group", best.delta_a_by_group],
            ] as const
          ).map(([title, values]) => (
            <div
              key={title}
              role="region"
              aria-label={`${title}, scrollable table`}
              tabIndex={0}
              className="overflow-x-auto rounded-lg border border-line bg-surface"
            >
              <table className="w-full border-collapse text-sm">
                <caption className={`${TH} border-b-0 text-left`}>{title}</caption>
                <thead>
                  <tr>
                    <th scope="col" className={TH}>
                      Group
                    </th>
                    <th scope="col" className={TH}>
                      Modeled gain
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(values).map(([key, value]) => (
                    <tr key={key}>
                      <th scope="row" className={`${TD} text-left font-normal`}>
                        {key}
                      </th>
                      <td className={TD}>{formatNumber(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">
          The engine reports how gains are distributed. It does not yet optimize for an equity
          target, so no fairness guarantee is implied.
        </p>
      </section>
    </div>
  );
}
