import { EvidenceProvenanceList } from "./EvidenceProvenanceList";
import { Badge } from "@/components/ui/Badge";
import {
  BARRIER_TYPE_LABELS,
  SOURCE_LABELS,
  verificationDisplay,
  severityLabel,
  type Barrier,
} from "@/lib/barriers";

type BarrierListProps = {
  readonly barriers: readonly Barrier[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
};

export function BarrierList({ barriers, selectedId, onSelect }: BarrierListProps) {
  if (barriers.length === 0) {
    return <p className="text-muted">No barriers match these filters.</p>;
  }
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {barriers.map((barrier) => {
        const isSelected = barrier.id === selectedId;
        const state = verificationDisplay(barrier.state);
        return (
          <li
            key={barrier.id}
            className={`rounded-lg border bg-surface p-4 ${isSelected ? "border-accent ring-2 ring-accent" : "border-line"}`}
          >
            <h3 className="break-words font-semibold text-ink">{barrier.name}</h3>
            <p className="mt-1 text-muted">
              {BARRIER_TYPE_LABELS[barrier.type]} · {severityLabel(barrier.severity)}
            </p>
            <p className="mt-2 flex flex-wrap gap-2">
              <Badge label={`${state.symbol} ${state.label}`} tone={state.tone} />
              <Badge label={SOURCE_LABELS[barrier.source]} />
              <Badge
                label={barrier.dataKind === "report" ? "Submitted report" : "Fictional sample"}
              />
            </p>
            {barrier.dataKind === "report" ? (
              <div className="mt-3 space-y-2 break-words text-ink">
                <dl>
                  <dt className="font-semibold">Location (latitude, longitude)</dt>
                  <dd>{barrier.locationDescription}</dd>
                  <dt className="font-semibold">Submitted</dt>
                  <dd>
                    <time dateTime={barrier.reportedOn}>{barrier.reportedOn}</time>
                  </dd>
                </dl>
                <p className="whitespace-pre-wrap">{barrier.description}</p>
                <EvidenceProvenanceList evidence={barrier.evidence ?? []} />
              </div>
            ) : null}
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(barrier.id)}
              className="mt-3 min-h-11 rounded-md border border-accent px-4 font-medium text-accent hover:bg-accent-soft"
            >
              View details <span className="sr-only">for {barrier.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
