"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  DATASETS,
  DATASET_LABELS,
  PILOT_DATASET,
  budgetProblem,
  defaultBudget,
  parseBudget,
  type Dataset,
} from "@/lib/planning-api";
import {
  STATUS_WORDS,
  StaleSnapshotError,
  fetchLocations,
  fetchRouteAnalysis,
  profileLabel,
  type RouteAnalysis as RouteAnalysisData,
  type RouteQuery,
} from "@/lib/routing-api";
import type { Network } from "@/lib/planning-api";
import { RouteResults } from "./RouteResults";

const DEFAULT_DATASET: Dataset = PILOT_DATASET;
const BUDGET_ERROR_ID = "route-budget-error";
const BUTTON =
  "inline-flex min-h-11 items-center rounded-md border px-4 font-semibold disabled:opacity-60";

type Selection = {
  readonly origin: string;
  readonly destination: string;
  readonly profile: string;
};
type Run = { readonly query: RouteQuery; readonly attempt: number };

function firstId(items: readonly { readonly id: string }[]): string {
  return items[0]?.id ?? "";
}

function defaultsFor(network: Network): Selection {
  return {
    origin: firstId(network.origins),
    destination: firstId(network.destinations),
    profile: firstId(network.profiles),
  };
}

export function RouteAnalysis({
  defaultDataset = DEFAULT_DATASET,
}: {
  readonly defaultDataset?: Dataset;
}) {
  const [dataset, setDataset] = useState<Dataset>(defaultDataset);
  const [network, setNetwork] = useState<Network | null>(null);
  const [selection, setSelection] = useState<Selection>({
    origin: "",
    destination: "",
    profile: "",
  });
  const [budgetText, setBudgetText] = useState(String(defaultBudget(defaultDataset)));
  const [budgetError, setBudgetError] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [analysis, setAnalysis] = useState<RouteAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectionError, setSelectionError] = useState("");
  // Snapshot the user last saw for this network; sent so a changed network is refused, not mixed.
  const snapshotRef = useRef<string | null>(null);
  const budgetRef = useRef<HTMLInputElement>(null);
  const selectionErrorRef = useRef<HTMLParagraphElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const hasChoices = Boolean(
    network && network.origins.length && network.destinations.length && network.profiles.length,
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchLocations(dataset, controller.signal)
      .then((loaded) => {
        if (controller.signal.aborted) return;
        setNetwork(loaded);
        setSelection(defaultsFor(loaded));
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "The network could not be loaded.");
      });
    return () => controller.abort();
  }, [dataset]);

  useEffect(() => {
    if (!run) return;
    const controller = new AbortController();
    fetchRouteAnalysis(run.query, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        snapshotRef.current = result.snapshot_id;
        setAnalysis(result);
        setIsLoading(false);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        if (reason instanceof StaleSnapshotError) snapshotRef.current = null;
        setError(reason instanceof Error ? reason.message : "The route check failed.");
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [run]);

  /** Any change to the inputs makes the shown result and any pending request stale. */
  function clearResults() {
    setAnalysis(null);
    setRun(null);
    setIsLoading(false);
    setError("");
  }

  // Focus moves to the new alert or result so screen-reader and keyboard users land on it.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (selectionError) selectionErrorRef.current?.focus();
  }, [selectionError]);

  useEffect(() => {
    if (analysis && !isLoading) resultsRef.current?.focus();
  }, [analysis, isLoading]);

  function handleDatasetChange(next: Dataset) {
    setDataset(next);
    setBudgetText(String(defaultBudget(next)));
    setBudgetError("");
    setNetwork(null);
    snapshotRef.current = null;
    clearResults();
  }

  function updateSelection(patch: Partial<Selection>) {
    setSelection((prev) => ({ ...prev, ...patch }));
    clearResults();
  }

  function handleBudgetChange(value: string) {
    setBudgetText(value);
    clearResults();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const budget = parseBudget(budgetText);
    const problem = budgetProblem(dataset, budget);
    if (problem || budget === null) {
      setBudgetError(problem);
      budgetRef.current?.focus();
      return;
    }
    if (!selection.origin || !selection.destination || !selection.profile) {
      setSelectionError("Choose a start, an end and a profile from this network.");
      return;
    }
    setBudgetError("");
    setSelectionError("");
    setError("");
    setAnalysis(null);
    setIsLoading(true);
    setRun((previous) => ({
      query: { dataset, ...selection, budget, snapshotId: snapshotRef.current ?? undefined },
      attempt: (previous?.attempt ?? 0) + 1,
    }));
  }

  return (
    <div className="space-y-8">
      <aside
        aria-labelledby="route-synthetic-heading"
        className="rounded-lg border border-warning bg-warning-soft p-4 text-ink"
      >
        <h2 id="route-synthetic-heading" className="font-semibold">
          {dataset === PILOT_DATASET
            ? "Real Fremont streets, unverified barriers"
            : "Synthetic demonstration, not Fremont data"}
        </h2>
        <p className="mt-1">Modeled path. Not checked on site and not a safe route.</p>
        {/* Full provenance stays one click away; the visible line keeps the key caveats. */}
        <details className="mt-2">
          <summary className="inline-flex min-h-6 cursor-pointer items-center font-semibold underline underline-offset-4">
            Data details
          </summary>
          <p className="mt-1">
            {dataset === PILOT_DATASET
              ? "Streets and destinations come from OpenStreetMap, homes from the 2020 Census. The raised curbs are mapped in OpenStreetMap and not checked on site."
              : "Streets, barriers and destinations here are generated."}{" "}
            A route is a modeled path over this network. It is not checked on site and is not a
            safe-route determination.
          </p>
        </details>
      </aside>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="grid gap-4 rounded-lg border border-line bg-surface p-5 sm:grid-cols-2"
      >
        <div>
          <label htmlFor="route-dataset" className="block font-medium text-ink">
            Network
          </label>
          <select
            id="route-dataset"
            className="mt-1 min-h-11 w-full rounded border border-control bg-surface p-2"
            value={dataset}
            onChange={(event) => handleDatasetChange(event.target.value as Dataset)}
          >
            {DATASETS.map((key) => (
              <option key={key} value={key}>
                {DATASET_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="route-profile" className="block font-medium text-ink">
            Traveler
          </label>
          <select
            id="route-profile"
            className="mt-1 min-h-11 w-full rounded border border-control bg-surface p-2"
            value={selection.profile}
            disabled={!network}
            onChange={(event) => updateSelection({ profile: event.target.value })}
          >
            {(network?.profiles ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {profileLabel(item.id)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="route-origin" className="block font-medium text-ink">
            Start
          </label>
          <select
            id="route-origin"
            className="mt-1 min-h-11 w-full rounded border border-control bg-surface p-2"
            value={selection.origin}
            disabled={!network}
            onChange={(event) => updateSelection({ origin: event.target.value })}
          >
            {(network?.origins ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.id} ({item.group})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="route-destination" className="block font-medium text-ink">
            End
          </label>
          <select
            id="route-destination"
            className="mt-1 min-h-11 w-full rounded border border-control bg-surface p-2"
            value={selection.destination}
            disabled={!network}
            onChange={(event) => updateSelection({ destination: event.target.value })}
          >
            {(network?.destinations ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name ? `${item.name} (${item.category})` : `${item.category} ${item.id}`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="route-budget" className="block font-medium text-ink">
            Repair budget (cost units)
          </label>
          <input
            id="route-budget"
            inputMode="decimal"
            className="mt-1 min-h-11 w-full rounded border border-control bg-surface p-2"
            value={budgetText}
            ref={budgetRef}
            aria-invalid={budgetError ? true : undefined}
            aria-describedby={budgetError ? BUDGET_ERROR_ID : undefined}
            onChange={(event) => handleBudgetChange(event.target.value)}
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isLoading || !hasChoices}
            className={`${BUTTON} w-full justify-center border-accent bg-accent text-surface`}
          >
            {isLoading ? "Checking…" : "Check route"}
          </button>
        </div>
        {budgetError ? (
          <p id={BUDGET_ERROR_ID} role="alert" className="font-medium text-warning sm:col-span-2">
            {budgetError}
          </p>
        ) : null}
        {selectionError ? (
          <p
            ref={selectionErrorRef}
            role="alert"
            tabIndex={-1}
            className="font-medium text-warning sm:col-span-2"
          >
            {selectionError}
          </p>
        ) : null}
      </form>

      <div role="status" aria-live="polite">
        {isLoading ? <p className="text-muted">Checking the modeled route…</p> : null}
        {analysis && !isLoading ? (
          <p>
            Route check complete. Current network: {STATUS_WORDS[analysis.current.status]}.
            Simulation with recommended repairs: {STATUS_WORDS[analysis.after_repairs.status]}.
          </p>
        ) : null}
        {network && !hasChoices ? (
          <p className="font-medium text-warning">
            This demonstration network has no starts, ends or profiles to choose from.
          </p>
        ) : null}
      </div>

      {error ? (
        <p ref={errorRef} role="alert" tabIndex={-1} className="font-medium text-warning">
          {error}
        </p>
      ) : null}

      {analysis && !isLoading ? (
        <div ref={resultsRef} tabIndex={-1}>
          <RouteResults analysis={analysis} />
        </div>
      ) : null}
    </div>
  );
}
