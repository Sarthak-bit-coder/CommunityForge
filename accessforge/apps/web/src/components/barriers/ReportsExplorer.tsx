"use client";

import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { KineticTitle } from "@/components/ui/KineticTitle";
import { Notice } from "@/components/ui/Notice";
import { NO_FILTER, type Barrier, type BarrierFilter } from "@/lib/barriers";
import { findNavItem } from "@/lib/navigation";
import { fetchReport, fetchReports, PAGE_SIZE, reportBarrier } from "@/lib/reports-api";
import { SAMPLE_BARRIERS, SAMPLE_DATA_NOTICE } from "@/lib/sample-barriers";
import { BarrierExplorer } from "./BarrierExplorer";

const PAGE = findNavItem("/barriers");
const MAX_PAGE = 10_000;

export function ReportsExplorer() {
  const [demo, setDemo] = useState(false);
  const header = (
    <>
      <div>
        <h1 className="af-display text-2xl">
          <KineticTitle text={PAGE.label} />
        </h1>
        <p className="mt-1 text-sm text-muted">{PAGE.description}</p>
      </div>
      <label className="af-label">
        Data source
        <select
          className="af-select"
          value={demo ? "demo" : "reports"}
          onChange={(event) => setDemo(event.target.value === "demo")}
        >
          <option value="reports">Submitted reports</option>
          <option value="demo">Fictional demo data</option>
        </select>
      </label>
    </>
  );
  return demo ? (
    <BarrierExplorer
      barriers={SAMPLE_BARRIERS}
      header={
        <>
          {header}
          <Notice label="Sample data notice" tone="warning">
            Fictional sample data. {SAMPLE_DATA_NOTICE}
          </Notice>
        </>
      }
    />
  ) : (
    <LiveReports header={header} />
  );
}

type ReportsResult = { readonly barriers: readonly Barrier[]; readonly total: number };

export function LiveReports({
  initialFilter = NO_FILTER,
  review,
  header,
}: {
  readonly initialFilter?: BarrierFilter;
  /** Reviewer-only controls for the selected report; `reload` refreshes the queue. */
  readonly review?: (report: Barrier, reload: () => void) => ReactNode;
  /** Heading and controls shown above the reports notice. */
  readonly header?: ReactNode;
}) {
  const [filter, setFilter] = useState<BarrierFilter>(initialFilter);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<ReportsResult | null>(null);
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
    <BarrierExplorer
      barriers={result?.barriers ?? []}
      remote={{
        filter,
        onFilter: change,
        onSelect: select,
        detail,
        selectedId: selected,
        detailActions: detail && review ? review(detail, reload) : undefined,
      }}
      header={
        <>
          {header}
          <Notice label="About submitted reports">
            Real submissions, not fictional samples. Pending reports await verification; verified
            reports are not official inspections.
          </Notice>
          <ReportsStatus
            isRefreshing={refreshing}
            isLoading={!result && !error}
            hasStaleResult={!!(error && result)}
            isDetailLoading={detailLoading}
            error={error}
            detailError={detailError}
            onReload={reload}
          />
        </>
      }
      footer={
        <nav aria-label="Report pages" className="grid grid-cols-2 gap-2">
          <p role="status" className="col-span-2 text-center text-sm text-muted">
            Page {page}. {result ? `${result.total} reports match.` : "Results unavailable."}
          </p>
          <button
            type="button"
            className="af-button-secondary px-2 text-sm disabled:pointer-events-none disabled:bg-canvas disabled:text-muted"
            disabled={!result || page === 1}
            onClick={() => change(filter, page - 1)}
          >
            Previous page
          </button>
          <button
            type="button"
            className="af-button-secondary px-2 text-sm disabled:pointer-events-none disabled:bg-canvas disabled:text-muted"
            disabled={!result || page * PAGE_SIZE >= result.total || page >= MAX_PAGE}
            onClick={() => change(filter, page + 1)}
          >
            Next page
          </button>
        </nav>
      }
    />
  );
}

type ReportsStatusProps = {
  readonly isRefreshing: boolean;
  readonly isLoading: boolean;
  readonly hasStaleResult: boolean;
  readonly isDetailLoading: boolean;
  readonly error: string;
  readonly detailError: string;
  readonly onReload: () => void;
};

function ReportsStatus(props: ReportsStatusProps) {
  const { isRefreshing, isLoading, hasStaleResult, isDetailLoading, error, detailError } = props;
  return (
    <div className="space-y-2 text-sm">
      <button
        type="button"
        className="af-button-secondary w-full text-sm"
        disabled={isRefreshing}
        onClick={props.onReload}
      >
        Refresh reports
      </button>
      {isRefreshing ? <p role="status">Refreshing reports…</p> : null}
      {hasStaleResult ? (
        <p role="status">Showing previously loaded reports; statuses may be out of date.</p>
      ) : null}
      {isLoading ? <p role="status">Loading reports…</p> : null}
      {error ? (
        <ErrorNotice message={error} retryLabel="Retry reports" onRetry={props.onReload} />
      ) : null}
      {isDetailLoading ? <p role="status">Loading report details…</p> : null}
      {detailError ? (
        <ErrorNotice
          message={detailError}
          retryLabel="Retry report details"
          onRetry={props.onReload}
        />
      ) : null}
    </div>
  );
}

function ErrorNotice({
  message,
  retryLabel,
  onRetry,
}: {
  readonly message: string;
  readonly retryLabel: string;
  readonly onRetry: () => void;
}) {
  return (
    <div role="alert" className="rounded-lg border border-warning bg-warning-soft p-3 text-warning">
      <p className="font-semibold">{message}</p>
      <button type="button" className="mt-1 min-h-11 font-semibold underline" onClick={onRetry}>
        {retryLabel}
      </button>
    </div>
  );
}
