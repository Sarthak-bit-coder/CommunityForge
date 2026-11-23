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
    return (
      <div className="rounded-xl border border-dashed border-control px-4 py-8 text-center">
        <p className="font-semibold text-ink">No barriers match these filters.</p>
        <p className="mt-1 text-sm text-muted">Try another type or status.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {barriers.map((barrier, index) => (
        <BarrierRow
          key={barrier.id}
          index={index}
          barrier={barrier}
          isSelected={barrier.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

// Rows rise in one after another; the cap keeps a long list from making anyone wait.
const STAGGER_MS = 40;
const STAGGER_MAX_ROWS = 8;

function BarrierRow({
  index,
  barrier,
  isSelected,
  onSelect,
}: {
  readonly index: number;
  readonly barrier: Barrier;
  readonly isSelected: boolean;
  readonly onSelect: (id: string) => void;
}) {
  const state = verificationDisplay(barrier.state);
  return (
    <li
      style={{ animationDelay: `${Math.min(index, STAGGER_MAX_ROWS) * STAGGER_MS}ms` }}
      className={`af-rise relative rounded-xl border bg-surface p-3 transition-[border-color,box-shadow] duration-150 ${
        isSelected
          ? "border-accent shadow-card ring-2 ring-accent"
          : "border-line hover:border-control hover:shadow-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold break-words text-ink">{barrier.name}</h3>
        <Badge label={`${state.symbol} ${state.label}`} tone={state.tone} />
      </div>
      <p className="mt-0.5 text-sm text-muted">
        {BARRIER_TYPE_LABELS[barrier.type]} · {severityLabel(barrier.severity)}
      </p>
      <p className="mt-2 flex flex-wrap gap-1.5">
        <Badge label={SOURCE_LABELS[barrier.source]} />
        <Badge label={barrier.dataKind === "report" ? "Submitted report" : "Fictional sample"} />
      </p>
      {barrier.dataKind === "report" ? <ReportFacts barrier={barrier} /> : null}
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={() => onSelect(barrier.id)}
        className="mt-2 min-h-11 rounded-lg px-3 text-sm font-semibold text-accent hover:bg-accent-soft"
      >
        View details <span className="sr-only">for {barrier.name}</span>
      </button>
    </li>
  );
}

// Reports keep their full text in the list, so the list stays equivalent to the map and details.
function ReportFacts({ barrier }: { readonly barrier: Barrier }) {
  return (
    <div className="mt-2 space-y-1 text-sm break-words text-ink">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3">
        <dt className="text-muted">Location</dt>
        <dd>{barrier.locationDescription}</dd>
        <dt className="text-muted">Submitted</dt>
        <dd>
          <time dateTime={barrier.reportedOn}>{barrier.reportedOn}</time>
        </dd>
      </dl>
      <p className="line-clamp-2 whitespace-pre-wrap">{barrier.description}</p>
      <details>
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-accent">
          Evidence provenance
        </summary>
        <EvidenceProvenanceList evidence={barrier.evidence ?? []} />
      </details>
    </div>
  );
}
