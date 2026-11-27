"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  NO_FILTER,
  STATE_DISPLAY,
  VERIFICATION_STATES,
  filterBarriers,
  type Barrier,
  type BarrierFilter,
} from "@/lib/barriers";
import { BarrierDetails } from "./BarrierDetails";
import { BarrierFilters } from "./BarrierFilters";
import { BarrierList } from "./BarrierList";
import { BarrierMap } from "./BarrierMap";

const FILTERS_ID = "barrier-filters";

type Remote = {
  readonly filter: BarrierFilter;
  readonly onFilter: (filter: BarrierFilter) => void;
  readonly onSelect: (id: string) => void;
  readonly detail: Barrier | null;
  readonly selectedId: string | null;
  readonly detailActions?: ReactNode;
};

// One filter and one selection drive both the map and the list, so they always show the same data.
// Map-first workspace: on wide screens the header and results sit left of a full-height map;
// on small screens the map comes right after the header, then filters and the list.
export function BarrierExplorer({
  barriers,
  remote,
  header,
  footer,
}: {
  readonly barriers: readonly Barrier[];
  readonly remote?: Remote;
  /** Page heading, data source, and notices, shown above the results. */
  readonly header?: ReactNode;
  /** Pagination or other controls under the results. */
  readonly footer?: ReactNode;
}) {
  const [localFilter, setFilter] = useState<BarrierFilter>(NO_FILTER);
  const filter = remote?.filter ?? localFilter;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Stable identity while the filter is unchanged, so the map keeps its markers (and focus).
  const visible = useMemo(() => filterBarriers(barriers, filter), [barriers, filter]);
  const selected =
    visible.find((barrier) => barrier.id === (remote ? remote.selectedId : selectedId)) ?? null;
  const remoteDetail = selected && remote?.detail?.id === selected.id ? remote.detail : null;

  function select(id: string) {
    setSelectedId(id);
    remote?.onSelect(id);
  }
  return (
    <div
      data-layout="wide"
      className="grid min-w-0 grid-cols-1 gap-4 lg:min-h-[calc(100dvh-3rem)] lg:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]"
    >
      {header ? <div className="af-panel space-y-4 p-5 lg:col-start-1">{header}</div> : null}
      <section
        aria-labelledby="barrier-map-heading"
        className="relative flex min-h-0 flex-col gap-3 lg:col-start-2 lg:row-span-2 lg:row-start-1"
      >
        <h2 id="barrier-map-heading" className="sr-only">
          Map
        </h2>
        <BarrierMap
          barriers={visible}
          selectedId={selected?.id ?? null}
          onSelect={select}
          className="h-[60svh] min-h-80 lg:h-auto lg:min-h-[24rem] lg:flex-1"
        >
          <MapLegend />
        </BarrierMap>
        <BarrierDetails
          barrier={remote ? remoteDetail : selected}
          className="lg:max-h-[45%] xl:absolute xl:top-3 xl:right-3 xl:max-h-[calc(100%-4rem)] xl:w-[22rem] xl:shadow-lift"
        >
          {remote?.detailActions}
        </BarrierDetails>
      </section>
      <ResultsPanel
        summary={`Showing ${visible.length} of ${barriers.length} ${remote ? "reports on this page." : "sample barriers."}`}
        filters={<BarrierFilters filter={filter} onChange={remote?.onFilter ?? setFilter} />}
        footer={footer}
      >
        <BarrierList barriers={visible} selectedId={selected?.id ?? null} onSelect={select} />
      </ResultsPanel>
    </div>
  );
}

function ResultsPanel({
  summary,
  filters,
  footer,
  children,
}: {
  readonly summary: string;
  readonly filters: ReactNode;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}) {
  // On small screens people can fold the filters away to bring the results closer.
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  return (
    <div className="af-panel flex min-h-0 flex-col lg:col-start-1 lg:row-start-2">
      <div className="space-y-3 border-b border-line p-4">
        <div className="flex items-center justify-between gap-3">
          <p role="status" className="text-sm font-semibold text-ink">
            {summary}
          </p>
          <button
            type="button"
            className="af-button-secondary px-3 text-sm lg:hidden"
            aria-expanded={isFiltersOpen}
            aria-controls={FILTERS_ID}
            onClick={() => setIsFiltersOpen((open) => !open)}
          >
            Filters
          </button>
        </div>
        <div id={FILTERS_ID} className={`${isFiltersOpen ? "block" : "hidden"} lg:block`}>
          {filters}
        </div>
      </div>
      {/* Scrolls on its own, so it takes focus for keyboard scrolling even when empty. */}
      <section
        aria-labelledby="barrier-list-heading"
        tabIndex={0}
        className="max-h-[70svh] flex-auto overflow-y-auto p-3"
      >
        <h2
          id="barrier-list-heading"
          className="px-1 pb-2 text-xs font-semibold tracking-wide text-muted uppercase"
        >
          List of barriers
        </h2>
        {children}
      </section>
      {footer ? <div className="border-t border-line p-3">{footer}</div> : null}
    </div>
  );
}

// Status is encoded by symbol and text as well as colour.
function MapLegend() {
  return (
    <details className="af-map-legend absolute top-3 left-16 max-w-[18rem] @xl:top-auto @xl:bottom-3 @xl:left-3 rounded-xl border border-line bg-surface/95 text-sm shadow-card backdrop-blur">
      <summary className="flex min-h-11 cursor-pointer items-center px-3 font-semibold text-ink">
        Legend and keyboard help
      </summary>
      <div
        tabIndex={0}
        aria-label="Legend"
        role="group"
        className="max-h-64 overflow-y-auto border-t border-line px-3 pt-2 pb-3 text-muted"
      >
        <ul className="space-y-1.5">
          {[...VERIFICATION_STATES, "unknown" as const].map((state) => (
            <li key={state} className="flex items-center gap-2">
              <LegendSymbol state={state} />
              <span>
                <span className="font-semibold text-ink">{STATE_DISPLAY[state].label}.</span>{" "}
                {STATE_DISPLAY[state].explanation}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2">
          Tab reaches each marker; Enter selects it. With the map focused, arrow keys pan and + or −
          zoom.
        </p>
      </div>
    </details>
  );
}

const LEGEND_TONE_CLASSES = {
  success: "bg-success text-surface",
  warning: "bg-warning text-surface",
  info: "bg-accent text-surface",
  neutral: "bg-surface text-ink ring-1 ring-control",
  modeled: "bg-modeled text-surface",
} as const;

function LegendSymbol({ state }: { readonly state: keyof typeof STATE_DISPLAY }) {
  const display = STATE_DISPLAY[state];
  return (
    <span
      aria-hidden="true"
      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${LEGEND_TONE_CLASSES[display.tone]}`}
    >
      {display.symbol}
    </span>
  );
}
