import type { BadgeTone } from "@/components/ui/Badge";

// Barrier vocabulary from docs/PRODUCT_REQUIREMENTS.md §7 and docs/RESEARCH_HYPOTHESIS.md §2.

export const BARRIER_TYPES = [
  "missing_curb_ramp",
  "surface_problem",
  "obstruction",
  "no_sidewalk",
  "steep_slope",
] as const;
export type BarrierType = (typeof BARRIER_TYPES)[number];

export const VERIFICATION_STATES = [
  "unverified",
  "confirmed",
  "rejected",
  "repair_planned",
  "repair_completed",
  "resolved",
] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

export const BARRIER_SOURCES = ["community_report", "city_record", "field_verification"] as const;
export type BarrierSource = (typeof BARRIER_SOURCES)[number];

export const MIN_SEVERITY = 1;
export const MAX_SEVERITY = 5;
export type Severity = 1 | 2 | 3 | 4 | 5;

export type LngLat = { readonly lng: number; readonly lat: number };

export type EvidenceProvenance = {
  readonly source: BarrierSource;
  readonly source_ref: string;
  readonly source_version: string | null;
  readonly observed_at: string;
  readonly recorded_at: string;
};

export type Barrier = {
  readonly evidence?: readonly EvidenceProvenance[];
  readonly dataKind?: "report";
  readonly id: string;
  readonly name: string;
  readonly type: BarrierType;
  readonly severity: Severity;
  readonly state: VerificationState | "unknown";
  readonly source: BarrierSource;
  readonly location: LngLat;
  readonly locationDescription: string;
  readonly reportedOn: string;
  readonly description: string;
};

export const BARRIER_TYPE_LABELS: Record<BarrierType, string> = {
  missing_curb_ramp: "Missing curb ramp",
  surface_problem: "Broken or uneven surface",
  obstruction: "Obstruction",
  no_sidewalk: "Missing sidewalk",
  steep_slope: "Steep slope",
};

export const SOURCE_LABELS: Record<BarrierSource, string> = {
  community_report: "Community report",
  city_record: "City record",
  field_verification: "Field verification",
};

type StateDisplay = {
  readonly label: string;
  // Shown on map markers and in the legend so status is never encoded by color alone.
  readonly symbol: string;
  readonly tone: BadgeTone;
  readonly explanation: string;
};

export const STATE_DISPLAY: Record<VerificationState | "unknown", StateDisplay> = {
  unverified: {
    label: "Pending",
    symbol: "?",
    tone: "warning",
    explanation: "Awaiting reviewer verification; the report has not been confirmed.",
  },
  confirmed: {
    label: "Verified",
    symbol: "V",
    tone: "success",
    explanation:
      "A reviewer confirmed the reported barrier. This is not an official inspection or a safe-route guarantee.",
  },
  rejected: {
    label: "Rejected",
    symbol: "×",
    tone: "neutral",
    explanation:
      "A reviewer rejected the report. This does not establish that the location is accessible or safe.",
  },
  repair_planned: {
    label: "Repair planned",
    symbol: "P",
    tone: "info",
    explanation: "A repair is planned; completion has not been verified.",
  },
  repair_completed: {
    label: "Repair completed",
    symbol: "R",
    tone: "success",
    explanation: "A repair is reported complete, awaiting follow-up verification.",
  },
  resolved: {
    label: "Resolved",
    symbol: "✓",
    tone: "success",
    explanation:
      "The barrier was marked resolved after follow-up verification; conditions can change.",
  },
  unknown: {
    label: "Unknown status",
    symbol: "–",
    tone: "neutral",
    explanation:
      "Verification status is missing or unrecognized. Do not treat this report as verified.",
  },
};

export function verificationState(value: unknown): VerificationState | "unknown" {
  return typeof value === "string" && VERIFICATION_STATES.some((state) => state === value)
    ? (value as VerificationState)
    : "unknown";
}

export function verificationDisplay(value: unknown): StateDisplay {
  return STATE_DISPLAY[verificationState(value)];
}

export const ALL = "all";
export type BarrierFilter = {
  readonly type: BarrierType | typeof ALL;
  readonly state: VerificationState | typeof ALL;
};
export const NO_FILTER: BarrierFilter = { type: ALL, state: ALL };

export function filterBarriers(
  barriers: readonly Barrier[],
  filter: BarrierFilter,
): readonly Barrier[] {
  return barriers.filter(
    (barrier) =>
      (filter.type === ALL || barrier.type === filter.type) &&
      (filter.state === ALL || barrier.state === filter.state),
  );
}

export function severityLabel(severity: Severity): string {
  return `Severity ${severity} of ${MAX_SEVERITY}`;
}

export function barrierSummary(barrier: Barrier): string {
  return `${barrier.name}. ${BARRIER_TYPE_LABELS[barrier.type]}. Status: ${verificationDisplay(barrier.state).label}.`;
}
