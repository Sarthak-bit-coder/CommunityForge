"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  DATASETS,
  DATASET_LABELS,
  DATASET_NOTES,
  PILOT_DATASET,
  budgetProblem,
  dataUri,
  defaultBudget,
  exportNotice,
  fetchPlan,
  formatNumber,
  parseBudget,
  planCsv,
  recommended,
  repairNames,
  type Dataset,
  type Plan,
} from "@/lib/planning-api";
import { BudgetComparison } from "./BudgetComparison";
import { PlanResults } from "./PlanResults";

const DEFAULT_DATASET: Dataset = PILOT_DATASET;
const MAX_SAVED = 6;
const BUDGET_ERROR_ID = "budget-error";
const BUTTON =
  "inline-flex min-h-11 items-center rounded-md border px-4 font-semibold disabled:opacity-60";
const TH = "border-b border-line px-3 py-2 text-left font-semibold text-ink";
const TD = "border-b border-line px-3 py-2 align-top";

type Run = { readonly dataset: Dataset; readonly budget: number; readonly attempt: number };

export function RepairPlanner({
  defaultDataset = DEFAULT_DATASET,
}: {
  readonly defaultDataset?: Dataset;
}) {
  const [dataset, setDataset] = useState<Dataset>(defaultDataset);
  const [budgetText, setBudgetText] = useState(String(defaultBudget(defaultDataset)));
  const [budgetError, setBudgetError] = useState("");
  const [run, setRun] = useState<Run>({
    dataset: defaultDataset,
    budget: defaultBudget(defaultDataset),
    attempt: 0,
  });
  const [plan, setPlan] = useState<Plan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<readonly Plan[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPlan(run.dataset, run.budget, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setPlan(result);
        setIsLoading(false);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "The planning run failed.");
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [run]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const budget = parseBudget(budgetText);
    const problem = budgetProblem(dataset, budget);
    if (problem || budget === null) {
      setBudgetError(problem);
      // After the error renders, so screen readers announce it as the field's description.
      requestAnimationFrame(() => document.getElementById("budget")?.focus());
      return;
    }
    setBudgetError("");
    setError("");
    setIsLoading(true);
    setRun((previous) => ({ dataset, budget, attempt: previous.attempt + 1 }));
  }

  const isSaved =
    plan !== null &&
    saved.some(
      (item) =>
        item.dataset === plan.dataset &&
        item.budget === plan.budget &&
        item.snapshot_id === plan.snapshot_id,
    );

  return (
    <div className="space-y-8">
      <aside
        aria-labelledby="synthetic-heading"
        className="rounded-lg border border-warning bg-warning-soft p-4 text-ink"
      >
        {dataset === PILOT_DATASET ? (
          <>
            <h2 id="synthetic-heading" className="font-semibold">
              Real Fremont streets, unverified barriers
            </h2>
            <p className="mt-1">Modeled estimates. Budget is in repair units, not dollars.</p>
            {/* Full provenance stays one click away; the visible line keeps the key caveats. */}
            <details className="mt-2">
              <summary className="inline-flex min-h-6 cursor-pointer items-center font-semibold underline underline-offset-4">
                Data details
              </summary>
              <p className="mt-1">
                The network, homes, and destinations come from OpenStreetMap and the 2020 Census.
                The raised curbs are mapped in OpenStreetMap and nobody has checked them on site.
                Budget is in repair units, one per curb, not dollars. Results are modeled estimates,
                not inspections, compliance findings, or safe routes.
              </p>
            </details>
          </>
        ) : (
          <>
            <h2 id="synthetic-heading" className="font-semibold">
              Synthetic demonstration, not Fremont data
            </h2>
            <p className="mt-1">
              These networks, barriers, and costs are generated for demonstration. Costs are
              abstract cost units, not dollars. Results are modeled estimates from the AccessForge
              engine, not inspections, compliance findings, or safe routes.
            </p>
          </>
        )}
      </aside>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="grid gap-4 rounded-lg border border-line bg-surface p-5 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
      >
        <div>
          <label htmlFor="dataset" className="block font-medium text-ink">
            Network
          </label>
          <select
            id="dataset"
            className="mt-1 min-h-11 w-full rounded border border-control bg-surface p-2"
            value={dataset}
            aria-describedby="dataset-note"
            onChange={(event) => {
              const next = event.target.value as Dataset;
              setDataset(next);
              setBudgetText(String(defaultBudget(next)));
              setBudgetError("");
            }}
          >
            {DATASETS.map((key) => (
              <option key={key} value={key}>
                {DATASET_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="budget" className="block font-medium text-ink">
            Budget (cost units)
          </label>
          <input
            id="budget"
            inputMode="decimal"
            className="mt-1 min-h-11 w-full rounded border border-control bg-surface p-2"
            value={budgetText}
            aria-invalid={budgetError ? true : undefined}
            aria-describedby={budgetError ? BUDGET_ERROR_ID : undefined}
            onChange={(event) => setBudgetText(event.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className={`${BUTTON} justify-center border-accent bg-accent text-surface`}
        >
          {isLoading ? "Running…" : "Run plan"}
        </button>
        <p id="dataset-note" className="text-muted sm:col-span-3">
          {DATASET_NOTES[dataset]}
        </p>
        {budgetError ? (
          <p id={BUDGET_ERROR_ID} className="font-medium text-warning sm:col-span-3">
            {budgetError}
          </p>
        ) : null}
      </form>

      <div role="status" aria-live="polite">
        {isLoading ? (
          <p className="text-muted">Running the optimization engine…</p>
        ) : error ? null : plan ? (
          <p className="sr-only">
            Plan ready for {DATASET_LABELS[plan.dataset]} at budget {formatNumber(plan.budget)}.
          </p>
        ) : null}
      </div>
      {error && !isLoading ? (
        <p role="alert" className="rounded-lg border border-warning bg-warning-soft p-4 text-ink">
          {error}
          {plan ? " The results below are from the previous run." : ""}
        </p>
      ) : null}

      {plan ? (
        <>
          <PlanResults plan={plan} />

          <section aria-labelledby="save-heading">
            <h2 id="save-heading" className="af-h2">
              Compare and export
            </h2>
            <div className="mt-4 flex flex-wrap gap-3 print:hidden">
              <button
                type="button"
                disabled={isSaved || saved.length >= MAX_SAVED}
                className={`${BUTTON} border-line bg-surface text-ink`}
                onClick={() => setSaved((items) => [...items, plan])}
              >
                {isSaved ? "Scenario saved" : "Save scenario to compare"}
              </button>
              <a
                className={`${BUTTON} border-line bg-surface text-accent underline`}
                download={`accessforge-plan-${plan.dataset}-${plan.budget}.csv`}
                href={dataUri("text/csv", planCsv(plan))}
              >
                Download summary (CSV)
              </a>
              <a
                className={`${BUTTON} border-line bg-surface text-accent underline`}
                download={`accessforge-plan-${plan.dataset}-${plan.budget}.json`}
                href={dataUri(
                  "application/json",
                  JSON.stringify({ notice: exportNotice(plan), ...plan }, null, 2),
                )}
              >
                Download full result (JSON)
              </a>
              <button
                type="button"
                className={`${BUTTON} border-line bg-surface text-ink`}
                onClick={() => window.print()}
              >
                Print report
              </button>
            </div>
            {saved.length === 0 ? (
              <p className="mt-3 text-muted">
                No saved scenarios yet. Save this one, change the budget or network, and run again
                to compare them side by side.
              </p>
            ) : (
              <div
                role="region"
                aria-label="Saved scenarios, scrollable table"
                tabIndex={0}
                className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface"
              >
                <table className="w-full min-w-[40rem] border-collapse text-sm">
                  <caption className="sr-only">Saved scenarios, recommended plan for each</caption>
                  <thead>
                    <tr>
                      {[
                        "Network",
                        "Budget",
                        "Spent",
                        "Access before",
                        "Access after",
                        "Repairs",
                      ].map((heading) => (
                        <th key={heading} scope="col" className={TH}>
                          {heading}
                        </th>
                      ))}
                      <th scope="col" className={TH}>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {saved.map((item) => {
                      const best = recommended(item);
                      const name = `${DATASET_LABELS[item.dataset]} at budget ${formatNumber(item.budget)}`;
                      return (
                        <tr key={`${item.dataset}-${item.budget}-${item.snapshot_id ?? ""}`}>
                          <th scope="row" className={`${TD} text-left font-semibold text-ink`}>
                            {DATASET_LABELS[item.dataset]}
                          </th>
                          <td className={TD}>{formatNumber(item.budget)}</td>
                          <td className={TD}>{formatNumber(best.total_cost)}</td>
                          <td className={TD}>{formatNumber(item.accessibility_before)}</td>
                          <td className={TD}>
                            {formatNumber(best.accessibility_after)} (+{formatNumber(best.delta_a)})
                          </td>
                          <td className={TD}>
                            {repairNames(item.network, best.selected_repair_ids)}
                          </td>
                          <td className={TD}>
                            <button
                              type="button"
                              className="min-h-11 px-2 font-medium text-accent underline"
                              aria-label={`Remove ${name}`}
                              onClick={() =>
                                setSaved((items) => items.filter((other) => other !== item))
                              }
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <BudgetComparison current={plan} saved={saved} />
          </section>

          <section aria-labelledby="limits-heading">
            <h2 id="limits-heading" className="af-h2">
              What this model does not know
            </h2>
            <ul className="mt-3 max-w-prose list-disc space-y-1 pl-5 text-muted">
              <li>
                Every barrier here is treated as certainly present. Uncertain reports are not
                sampled in this demonstration.
              </li>
              <li>
                Each repair has one fixed cost. The only cost check is whether a repair is still
                chosen when all costs move by {Math.round(plan.cost_perturbation_fraction * 100)}%
                in either direction.
              </li>
              <li>
                “Best” means best for this simplified model. Exhaustive search only works for small
                networks; city-scale planning needs methods that are not built yet.
              </li>
              <li>
                Access counts weighted destinations within a fixed travel distance for{" "}
                {plan.network.profiles.length} modeled mobility profiles. It does not measure real
                trips. Engine version {plan.engine_version}.
              </li>
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
