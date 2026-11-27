import type { ReactNode } from "react";

type NoticeTone = "info" | "warning";

const TONE_CLASSES: Record<NoticeTone, string> = {
  info: "border-accent/40 bg-accent-soft",
  warning: "border-warning/50 bg-warning-soft",
};
const ICON_CLASSES: Record<NoticeTone, string> = {
  info: "bg-accent",
  warning: "bg-warning",
};

// A labelled, compact note for limits and data caveats. The icon is decorative; text carries it.
export function Notice({
  label,
  tone = "info",
  children,
}: {
  readonly label: string;
  readonly tone?: NoticeTone;
  readonly children: ReactNode;
}) {
  return (
    <aside
      aria-label={label}
      className={`flex gap-3 rounded-xl border p-3 text-sm text-ink ${TONE_CLASSES[tone]}`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-surface ${ICON_CLASSES[tone]}`}
      >
        {tone === "warning" ? "!" : "i"}
      </span>
      <div className="min-w-0">{children}</div>
    </aside>
  );
}
