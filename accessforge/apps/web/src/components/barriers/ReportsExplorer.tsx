"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { NO_FILTER, type Barrier, type BarrierFilter } from "@/lib/barriers";
import { fetchReport, fetchReports, PAGE_SIZE, reportBarrier } from "@/lib/reports-api";
import { SAMPLE_BARRIERS, SAMPLE_DATA_NOTICE } from "@/lib/sample-barriers";
import { BarrierExplorer } from "./BarrierExplorer";

export function ReportsExplorer() {
  const [demo, setDemo] = useState(false);
  return (
    <div className="space-y-6">
      <label className="block font-medium text-ink">
        Data source
        <select
          className="ml-3 min-h-11 rounded border border-line p-2"
          value={demo ? "demo" : "reports"}
          onChange={(event) => setDemo(event.target.value === "demo")}
        >
          <option value="reports">Submitted reports</option>
          <option value="demo">Fictional demo data</option>
        </select>
      </label>
      {demo ? (
        <>
          <aside aria-label="Sample data notice" className="rounded border border-warning p-4">
            Fictional sample data. {SAMPLE_DATA_NOTICE}
          </aside>
          <BarrierExplorer barriers={SAMPLE_BARRIERS} />
        </>
      ) : (
        <LiveReports />
      )}
    </div>
  );
}

export function LiveReports({
  initialFilter = NO_FILTER,
}: {
  readonly initialFilter?: BarrierFilter;
}) {
  const [filter, setFilter] = useState<BarrierFilter>(initialFilter);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ barriers: readonly Barrier[]; total: number } | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Barrier | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const receiveReports = useEffectEvent((barriers: readonly Barrier[], total: number) => {
    setResult({ barriers, total });
    setRefreshing(false);
    if (selected && !barriers.some((barrier) => barrier.id === selected)) {
      setSelected(null);
      setDetail(null);
      setDetailLoading(false);
    }
  });
  useEffect(() => {
    const controller = new AbortController();
    fetchReports(filter, page, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted)
          receiveReports(response.data.map(reportBarrier), response.meta.total);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) {
          setRefreshing(false);
          setError(failure instanceof Error ? failure.message : "Could not load reports.");
        }
      });
    return () => controller.abort();
  }, [filter, page, retry]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    fetchReport(selected, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) {
          setDetail(reportBarrier(response.data));
          setDetailLoading(false);
        }
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) {
          setDetailError(failure instanceof Error ? failure.message : "Could not load report.");
          setDetailLoading(false);
        }
      });
    return () => controller.abort();
  }, [selected, retry]);
  function change(filter: BarrierFilter, nextPage = 1) {
    setFilter(filter);
    setPage(nextPage);
    setResult(null);
    setError("");
    setSelected(null);
    setDetail(null);
    setDetailLoading(false);
    setDetailError("");
  }
  function select(id: string) {
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    setSelected(id);
    if (id === selected) setRetry((value) => value + 1);
  }
  function reload() {
    setError("");
    setDetailError("");
    setRefreshing(true);
    setDetail(null);
    if (selected) setDetailLoading(true);
    setRetry((value) => value + 1);
  }
  const refreshOnFocus = useEffectEvent(() => reload());
  useEffect(() => {
    const refresh = () => refreshOnFocus();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  return (
    <div className="space-y-4">
      <p className="text-ink">
        Submitted reports are real submissions, not fictional samples. Pending reports await
        verification; verified reports are not official inspections. The map background still uses
        fictional streets; use coordinates and the equivalent list.
      </p>
      <button
        type="button"
        className="min-h-11 rounded-md border border-accent px-4 text-accent"
        disabled={refreshing}
        onClick={reload}
      >
        Refresh reports
      </button>
      {refreshing ? <p role="status">Refreshing reports…</p> : null}
      {error && result ? (
        <p role="status">Showing previously loaded reports; statuses may be out of date.</p>
      ) : null}
      {!result && !error ? <p role="status">Loading reports…</p> : null}
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button type="button" className="min-h-11 underline" onClick={reload}>
            Retry reports
          </button>
        </div>
      ) : null}
      {detailLoading ? <p role="status">Loading report details…</p> : null}
      {detailError ? (
        <div role="alert">
          <p>{detailError}</p>
          <button type="button" className="min-h-11 underline" onClick={reload}>
            Retry report details
          </button>
        </div>
      ) : null}
      <BarrierExplorer
        barriers={result?.barriers ?? []}
        remote={{ filter, onFilter: change, onSelect: select, detail, selectedId: selected }}
      />
      <nav aria-label="Report pages" className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          className="min-h-11 underline disabled:opacity-50"
          disabled={!result || page === 1}
          onClick={() => change(filter, page - 1)}
        >
          Previous page
        </button>
        <p role="status">
          Page {page}. {result ? `${result.total} reports match.` : "Results unavailable."}
        </p>
        <button
          type="button"
          className="min-h-11 underline disabled:opacity-50"
          disabled={!result || page * PAGE_SIZE >= result.total || page >= 10000}
          onClick={() => change(filter, page + 1)}
        >
          Next page
        </button>
      </nav>
    </div>
  );
}
