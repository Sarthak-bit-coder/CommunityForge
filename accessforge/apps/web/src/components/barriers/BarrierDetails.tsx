"use client";

import { AnimatePresence, m, useIsPresent } from "motion/react";
import { useState, type ReactNode } from "react";
import { EvidenceProvenanceList } from "./EvidenceProvenanceList";
import { BellButton } from "@/components/ui/BellButton";
import { isWatched, setWatched } from "@/lib/watched-barriers";
import {
  MOTION_DURATION_S,
  MOTION_EASE_ENTER,
  MOTION_EXIT_TRANSITION,
} from "@/components/motion/motion-tokens";
import { Badge } from "@/components/ui/Badge";
import {
  BARRIER_TYPE_LABELS,
  SOURCE_LABELS,
  verificationDisplay,
  severityLabel,
  type Barrier,
} from "@/lib/barriers";

const HEADING_ID = "barrier-details-heading";
const SLIDE_PX = 12;

export function BarrierDetails({
  barrier,
  children,
  className = "",
}: {
  readonly barrier: Barrier | null;
  /** Extra controls for the selected barrier, such as reviewer decisions. */
  readonly children?: ReactNode;
  readonly className?: string;
}) {
  return (
    <section
      aria-labelledby={HEADING_ID}
      aria-live="polite"
      // Can scroll when height-capped beside the map, so keyboard users can reach its content.
      tabIndex={0}
      className={`af-panel overflow-y-auto p-5 ${className}`}
    >
      <p className="af-eyebrow text-xs">{barrier ? "Selected barrier" : "Details"}</p>
      <h2 id={HEADING_ID} className="af-display mt-1 text-2xl break-words">
        {barrier ? barrier.name : "Barrier details"}
      </h2>
      <AnimatePresence mode="popLayout" initial={false}>
        <PresenceBody key={barrier?.id ?? "none"}>
          {barrier ? (
            <>
              <BarrierFacts barrier={barrier} />
              {children}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Select a barrier on the map or in the list to see its details.
            </p>
          )}
        </PresenceBody>
      </AnimatePresence>
    </section>
  );
}

// The outgoing barrier fades out briefly; hide it from assistive tech and input meanwhile.
function PresenceBody({ children }: { readonly children: ReactNode }) {
  const isPresent = useIsPresent();
  return (
    <m.div
      aria-hidden={!isPresent || undefined}
      inert={!isPresent}
      initial={{ opacity: 0, x: SLIDE_PX }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, transition: MOTION_EXIT_TRANSITION }}
      transition={{ duration: MOTION_DURATION_S.fast, ease: MOTION_EASE_ENTER }}
    >
      {children}
    </m.div>
  );
}

const WATCH_NOTE_ID = "watch-barrier-note";

// Remounts per barrier (PresenceBody is keyed by id), so the saved state is read fresh. Details
// only render after a client-side selection, so reading storage here never runs on the server.
function WatchToggle({ barrierId }: { readonly barrierId: string }) {
  const [watching, setWatching] = useState(() => isWatched(barrierId));
  const [saveFailed, setSaveFailed] = useState(false);
  function change(next: boolean) {
    const saved = setWatched(barrierId, next);
    setSaveFailed(!saved);
    if (saved) setWatching(next);
  }
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
      <BellButton
        pressed={watching}
        onPressedChange={change}
        label="Watch this barrier"
        offText="Watch"
        onText="Watching"
        describedBy={WATCH_NOTE_ID}
      />
      <p id={WATCH_NOTE_ID} className="text-sm text-muted">
        Saved in this browser only. No alerts are sent.
      </p>
      <p role="status" className="basis-full text-sm text-warning">
        {saveFailed ? "This browser blocked saving. Allow site storage to watch barriers." : ""}
      </p>
    </div>
  );
}

function BarrierFacts({ barrier }: { readonly barrier: Barrier }) {
  const state = verificationDisplay(barrier.state);
  const facts: readonly (readonly [string, string])[] = [
    ["Type", BARRIER_TYPE_LABELS[barrier.type]],
    ["Severity", severityLabel(barrier.severity)],
    ["Source", SOURCE_LABELS[barrier.source]],
    ["Reported", barrier.reportedOn],
  ];
  return (
    <>
      <p className="mt-3 flex flex-wrap gap-2">
        <Badge label={`${state.symbol} ${state.label}`} tone={state.tone} />
        <Badge
          label={
            barrier.dataKind === "report"
              ? "Submitted report · not an official inspection"
              : "Fictional sample"
          }
          tone="warning"
        />
      </p>
      <WatchToggle barrierId={barrier.id} />
      <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-sm text-ink">{state.explanation}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {facts.map(([term, value]) => (
          <div key={term}>
            <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{term}</dt>
            <dd className="text-ink">{value}</dd>
          </div>
        ))}
        <div className="col-span-2">
          <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Location</dt>
          <dd className="break-words text-ink">{barrier.locationDescription}</dd>
        </div>
      </dl>
      <p className="mt-4 whitespace-pre-wrap break-words text-ink">{barrier.description}</p>
      {barrier.dataKind === "report" ? (
        <EvidenceProvenanceList evidence={barrier.evidence ?? []} />
      ) : null}
    </>
  );
}
