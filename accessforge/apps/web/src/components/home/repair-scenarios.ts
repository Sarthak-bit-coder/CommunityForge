export type Scenario = {
  readonly id: string;
  readonly label: string;
  /** Corners repaired, in route order. */
  readonly fixed: number;
  /** Text alternative for the diagram. */
  readonly summary: string;
  readonly detail: string;
};

export const SCENARIOS: readonly Scenario[] = [
  {
    id: "today",
    label: "Today",
    fixed: 0,
    summary: "Today: the trip from home to the clinic is blocked at the first corner.",
    detail:
      "Two corners on the way have no curb ramp. A wheelchair user cannot get past the first one.",
  },
  {
    id: "one",
    label: "Fix one corner",
    fixed: 1,
    summary: "One repair: the trip is still blocked at the second corner.",
    detail:
      "One new ramp alone opens nothing. A method that ranks barriers one at a time scores this repair as zero, so it may never be funded.",
  },
  {
    id: "both",
    label: "Fix both corners",
    fixed: 2,
    summary: "Both repairs: the whole trip is open from home to the clinic.",
    detail:
      "Funded together, the two repairs open the whole trip. That is why AccessForge chooses repairs as a group within the budget.",
  },
];

/** The scenario that owns this share of the story progress (0–1). Each owns an equal share. */
export function scenarioAt(progress: number): Scenario {
  const index = Math.floor(progress * SCENARIOS.length);
  return SCENARIOS[Math.min(Math.max(index, 0), SCENARIOS.length - 1)];
}
