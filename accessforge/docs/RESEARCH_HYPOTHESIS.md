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

## 3. Formal model

**Graph.** G = (V, E) is a pedestrian network: sidewalk segments, crossings, curb-ramp transitions, and footpaths, following OpenSidewalks/OSM conventions. Each edge has a length and attributes (incline, width, surface).

**Profiles.** P is a set of mobility profiles: manual wheelchair, powered wheelchair, walker/cane, low vision, and general pedestrian. Each profile p ∈ P has:
- an edge cost c_p(e) = length(e) · (1 + Σ_b penalty_p(b)) over the barriers b on e;
- hard thresholds (for example, maximum incline, a missing curb ramp, or a level change beyond a set height) that make an edge **impassable** for p.

Profile parameters come from literature and stakeholder input, which is pending. They are **assumptions** until validated (see Li et al. CHI 2025 on group differences).

**Barriers.** Each barrier b has: a type, a severity in 1–5, a location (edge or node), a **probability of presence q_b** derived from its source and validation state, and a source (Project Sidewalk, city record, community report, CV model, or field verification).

**Candidate repairs.** Each repair r ∈ R removes or mitigates a set of barriers B(r). It has a cost k_r, given as a point estimate plus a range, and a type (ramp install, panel replace, gap closure, obstruction removal). Costs are **assumed unit costs** until Fremont figures are obtained.

**Origins and destinations.** Origins O are census block centroids snapped to the network and weighted by population w_o, optionally disability-weighted using ACS disability estimates. Destinations D are essential services (transit stops, grocery stores, clinics/pharmacies, schools, parks, civic buildings), each with a weight w_d.

**Accessibility.** For a repaired set S ⊆ R and a scenario ξ (one draw of barrier presence):

```
A(S, ξ) = Σ_p α_p Σ_o w_o Σ_d w_d · g( dist_p(o, d | S, ξ) )
```

Here g is a decreasing function: by default the cumulative-opportunity indicator 1[dist ≤ τ_p], with an exponential decay variant as a sensitivity check. dist is ∞ when no passable path exists. α_p weights the profiles.

**Objective.** Maximize E_ξ[A(S, ξ)] − A(∅) subject to Σ_{r∈S} k_r ≤ budget. Optional extras: an equity constraint or objective (§4, P4) and mandatory or forbidden repairs.

**Why this is hard.** With threshold g and impassable edges, the objective is **neither submodular nor supermodular** in general, because complementary repairs create supermodular jumps. Greedy constant-factor guarantees therefore do **not** apply (cf. Dilkina et al. 2011 on upgrading shortest paths). Exact MILP formulations scale poorly because there is a path constraint for every (profile, OD pair).

