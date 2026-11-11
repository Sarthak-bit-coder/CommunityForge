# Research Hypothesis: Accessibility Impact Optimization Engine

Status: Phase 0 proposal. No experiments have been run, and no result in this document is measured.

## 1. Problem statement

Cities fix sidewalk barriers on limited budgets. Common practice scores each defect independently by severity, proximity, usage, and risk (see COMPETITOR_ANALYSIS.md §5). Pedestrian access, however, is a **network property**. A route from a home to a clinic is usable for a wheelchair user only if **every** barrier on it is passable for that user. Two consequences follow:

- **Complementarity:** fixing barrier A may give zero benefit until barrier B on the same corridor is also fixed. Fixing both may unlock a large gain.
- **Substitutability:** fixing barrier C may be worthless if a nearby accessible detour already exists.

Ranking defects one at a time cannot see either effect. Our question is whether modeling these effects measurably improves the access gained per dollar.

## 2. Hypotheses (falsifiable)

**H1 (primary, network value).** On a shared benchmark at equal budget, a network-aware, complementarity-aware optimizer (§4, P2) achieves a **≥15% higher expected accessibility gain ΔA** (§5) than the best per-defect baseline (B1/B2), on the median instance across budget levels of 5%, 10%, and 20% of total candidate repair cost.
- *Test:* one-sided paired Wilcoxon signed-rank test over instances, α = 0.05, with the 15% threshold fixed before the experiment.
- *Falsified if:* the median relative improvement is below 15%, or the test is not significant. That result would mean per-defect scoring is adequate, and it should be reported as such.

**H2 (complementarity matters).** P2's advantage over the cost-benefit greedy B3 is concentrated in instances with high **barrier clustering** (many shortest feasible paths blocked by ≥2 barriers).
- *Falsified if:* the Spearman correlation between the clustering index and the P2-over-B3 improvement is ≤ 0.

**H3 (uncertainty).** When barrier existence is uncertain, optimizing expected ΔA over sampled scenarios (P3) beats optimizing on point estimates (P2 with probabilities rounded to 0/1), measured on held-out scenarios.
- *Falsified if:* the median held-out improvement is ≤ 0.

**H4 (fairness cost).** Adding an equity constraint (§4, P4) lowers total ΔA by ≤ 10% relative to unconstrained P2, while raising the minimum per-group gain.
- *This is descriptive, not a claim of superiority.* We report the full trade-off curve whatever the result.

