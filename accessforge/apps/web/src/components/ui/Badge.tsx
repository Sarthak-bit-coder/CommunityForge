export type BadgeTone = "neutral" | "info" | "success" | "warning";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "border-line bg-canvas text-ink",
  info: "border-accent bg-accent-soft text-accent",
  success: "border-success bg-success-soft text-success",
  warning: "border-warning bg-warning-soft text-warning",
};

// Tone is decoration only; the label text always carries the meaning (WCAG 1.4.1).
export function Badge({
  label,
  tone = "neutral",
}: {
  readonly label: string;
  readonly tone?: BadgeTone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-medium ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}
