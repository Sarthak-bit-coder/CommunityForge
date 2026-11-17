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

// One filter and one selection drive both the map and the list, so they always show the same data.
export function BarrierExplorer({
  barriers,
  remote,
}: {
  readonly barriers: readonly Barrier[];
  readonly remote?: {
    readonly filter: BarrierFilter;
    readonly onFilter: (filter: BarrierFilter) => void;
    readonly onSelect: (id: string) => void;
    readonly detail: Barrier | null;
    readonly selectedId: string | null;
    readonly detailActions?: ReactNode;
  };
}) {
  const [localFilter, setFilter] = useState<BarrierFilter>(NO_FILTER);
  const filter = remote?.filter ?? localFilter;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Stable identity while the filter is unchanged, so the map keeps its markers (and focus).
  const visible = useMemo(() => filterBarriers(barriers, filter), [barriers, filter]);
  const selected =
    visible.find((barrier) => barrier.id === (remote ? remote.selectedId : selectedId)) ?? null;

  function select(id: string) {
    setSelectedId(id);
    remote?.onSelect(id);
  }
  return (
    <div className="space-y-8">
      <BarrierFilters filter={filter} onChange={remote?.onFilter ?? setFilter} />
      <p role="status" className="font-medium text-ink">
        Showing {visible.length} of {barriers.length}{" "}
        {remote ? "reports on this page." : "sample barriers."}
      </p>
      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="barrier-map-heading" className="lg:col-span-2">
          <h2 id="barrier-map-heading" className="mb-2 text-lg font-semibold text-ink">
            Map
          </h2>
          <BarrierMap barriers={visible} selectedId={selected?.id ?? null} onSelect={select} />
          <MapLegend />
        </section>
        <BarrierDetails
          barrier={
            remote
              ? selected && remote.detail?.id === selected.id
                ? remote.detail
                : null
              : selected
          }
        >
          {remote?.detailActions}
        </BarrierDetails>
      </div>
      <section aria-labelledby="barrier-list-heading">
        <h2 id="barrier-list-heading" className="mb-3 text-lg font-semibold text-ink">
          List of barriers
        </h2>
        <BarrierList barriers={visible} selectedId={selected?.id ?? null} onSelect={select} />
      </section>
    </div>
  );
}

function MapLegend() {
  return (
    <div className="mt-3 text-sm text-muted">
      <p>
        Use Tab to reach each marker and Enter to select it. With the map focused, arrow keys pan
        and + or − zoom.
      </p>
      <h3 className="mt-2 font-semibold text-ink">Marker symbols</h3>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {[...VERIFICATION_STATES, "unknown" as const].map((state) => (
          <li key={state}>
            <span aria-hidden="true" className="font-bold text-ink">
              {STATE_DISPLAY[state].symbol}
            </span>{" "}
            {STATE_DISPLAY[state].label}: {STATE_DISPLAY[state].explanation}
          </li>
        ))}
      </ul>
    </div>
  );
}
