"use client";

import { m } from "motion/react";
import { MOTION_DURATION_S, MOTION_EASE_ENTER } from "@/components/motion/motion-tokens";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";

export type ProgressItem = {
  readonly label: string;
  /** The field focused when the item is chosen. */
  readonly target: string;
  readonly isDone: boolean;
  /** Shown in the list but left out of the ready count. */
  readonly isOptional?: boolean;
};

function statusText({ isDone, isOptional }: ProgressItem): string {
  if (isOptional) return isDone ? "added" : "not added";
  return isDone ? "done" : "not done yet";
}

/** The first unfinished required step, or null when every required step is done. */
export function nextStep(items: readonly ProgressItem[]): ProgressItem | null {
  return items.find((item) => !item.isOptional && !item.isDone) ?? null;
}

export function readyText(items: readonly ProgressItem[]): string {
  const required = items.filter((item) => !item.isOptional);
  return `${required.filter((item) => item.isDone).length} of ${required.length} ready`;
}

// A checklist beside the form, not a gate: every item is a shortcut to its field, and the
// submit button still validates everything. Not a live region, so typing stays quiet.
export function ReportProgress({ items }: { readonly items: readonly ProgressItem[] }) {
  const required = items.filter((item) => !item.isOptional);
  const doneCount = required.filter((item) => item.isDone).length;
  return (
    <nav aria-label="Report checklist" className="af-panel p-5">
      <p className="af-eyebrow">Your report</p>
      <p className="mt-3 font-display text-2xl font-semibold text-ink tabular-nums">
        {doneCount} of {required.length}{" "}
        <span className="text-base font-normal text-muted">ready</span>
      </p>
      <div aria-hidden="true" className="mt-3 h-1 overflow-hidden rounded-full bg-canvas">
        <m.div
          className="h-full origin-left rounded-full bg-accent"
          initial={false}
          animate={{ scaleX: doneCount / required.length }}
          transition={{ duration: MOTION_DURATION_S.interactive, ease: MOTION_EASE_ENTER }}
        />
      </div>
      <ol className="mt-5 space-y-1">
        {items.map((item) => (
          <li key={item.target}>
            {/* One phrase for assistive tech ("Barrier type, done"); the visible word repeats it. */}
            <button
              type="button"
              aria-label={`${item.label}, ${statusText(item)}`}
              onClick={() => document.getElementById(item.target)?.focus()}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm font-semibold text-ink transition-colors duration-150 hover:bg-canvas"
            >
              <CheckMark isDone={item.isDone} />
              <span className="flex-1">{item.label}</span>
              {item.isDone ? (
                <span className="text-xs font-semibold text-accent">
                  {item.isOptional ? "Added" : "Done"}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// The tick draws itself when an item is completed; under reduced motion it simply appears.
function CheckMark({ isDone }: { readonly isDone: boolean }) {
  const reduceMotion = usePrefersReducedMotion();
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 shrink-0">
      <circle
        cx="10"
        cy="10"
        r="9"
        strokeWidth="1.5"
        className={`transition-colors duration-300 ${isDone ? "fill-accent stroke-accent" : "fill-surface stroke-control"}`}
      />
      <m.path
        d="M6 10.5 8.8 13 14 7.5"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-surface"
        initial={false}
        animate={{ pathLength: isDone ? 1 : 0, opacity: isDone ? 1 : 0 }}
        transition={{ duration: reduceMotion ? 0 : MOTION_DURATION_S.interactive, ease: "easeOut" }}
      />
    </svg>
  );
}
