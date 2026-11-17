import type { ReactNode } from "react";
import { EvidenceProvenanceList } from "./EvidenceProvenanceList";
import { Badge } from "@/components/ui/Badge";
import {
  BARRIER_TYPE_LABELS,
  SOURCE_LABELS,
  verificationDisplay,
  severityLabel,
  type Barrier,
} from "@/lib/barriers";

const HEADING_ID = "barrier-details-heading";

export function BarrierDetails({
  barrier,
  children,
}: {
  readonly barrier: Barrier | null;
  /** Extra controls for the selected barrier, such as reviewer decisions. */
  readonly children?: ReactNode;
}) {
  return (
    <section
      aria-labelledby={HEADING_ID}
      aria-live="polite"
      className="rounded-lg border border-line bg-surface p-5"
    >
      <h2 id={HEADING_ID} className="break-words text-lg font-semibold text-ink">
        {barrier ? barrier.name : "Barrier details"}
      </h2>
      {barrier ? (
        <>
          <BarrierFacts barrier={barrier} />
          {children}
        </>
      ) : (
        <p className="mt-2 text-muted">
          Select a barrier on the map or in the list to see its details.
        </p>
      )}
    </section>
  );
}

function BarrierFacts({ barrier }: { readonly barrier: Barrier }) {
  const state = verificationDisplay(barrier.state);
  const facts: readonly (readonly [string, string])[] = [
    ["Type", BARRIER_TYPE_LABELS[barrier.type]],
    ["Severity", severityLabel(barrier.severity)],
    ["Source", SOURCE_LABELS[barrier.source]],
    ["Location", barrier.locationDescription],
    ["Reported", barrier.reportedOn],
  ];
  return (
    <>
      <p className="mt-2 flex flex-wrap gap-2">
        <Badge
          label={
            barrier.dataKind === "report"
              ? "Submitted report · not an official inspection"
              : "Fictional sample"
          }
          tone="warning"
        />
        <Badge label={`${state.symbol} ${state.label}`} tone={state.tone} />
      </p>
      <p className="mt-2 text-sm text-muted">{state.explanation}</p>
      <dl className="mt-3 space-y-2">
        {facts.map(([term, value]) => (
          <div key={term}>
            <dt className="text-sm font-semibold text-muted">{term}</dt>
            <dd className="text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 whitespace-pre-wrap break-words text-ink">{barrier.description}</p>
      {barrier.dataKind === "report" ? (
        <EvidenceProvenanceList evidence={barrier.evidence ?? []} />
      ) : null}
    </>
  );
}
