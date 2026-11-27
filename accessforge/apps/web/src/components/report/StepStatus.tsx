"use client";

import { nextStep, readyText, type ProgressItem } from "./ReportProgress";

// Beside the submit button at every width: the one live region for step progress, so a screen
// reader hears "2 of 4 ready" as steps finish. The Next link only moves focus when chosen.
export function StepStatus({ items }: { readonly items: readonly ProgressItem[] }) {
  const next = nextStep(items);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <p aria-live="polite" aria-atomic="true" className="font-semibold text-ink tabular-nums">
        {readyText(items)}.{next ? null : " Ready to submit."}
      </p>
      {next ? (
        <a
          href={`#${next.target}`}
          className="af-link inline-flex min-h-11 items-center"
          onClick={(event) => {
            event.preventDefault();
            document.getElementById(next.target)?.focus();
          }}
        >
          Next: {next.label}
        </a>
      ) : null}
    </div>
  );
}
