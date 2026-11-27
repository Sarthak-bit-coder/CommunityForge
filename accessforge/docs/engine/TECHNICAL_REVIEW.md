# Independent technical review of the optimization model

Date: 2026-11-12. Status: design review; no implementation or experiments performed.

## Scope and conclusion

Reviewed `AGENTS.md`, `docs/AGENT_OWNERSHIP.md`, `docs/ARCHITECTURE.md` (especially §3), `docs/RESEARCH_HYPOTHESIS.md`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/ROADMAP.md`, and `docs/COMPETITOR_ANALYSIS.md`. The existing graphify index was queried for related concepts, then the source documents were read directly.

The core research question is coherent: budgeted repairs can have complementary and substitutable effects on modeled access. The current specification is not yet a sufficient mathematical or experimental contract. Correct the objective semantics, greedy evaluation, fairness definition, and H1 test before implementing optimization. A 15% advantage is a hypothesis, not a justified expectation or algorithmic guarantee.

Mathematical examples below are constructed deductions, not measured findings. All accessibility results discussed here are **modeled/estimated**, never official inspections, compliance determinations, safe routes, or measured resident outcomes. External prior-work claims are tagged separately; no external paper was independently fetched for this review.

## 1. Repair effects, dependencies, and objective

### 1.1 Define the random baseline and intervention precisely — blocker

**Source:** RESEARCH_HYPOTHESIS §3; ARCHITECTURE §3.

The objective `E[A(S, ξ)] − A(∅)` leaves the baseline's scenario unspecified. Define instead:

```text
F(S) = Eξ[A(S, ξ) − A(∅, ξ)]
F_N(S) = (1/N) Σ_j [A(S, ξ_j) − A(∅, ξ_j)]
```

Use the same scenario for the repaired and unrepaired graph. Although subtracting a fixed baseline does not change the maximizing portfolio, it changes reported gains, variances, relative improvements, and fairness accounting. Define `g_p(∞)=0`, nonnegative weights and penalties, and nonnegative finite edge lengths. Call the resulting distance generalized meters when penalties scale length; it is not physical walking distance.

The smallest initial intervention model is deterministic full removal:

```text
Z_b(ξ) ∈ {0,1}: barrier presence before repairs
U(S) = union of B(r) for r in S
Z_b(S, ξ) = Z_b(ξ) · 1[b not in U(S)]
```

This makes overlapping repairs idempotent: selecting two repairs addressing the same barrier does not remove it twice. Repair cost is still paid for both unless alternatives are explicitly mutually exclusive. Under removal-only interventions and nonnegative weights, `F(∅)=0` and `F(T)≥F(S)≥0` for `S⊆T`, scenario by scenario. These are required invariants.

The prose also permits **mitigation**, gap closure, and attribute changes, but `Repair` only contains barrier IDs and costs. Removing a barrier cannot add an absent edge or change an immutable incline/width threshold. Either restrict the first engine explicitly to full removal on an existing graph or propose typed post-repair effects through the contract process. Do not silently claim to model missing-link construction, partial mitigation, construction disruption, or uncertain repair success.

### 1.2 Separate complementarity from prerequisites

**Source:** RESEARCH_HYPOTHESIS §§1, 3–4.

Two barriers in series create **benefit dependence**: each repair can be performed independently but both are needed for access. A construction prerequisite is different: repair B may be infeasible without repair A. Neither `barrier_ids` nor explanatory `complementary_repair_ids` expresses a prerequisite, mutually exclusive alternatives, shared mobilization costs, or sequencing.

For the initial model, state that all repairs are independently executable, costs are additive, and there are no prerequisites or exclusions. If that assumption fails in pilot data, propose explicit prerequisite constraints `x_B≤x_A` and alternative constraints `Σ x_r≤1` for the relevant sets. Evaluate prerequisite closure before budget checks. Do not infer engineering dependencies from shared paths.

Bundle costs must use the union of **new** repairs: `Σ_{r∈T\S} k_r`. Bundle gain must be `F(S∪T)−F(S)`. Never sum individual gains or charge an already selected repair again. Multiple repairs capable of removing one barrier require an OR rule; a path can consequently have several alternative repair covers rather than one unique minimal set.

### 1.3 Neither submodularity nor supermodularity holds — correct, but operationally consequential

**Source:** RESEARCH_HYPOTHESIS §§3–4.

Hand-checkable witnesses, with one profile, one unit-weight origin/destination, and reachable distance within the threshold:

* **Series:** two impassable barriers require repairs `a,b`. Then `F({a})=F({b})=0` and `F({a,b})=1`. The marginal of `b` increases from 0 to 1, violating diminishing returns.
* **Parallel:** either of two repaired paths suffices. Then `F({a})=F({b})=F({a,b})=1`. The marginal of `b` decreases from 1 to 0, violating increasing returns.

Deterministic presence is a valid probability distribution, so expectation cannot restore either property in general. Any claimed submodularity ratio also needs a restricted instance class: the series witness permits a zero ratio. Adding best-single-item selection does not repair this problem or establish a general approximation bound.

### 1.4 Ordinary lazy greedy is invalid — blocker

**Source:** RESEARCH_HYPOTHESIS §4, B3 and P1.

Cached marginals are not upper bounds when complementarity exists. For example, initially repair `a` unlocks value 2, `b` unlocks 0 but unlocks another 100 after `a`, and independent `c` unlocks 1. All costs are 1 and budget is 2. After selecting `a`, a lazy queue can accept `c` while `b` retains its cached score 0. Full recomputation selects `b` and achieves 102 instead of 3.

Use full marginal recomputation over all affordable remaining candidates at every B3/P1/P2 iteration. A faster cache is acceptable only with a proved upper bound or complete dependency invalidation. Stop single-repair greedy at zero positive gain and document that choice; arbitrary zero-gain filling can accidentally complete bundles and makes baseline results tie-order dependent. B0/B1/B2 may continue scanning affordable repairs under their declared policies.

Define best-single-item over the same objective and feasible set. Handle zero-cost repairs without division by zero: evaluate zero-cost candidates explicitly, including zero-cost bundles, and compare positive-cost candidates by gain/cost. Fix all tie breaks by stable repair IDs.

### 1.5 P2 candidate generation is underspecified and has no completeness guarantee

**Source:** RESEARCH_HYPOTHESIS §4, P2; §7.

“Minimal repair set” could mean inclusion-minimal, minimum cardinality, minimum cost, or maximum gain per cost. “Makes the k-shortest paths feasible” could mean repairing all k paths or proposing one repair set per path. These produce different algorithms.

Recommend one repair-cover candidate per path, with a declared repair-cost ranking and deterministic tie breaking. Generate paths on a repairable graph that removes only barriers for which valid repairs exist; retain structural impassability. For soft penalties, require the post-repair generalized distance to meet the threshold, not merely graph connectivity. Filter unaffordable candidates, deduplicate repair sets, and evaluate candidates against the full objective rather than the path used to generate them.

Shortest-by-distance paths need not yield affordable or high-value portfolios. A longer corridor with cheap shared repairs can dominate several shorter expensive paths. Any fixed k can miss it. Aggregated origin clusters can also hide origins with different feasible paths; use clusters for candidate proposals only and score on the declared original OD population unless aggregation error is explicitly measured.

Freeze an initial candidate-generation policy for reproducibility. State whether candidates are regenerated after each pick; this is a separate algorithm variant. Compare small k values and candidate coverage against exhaustive small-instance solutions. Add targeted alternative-path or pair candidates only if missed complementarity warrants them. Do not add a Steiner formulation before establishing that failure mode. Even exact greedy over a complete bundle list would not itself make portfolio optimization exact.

## 2. Uncertainty and verification

### 2.1 Marginal presence probabilities do not define scenarios — blocker for P3

**Source:** RESEARCH_HYPOTHESIS §§3–4, H3; PRODUCT_REQUIREMENTS §7.

The contract supplies `q_b` but no joint distribution. Independent Bernoulli draws are a usable initial assumption, not a calibrated description of reality. For two serial barriers with `q_a=q_b=0.5`, independent baseline passability is 0.25; perfectly correlated presence gives 0.5; mutually exclusive presence gives 0. The same marginal inputs yield different repair values.

Declare independence for the initial sampler and test correlated corridor/source scenarios as sensitivity analyses. Deduplicate reports of the same physical barrier before sampling; duplicate reports are not independent obstacles. State that absence of a report does not imply absence of a barrier. Presence uncertainty is distinct from uncertain severity, passability, topology, cost, and future deterioration; Bernoulli presence alone covers none of those.

State-to-probability mappings require source/type/time calibration and versioning. `confirmed` does not prove permanent presence, and `repair_completed` is not `resolved`. When calibration data is unavailable, label probabilities assumed and examine ranges rather than claiming reliability.

### 2.2 Expected accessibility assumes scenario-adaptive route choice

**Source:** RESEARCH_HYPOTHESIS §3.

`E[g(dist(S,ξ))]` recomputes the best path in each realized graph. This estimates opportunities with realized network knowledge. It does not estimate the success probability of a fixed route chosen before uncertainty resolves, nor represent a traveler who discovers barriers mid-trip. Preserve the former planning interpretation and disclose it. Do not replace absent/present edges by average edge weights: shortest paths and thresholding do not commute with expectation.

P3 chooses one portfolio before scenarios resolve. It must not choose a different portfolio per scenario and average those values; that would grant information unavailable to the planner.

### 2.3 Use held-out paired evaluation and separate uncertainty types

**Source:** RESEARCH_HYPOTHESIS H3 and §5.

Use common training scenarios across stochastic methods, separate held-out evaluation scenarios, and paired repaired/unrepaired graphs. Use independent seeded streams for graph generation, training draws, test draws, and randomized optimizers. Share held-out draws across portfolios but do not tune k, probabilities, or weights on them. Report Monte Carlo uncertainty and stability across training seeds; independent test draws from an assumed model validate performance under that model, not probability calibration or field validity.

Specify the probability-rounding threshold and tie rule for P2 in H3. Keep P2 and P3 candidate policies and resource accounting comparable. Report training scenario count, total optimization work, and runtime. There is no theorem here that finite-sample heuristic P3 must beat P2.

### 2.4 Verification value requires reoptimization

**Source:** RESEARCH_HYPOTHESIS §4, P3; PRODUCT_REQUIREMENTS UC6.

“Expected change in the chosen portfolio's value” is not decision value. For perfect observation `Y=Z_b`, the appropriate benchmark is:

```text
EVPI_b = Σ_y P(Y=y) max_{S∈C} E[A(S,ξ) | Y=y]
         − max_{S∈C} E[A(S,ξ)]
