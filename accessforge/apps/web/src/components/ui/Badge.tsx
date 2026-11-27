export type BadgeTone = "neutral" | "info" | "success" | "warning" | "modeled";

// Evidence vocabulary: success = observed/verified, warning = unverified, modeled = estimate.
// Every colour meets 4.5:1 on canvas and surface. Modeled also gets a dashed underline, so an
// estimate never looks like observed evidence even without colour.
const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "text-muted",
  info: "text-accent",
  success: "text-success",
  warning: "text-warning",
  modeled: "text-modeled underline decoration-dashed decoration-1 underline-offset-[5px]",
};

// A typeset label, not a pill: same small caps rhythm as the section eyebrows.
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
      className={`inline-flex items-center text-xs leading-5 font-bold tracking-[0.12em] uppercase ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}
