"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  DATASETS,
  DATASET_LABELS,
  DATASET_NOTES,
  EXPORT_NOTICE,
  MAX_BUDGET,
  dataUri,
  fetchPlan,
  formatNumber,
  parseBudget,
  planCsv,
  recommended,
  type Dataset,
  type Plan,
} from "@/lib/planning-api";
import { PlanResults } from "./PlanResults";

const DEFAULT_DATASET: Dataset = "corridor";
const DEFAULT_BUDGET = 20; // Enough for both corridor repairs, so the first run shows a pair.
const MAX_SAVED = 6;
const BUDGET_ERROR_ID = "budget-error";
const BUTTON =
  "inline-flex min-h-11 items-center rounded-md border px-4 font-semibold disabled:opacity-60";
const TH = "border-b border-line px-3 py-2 text-left font-semibold text-ink";
const TD = "border-b border-line px-3 py-2 align-top";

type Run = { readonly dataset: Dataset; readonly budget: number; readonly attempt: number };

export function RepairPlanner() {
  const [dataset, setDataset] = useState<Dataset>(DEFAULT_DATASET);
  const [budgetText, setBudgetText] = useState(String(DEFAULT_BUDGET));
  const [budgetError, setBudgetError] = useState("");
  const [run, setRun] = useState<Run>({
    dataset: DEFAULT_DATASET,
    budget: DEFAULT_BUDGET,
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
    if (budget === null) {
      setBudgetError(`Enter a budget between 0 and ${formatNumber(MAX_BUDGET)}.`);
      return;
    }
    setBudgetError("");
    setError("");
    setIsLoading(true);
    setRun((previous) => ({ dataset, budget, attempt: previous.attempt + 1 }));
  }

  const isSaved =
    plan !== null &&
    saved.some((item) => item.dataset === plan.dataset && item.budget === plan.budget);

  return (
    <div className="space-y-8">
      <aside
        aria-labelledby="synthetic-heading"
        className="rounded-lg border border-warning bg-warning-soft p-4 text-ink"
      >
        <h2 id="synthetic-heading" className="font-semibold">
          Synthetic demonstration, not Fremont data
        </h2>
        <p className="mt-1">
          These networks, barriers, and costs are generated for demonstration. Costs are abstract
          cost units, not dollars. Results are modeled estimates from the AccessForge engine, not
          inspections, compliance findings, or safe routes.
        </p>
      </aside>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="grid gap-4 rounded-lg border border-line bg-surface p-5 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
      >
        <div>
          <label htmlFor="dataset" className="block font-medium text-ink">
            Demonstration network
          </label>
          <select
            id="dataset"
            className="mt-1 min-h-11 w-full rounded border border-line bg-surface p-2"
            value={dataset}
            aria-describedby="dataset-note"
            onChange={(event) => setDataset(event.target.value as Dataset)}
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
            className="mt-1 min-h-11 w-full rounded border border-line bg-surface p-2"
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
            <h2 id="save-heading" className="text-xl font-semibold text-ink">
              Compare and export
            </h2>
            <div className="mt-4 flex flex-wrap gap-3">
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
                  JSON.stringify({ notice: EXPORT_NOTICE, ...plan }, null, 2),
                )}
              >
                Download full result (JSON)
              </a>
            </div>
            {saved.length === 0 ? (
              <p className="mt-3 text-muted">
                No saved scenarios yet. Save this one, change the budget or network, and run again
                to compare them side by side.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface">
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
                        <tr key={`${item.dataset}-${item.budget}`}>
                          <th scope="row" className={`${TD} text-left font-semibold text-ink`}>
                            {DATASET_LABELS[item.dataset]}
                          </th>
                          <td className={TD}>{formatNumber(item.budget)}</td>
                          <td className={TD}>{formatNumber(best.total_cost)}</td>
                          <td className={TD}>{formatNumber(item.accessibility_before)}</td>
                          <td className={TD}>
                            {formatNumber(best.accessibility_after)} (+{formatNumber(best.delta_a)})
                          </td>
                          <td className={TD}>{best.selected_repair_ids.join(", ") || "None"}</td>
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
          </section>

          <section aria-labelledby="limits-heading">
            <h2 id="limits-heading" className="text-xl font-semibold text-ink">
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