```

Here `C` is the same feasible portfolio set, and information arrives before commitment. A fixed-portfolio expectation has zero signed expected change by the law of total expectation. Large absolute changes may describe sensitivity, but they are not value of information.

Model an imperfect inspection through observation likelihoods and posterior updates only when such data exists. Include travel/inspection costs and available decision timing before ranking verification actions. Dollar inspection costs cannot be subtracted directly from accessibility units; use a declared conversion or a separate inspection budget. Correlated barriers require posterior updates to related barriers. Heuristic reoptimization may produce negative estimated information value through solver/sample error; report that diagnostic, not a claim that perfect information is harmful. Scores for multiple visits are not additive because information can overlap.

### 2.5 Cost ranges are not budget reliability

**Source:** ARCHITECTURE §3; RESEARCH_HYPOTHESIS §§3–5.

The specified budget uses nominal `k_r`. `cost_low`/`cost_high` are not a probability distribution or confidence interval. State nominal-budget feasibility explicitly. For ±30% perturbations, distinguish evaluating the original portfolio's cost from reoptimizing under the perturbed costs. Report overspend and selection frequency separately. A worst-case budget using upper bounds is a possible later policy choice; do not silently introduce chance constraints without a joint cost model. Preserve additive-cost assumptions and document excluded mobilization economies.

## 3. Fairness

### 3.1 Current equity constraint has undefined units and feasibility — blocker for P4

**Source:** RESEARCH_HYPOTHESIS §4, P4; ARCHITECTURE §3.

`ΔA_g ≥ β · (share of need)` compares accessibility units with a dimensionless share unless β is itself an accessibility amount. Neither need nor `EquitySpec` is defined. A positive minimum can be impossible for an already fully accessible group, a disconnected group with no candidate repairs, or a budget too small to unlock a corridor. Geographic groups and profiles also overlap unless the origin/profile accounting is explicit.

Define group indices `h=(profile, tract)` separately from decay function `g_p`. Define `F_h(S)` with the same scenario baseline and explicit membership weights. Decide whether profile preference weights `α_p` belong in equity gains; otherwise setting a profile's weight to zero can erase its protected need. Aggregate disability estimates do not identify disjoint profile populations. Do not describe summed profile benefits as unique people.

One concrete initial fairness specification is a fixed unmet-opportunity scale:

```text
W_h = Σ_{o in tract(h)} w_{o,h} Σ_d w_d
N_h = W_h − E[A_h(∅,ξ)]        # use unweighted-by-α group accessibility
F_h(S) ≥ λ N_h, for declared protected groups with N_h > 0
```

For the default indicator metric, λ is the fraction of modeled baseline unmet opportunities closed. The extension to decay requires `0≤g_p≤1`. `w_{o,h}` is an assumed aggregate profile-demand allocation, not individual disability information. Publish that allocation and uncertainty. Zero-need groups need no positive gain target. Positive-need but unrepairable groups must remain visible: declare infeasibility instead of dropping them to improve the reported minimum. This definition is a review recommendation, not a settled stakeholder choice.

### 3.2 Lagrangian reweighting does not certify constrained feasibility

**Source:** RESEARCH_HYPOTHESIS §4, P4; H4.

With discrete complementary repairs, weighted-sum heuristics can miss feasible portfolios or violate a minimum target. Lagrangian values obtained by an approximate inner maximizer are not automatically valid dual bounds. Check every group constraint on the returned portfolio. Distinguish a verified feasible solution, proved infeasibility from exact search, and heuristic failure to find a feasible solution. Never silently return an unconstrained answer with an equity label.

First benchmark fairness feasibility on exhaustive tiny instances. For larger instances, reweighting can remain a labeled heuristic, with achieved ratios and violations reported. Do not implement both minimum-target and α-fair objectives until one policy is selected. If α-fairness is later used, define its parameter separately from profile weights and specify zero-gain behavior; log utility is undefined at zero and some groups cannot gain.

### 3.3 H4 needs normalized comparisons

**Source:** RESEARCH_HYPOTHESIS H4 and §5.

Raw minimum group gain favors large groups; Gini can reflect tract size rather than distributional treatment. Report total gain alongside per-demand or unmet-need-normalized gains, minimum normalized gain, baseline access, and residual access deficits. Gain fairness alone can leave historically excluded groups with very low final access.

Compute fairness cost as `1−F(S_fair)/F(S_unconstrained)` only for positive denominators, under the same objective, budget, scenarios, and comparable solver effort. If the heuristic fair solution outperforms heuristic P2, report the negative apparent cost as search behavior, not a theorem about fairness. Zero unconstrained gain, infeasible targets, and unchanged minima are explicit outcomes. The ≤10% cost and increased minimum are contingent hypotheses; publish the full frontier and uncertainty, including failures.

## 4. The 15% improvement hypothesis and evaluation

### 4.1 H1's proposed test does not test its claimed threshold — blocker

**Source:** RESEARCH_HYPOTHESIS H1 and §5.

A Wilcoxon signed-rank test against zero improvement can be significant even when improvement is only 1%. Combining that test with an observed median ≥15% does not establish that the population median exceeds 15%. Signed-rank inference also needs assumptions about the paired difference distribution; without symmetry it is not a general test of its median.

Pre-register the estimand before collecting results. A concrete interpretation of “median instance across budgets” is:

```text
G_ij = held-out expected gain of P2 on instance i at budget j
B_ij = max(held-out gain of B1, held-out gain of B2) for that same i,j
R_ij = (G_ij − B_ij) / B_ij, when B_ij > 0
R_i  = median across the three predeclared budget-level ratios
Target: population median of R_i > 0.15
```

The per-instance oracle best of B1/B2 is a conservative reference, not a deployable baseline-selection policy. If “best baseline” instead means one baseline selected globally on separate validation instances, pre-register that alternative and do not switch after seeing results. Keep all individual baseline results.

Use independent graph instances as inferential units. For complete positive-baseline instances, an exact one-sided sign test of `R_i−0.15` tests the threshold without signed-rank symmetry assumptions. Specify ties, confidence level, sample size, and the corresponding distribution-free median confidence bound before running. Claim support only when the lower bound exceeds 0.15; a point estimate of exactly 15% is not evidence for a strict excess. Estimate required sample size from a declared effect/probability-of-exceedance assumption or a separate pilot, not a fabricated expected effect. Define any multiple-test correction if additional confirmatory claims are made.

If positive baselines do not hold at every budget, report undefined ratios separately; never insert an epsilon. Either generate a declared positive-baseline benchmark stratum or explicitly limit the relative-improvement estimand to the complete positive-baseline stratum, publishing excluded counts and all absolute gains. Also report the full-benchmark threshold contrast `G_ij−1.15 B_ij`; this has accessibility units and is not relative improvement. For `B=0,G>0`, report positive absolute improvement; for `B=G=0`, report a no-opportunity case. Do not let selective omission create the 15% result.

Failure to reject is **inconclusive**, not proof that per-defect scoring is adequate. Evidence of a sub-15% effect limits the stated benchmark claim; it does not establish equivalence for all cities, profiles, or budgets. Separate supported, contradicted, and inconclusive results and publish negative findings.

### 4.2 Equal budget and gain per dollar are different estimands

**Source:** RESEARCH_HYPOTHESIS H1 and §5 metrics.

H1 compares gain at an equal allowed budget. `ΔA / actual dollars spent` can rank an underspending low-gain portfolio above a higher-gain portfolio. Make held-out gain at fixed budget the primary outcome. Report actual spend, unused budget, and gain/spend separately; define zero-spend cases without division. Derive the 5/10/20% budgets once from the same deduplicated repair candidate set and nominal costs for every method. These percentages are benchmark choices, not validated municipal budget levels.

### 4.3 Prevent favorable benchmarks and pseudoreplication

**Source:** RESEARCH_HYPOTHESIS §§4–5; H2–H3; ROADMAP Phase 1.

Specify B1/B2 scores at the **repair** level, because a repair may cover several barriers. Freeze severity aggregation, proximity/density units, weights, tie breaks, affordability scanning, and zero-cost handling. Call B2 a stylized per-defect proxy, not an established municipal practice. [U] Actual municipal/vendor portfolio logic remains unresolved in COMPETITOR_ANALYSIS §§5, 8.

Use identical candidates, graph semantics, objective, and feasibility rules for every method. Include P1, full-recomputed B3, and P2 ablations to separate network awareness, bundles, and extra search effort. B0 is a sanity reference, not a guaranteed lower bound; random selection can beat any heuristic on an individual instance.

Count independent base graphs, not budget levels, scenario draws, or optimizer seeds, as independent samples. Geographically overlapping subgraphs require clustered treatment or separate reporting. Do not pool synthetic, external-city, and illustrative Fremont results into a universal-city claim. Separate generator tuning from held-out graph generation; vary barrier clustering, alternative routes, density, costs, and zero-opportunity cases rather than planting only series bundles that favor P2.

H2 needs an operational clustering index computed before optimization. “Shortest feasible paths blocked” is contradictory if feasible means currently passable. Use declared repairable paths within the travel threshold and count distinct required repairs, not duplicate labels. Treat correlation as association, not causal proof: density, costs, and detours can confound it. Hold these factors fixed in controlled synthetic comparisons, report uncertainty, and call a non-significant correlation inconclusive rather than positive evidence. Undefined relative P2/B3 gains require the same zero-denominator policy as H1.

## 5. Exact reference, explanations, and contract gaps

### 5.1 MILP exactness depends on formulation and termination

**Source:** RESEARCH_HYPOTHESIS §§3–5, X.

There is no formulation in the proposal yet. “A path constraint for every OD” is not a sufficient description: an OD can have exponentially many paths, while a flow formulation can avoid explicit path enumeration at the cost of many variables. A k-path restricted MILP is exact only for its restricted path set, not the full graph problem. Repair count alone does not predict tractability; profiles, scenarios, graph size, and OD count matter.

For an initial deterministic full-removal benchmark, use repair binaries, barrier-removal OR relations, and served-OD binaries linked to unit flow over post-repair passable arcs with generalized path length ≤τ. Node barriers must affect every relevant traversal. Soft-penalty removal needs correct repair-dependent length linearization; omitting it changes the objective. Verify the formulation against exhaustive repair-subset enumeration on tiny graphs before using it as a reference. For SAA exactness, scenario-specific reachability shares the same first-stage repair binaries.

Report solver status, incumbent, bound, integrality gap, and time limit. Only a certified optimum supports `(OPT−F(method))/OPT`, and the zero-optimum case is undefined. On time limits, report bounds rather than calling the incumbent optimal. An aggregated-OD optimum is not an upper bound for the original unaggregated objective. Re-evaluate every solver portfolio through the shared evaluator and flag heuristic values exceeding a claimed optimum.

### 5.2 Removal marginal is useful but not additive

**Source:** RESEARCH_HYPOTHESIS §4 explanations and §5 fidelity; ARCHITECTURE §3.

Define explanation loss as `L_r(S)=F(S)−F(S\{r})` on fixed scenarios. In the series example, both losses are 1 while total gain is 1. In a redundant parallel portfolio, both losses can be 0 while total gain is 1. Never sum removal marginals as attributed total benefit or call zero removal loss proof that the selection procedure was wrong.

The fidelity rule currently removes “dependents,” whereas the explanation definition removes one repair. Test those as different quantities. Bundle membership records how a candidate was proposed; it is not a unique physical or causal partition. Keep complementary partners descriptive unless a separate conditional-loss calculation substantiates them. Weighted OD/profile opportunities must not be labeled distinct residents. Report unique modeled origin population separately where the definition supports it.

### 5.3 Contract changes need explicit proposals, not silent inference

**Source:** ARCHITECTURE §3; AGENT_OWNERSHIP contract change process.

Before implementation, propose the following through `docs/engine/HANDOFF.md` and obtain the documented human approval before changing the shared contract. This review records recommendations only; it does not amend that contract.

* Define graph directionality, parallel-edge handling, node barriers, barrier-location exclusivity, profile width/surface/severity semantics, origin snapping, and generalized-distance units. Avoid silently accepting topology that connects opposite sidewalks across inaccessible crossings.
* Define `EquitySpec`, group/profile demand accounting, constraint scope (expected versus per-scenario), and feasibility/status output.
* Resolve deterministic full removal versus typed repair effects, and whether prerequisites, exclusions, or mandatory/forbidden selections are actually supported. The prose advertises mandatory/forbidden repairs, but `SolveParams` does not encode them.
* Preserve training/evaluation separation, scenario-model provenance, sample counts, objective components, and solver status. A numeric diagnostics map cannot adequately encode every categorical status or provenance item.
* Separate insertion gain from portfolio-removal loss in `Explanation.marginal_delta_a`. Define the perturbation protocol behind `stable_under_cost_perturbation`; one Boolean is not a selection frequency, feasibility measure, or confidence statement.
* Validate finite numbers; unique and referentially valid IDs; probabilities in [0,1]; severity 1–5; nonnegative costs/weights/penalties/thresholds; `cost_low≤cost≤cost_high`; positive total profile weight; valid scenario counts/time limits; and repair barrier references. Reject unsupported effects rather than ignoring them. Define normalization, including destination-category weighting, before comparing instances.

Origins snapped to the network assume usable access from the census representative point to its snapped node. Destinations assume accessible network attachment, not verified building entry. ACS-derived profile allocations, centroid placement, pilot boundaries, and disconnected components need sensitivity checks. Do not fabricate network links merely to obtain a single connected component.

## 6. Originality risks and defensible contribution

**External evidence status:** [S] COMPETITOR_ANALYSIS §6 identifies PPNA (Bolten & Caspi 2021), the 2024 PLOS ONE facility-location/network-design paper (DOI 10.1371/journal.pone.0312230), and “Upgrading Shortest Paths in Networks” (CPAIOR 2011) as relevant prior work. These descriptions inherit that document's secondary-source status; this review does not verify their formulations, authorship details, or results.

Profile-specific graphs, budgeted network upgrades, bundle heuristics, SAA, information value, and weighted fairness are not, by their presence alone, a demonstrated new algorithm. [U] Exact overlap of P2–P4 with prior literature remains unverified. [U] Vendor absence of network portfolio optimization is also unverified. Do not convert an absence of retrieved documentation into a novelty claim.

Before any external originality claim, read the closest papers in full and record a comparison of decision variables, intervention semantics, objective, heterogeneity, budget, complementarity handling, uncertainty, fairness, search method, and guarantees. Compare the actual algorithms on matched assumptions where feasible. “Complementarity-aware” alone is insufficient differentiation when network-design methods already jointly select upgrades.

A defensible **candidate contribution**, pending that audit, is a reproducible accessibility-repair benchmark plus a well-tested, explainable portfolio heuristic with explicit uncertainty and distributional trade-offs. Product integration and the verification workflow may be useful engineering contributions without algorithmic novelty. Keep claims proportional to evidence; do not pursue a new theorem or complex optimizer just to manufacture differentiation.

## 7. Minimum recommended sequence and proof obligations

1. **Before engine code:** settle removal-only semantics, objective/units, graph and demand assumptions, deterministic baseline rules, and contract proposals. Correct the H1 estimand and threshold-testing protocol before generating confirmatory results.
2. **Phase 1:** implement the shared evaluator, full-recomputed B0–B3/P1, and exhaustive tiny-instance reference. Prove monotonicity, idempotent overlap, series/parallel effects, lazy-greedy counterexample, threshold boundaries, structural impassability, and zero-cost/budget behavior with hand-computed tests.
3. **Phase 2:** add declared P2 candidate generation and validate any MILP against exhaustive results. Measure missed bundles and approximation gaps before adding more candidate machinery.
4. **Phase 3:** add P3 with held-out scenarios and clearly assumed joint uncertainty; test the information-value formula on an exhaustively solvable decision example. Add one defined P4 policy with explicit constraint checks and infeasibility reporting.
5. **Evaluation:** freeze parameters and benchmark strata; publish all absolute gains, defined ratios, exclusions, uncertainty intervals, fairness violations, solver statuses, runtime, and negative results. Keep illustrative Fremont output separate from validated effects.

This review intentionally changes no architecture contract, top-level research document, implementation, dependency, or experiment configuration. No performance, 15% improvement, fairness-cost, novelty, or field-validity claim has been established.
