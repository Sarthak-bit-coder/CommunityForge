# AccessForge engine foundation

Pure Python frozen dataclasses (`accessforge_engine.contract`) and NetworkX graph construction. Outputs describe modeled access, not safe routes or compliance determinations. Accessibility evaluation, exhaustive optimization, and a greedy baseline are implemented; no API exists yet.

Run from this directory:

```sh
uv sync --extra dev
uv run pytest
uv run ruff check .
uv run mypy accessforge_engine
```

`ProblemInstance` retains the contract's field order. Its `nodes` are `Node(id)` values. All collection inputs are copied into tuples, frozensets, or read-only mapping snapshots. All referenced IDs must exist; disconnected and empty networks are allowed. At least one profile must have positive weight. Budget is the nonnegative nominal `SolveParams.budget`; cost ranges are bounds, not probability distributions. `equity` currently accepts only `None`: the architecture does not yet define `EquitySpec`. No solve function is stubbed or silently approximated.

`build_graph(instance, profile_id, directed=...)` returns a fresh MultiGraph or MultiDiGraph with all nodes, including isolated nodes. Edge keys are edge IDs, preserving parallel paths. Directionality must be supplied explicitly; directed edges follow `u` to `v`. Lengths arrive in meters already computed in EPSG:32610; this package does not ingest or project geometry.

Passability uses `Profile.impassable_types` and `max_incline`. Incline values are signed rise/run ratios, not degrees or percentages; absolute slope is compared inclusively to the limit. Missing incline blocks the edge for profiles with a slope limit; profiles without that limit can use it. Other edge attributes are retained without inventing width/surface thresholds absent from the contract. Severity is validated but does not scale penalties: profile penalties are by barrier type, as specified.

An active hard node barrier blocks every incident edge while retaining the isolated node. Positive soft node penalties fail explicitly because the contract leaves their traversal cost undefined. Active edge penalties produce `weight = length_m * (1 + sum(penalties))` in generalized meters. `threshold_m` is used by accessibility evaluation and does not remove long individual edges during graph construction.

When all presence probabilities are 0 or 1, graph construction derives the active barrier set. Otherwise callers must supply `present_barrier_ids` for a realized scenario, including an empty set when none are present. An explicit scenario may override probability endpoints for counterfactual analysis; it must never reference unknown barriers. The graph builder performs no rounding, stochastic sampling, average-weight surrogate, or repair application. The evaluator applies full-removal repairs; mitigation, prerequisites, uncertain costs, and graph-changing repairs await explicit contract decisions.

Dependencies: NetworkX implements the selected graph representation; setuptools packages it. The development tools supply pytest, coverage, Hypothesis invariants, linting, strict typing, and NetworkX type stubs. `uv.lock` pins the resolved environment. No production dependency beyond NetworkX is introduced.

## Accessibility evaluation

`evaluate(instance, selected_repair_ids, params)` follows the architecture's three-argument interface and returns frozen `EvaluationMetrics`. `metrics.before` and `metrics.after` contain total expected accessibility, `by_profile`, `by_group`, and sparse `reachable_probabilities[(profile_id, origin_id, destination_id)]`. Missing reachability keys mean zero. Profile/group scores include profile weights; totals are weighted opportunities, not unique residents. Weights are used as supplied without normalization.

For each origin and profile, NetworkX Dijkstra finds destinations at generalized distance **≤ `threshold_m`**. Every destination contributes its weight once, regardless of the number of routes or other destinations sharing its node. Disconnected destinations contribute zero. Co-located origins/destinations have distance zero, including isolated nodes. The default cumulative-opportunity score is `Σ_p α_p Σ_o w_o Σ_d w_d 1[distance≤threshold_p]`. No exponential-decay variant is implemented.

The three-argument evaluator uses undirected graphs. Pass `directed=True` explicitly for directed input; it preserves the graph builder's `u` to `v` orientation. No topology links are inferred.

Selected repair IDs must be unique and valid. Evaluation removes the union of their barriers from each realized scenario, preserving overlapping-repair idempotence and joint corridor effects. It cannot override structural slope limits or create links. Costs remain additive for distinct selected repairs, including overlapping ones. `total_cost` and `budget_feasible` report nominal budget feasibility; evaluation never trims an over-budget selection. `delta_a_expected`, `delta_a_by_profile`, and `delta_a_by_group` compare matching before/after scores. Nonnegative weights and removal-only repairs guarantee nondecreasing reachability and modeled access, not construction feasibility or actual outcomes.

For uncertain barriers, the evaluator assumes **independent Bernoulli presence** and samples `params.n_scenarios` using a local standard-library `Random(params.seed)`, visiting barriers in sorted ID order. This adds no dependency. All profiles and both sides of the comparison share each scenario. The seed and draw order are independent of the selected repairs. Returned reach probabilities and accessibility are sample estimates under assumed presence probabilities, not calibrated confidence statements. For entirely deterministic presence, evaluation uses one exact scenario; `metrics.n_scenarios` reports the actual count.

`params.method` and `time_limit_s` are optimizer settings and do not select an evaluation algorithm or impose an evaluation timeout. Existing equity and soft-node-penalty restrictions remain explicit errors. No prerequisites, repair sequencing, probability calibration, uncertainty intervals, or API behavior is introduced.

## Budgeted repair optimization

`solve(instance, params)` returns the frozen `SolveResult` specified in ARCHITECTURE §3. `params.method="exhaustive"` enumerates all feasible repair subsets (including the empty set) and maximizes the existing evaluator's `delta_a_expected`. It supports at most **20 total repair candidates** and raises `InvalidInstanceError` above that limit; it never silently substitutes a heuristic. The exponential search is a small-instance correctness reference, not the planned MILP benchmark or a city-scale solver.

`params.method="B3"` (alias `"greedy"`) is the single-repair gain/cost baseline. It recomputes every affordable candidate's marginal after each pick, prioritizes positive-gain free repairs, and stops when no affordable repair has positive marginal gain. It does not select zero-value fillers. Ratios use standard-library rational comparison to avoid overflow and division by zero. No submodular approximation guarantee applies. It can miss complementary pairs, including zero-cost pairs; the exhaustive reference handles them by evaluating combinations directly.

Both methods use all mobility profiles and exactly the evaluator's fixed seeded scenarios. Under uncertain presence, exhaustive optimality applies **only to that finite sampled objective**, not the true expectation or held-out data. The returned diagnostics flag `optimality_proven=1` only for a completed exhaustive search; B3 always reports zero. No held-out performance or 15% improvement claim is implied. `n_scenarios` records the evaluator's actual scenario count.

Budget feasibility uses the additive nominal costs and the evaluator's floating-point sum, with no tolerance that permits overspending. Repairs are never selected more than once, and overlapping barrier removal remains idempotent. Exact objective ties prefer lower total cost, then fewer repairs, then lexicographically smaller sorted ID tuples. Greedy ratio ties prefer the smaller repair ID. Selected IDs are always sorted. Changing repair/barrier input order does not change decisions on identical seeded data.

Dependencies mean **joint accessibility effects** of multiple full-removal repairs. Construction prerequisites, sequencing, exclusions, mandatory/forbidden selections, and shared mobilization costs have no fields in the existing contract and are not inferred or invented. Every repair is assumed independently executable. Engineering prerequisites require an approved contract extension; this solver does not certify them.

The two-argument solve call uses the evaluator's undirected convention; `directed=True` is available for explicitly directed input. Unknown method names fail clearly. `time_limit_s` covers search, evaluations, explanation generation, and sensitivity checks. It is a cooperative deadline checked between evaluations and enumeration steps: one evaluation may finish after the deadline, at which point `TimeoutError` is raised. No partial portfolio is returned or labeled optimal.

Each selected repair gets a measured portfolio-removal explanation. `marginal_delta_a` is the loss from removing that repair; these losses are not additive. Benefiting profiles and destination categories refer to that removal comparison. Another selected repair is reported as complementary when removing it reduces the first repair's removal loss. `bundle_id=None` because neither algorithm generates candidate bundles. The contract's existing result types are implemented without changing input fields. `engine_version` is `0.1.0`, matching this package version.

Cost stability has one explicit, limited protocol: rerun the **same method** with all nominal repair costs uniformly scaled by 0.7 and 1.3 at the fixed original budget (implemented equivalently via inverse budget scaling). A repair is stable only if selected in both runs. These two complete searches share the same overall deadline and seeded accessibility scenarios. The flag does not certify stability under independently perturbed costs, profile weights, or every intermediate cost value. No profile-weight perturbation study, probabilistic cost model, equity optimizer, P2/P3/P4, or MILP is implemented.

## Reproducible synthetic experiments

Run `uv run python benchmarks/run.py --output /private/tmp/accessforge-synthetic.json` from this directory for the default two-clustering, five-seed, four-budget grid sweep. Configure dimensions, barrier counts, integer cost bounds, clustering, thresholds, and methods with `--help`. Use `--case complementarity --seeds 0 --budgets 0.5 1` for the planted serial-repair failure case. Existing output files are preserved; choose a new path for a repeat run.

`accessforge_engine.synthetic` generates immutable planar grid fixtures; `baselines` implements the declared B0–B2 proxy rankings; `benchmark` compares them with existing B3 and exhaustive search through the shared evaluator. The separate `benchmarks/run.py` command handles file I/O, leaving the library functions pure. JSON preserves all result rows, configuration, environment, null ratios, and explicit timeout/error statuses. Runtime is measured rather than seeded and is excluded from equality-based reproducibility assertions.

Actual commands, raw evidence links, baseline formulas, parameter assumptions, complete aggregate tables, timing caveats, and null findings were recorded in the original AccessForge repo's `docs/engine/BENCHMARK_RESULTS.md`. These are synthetic modeled opportunities, not validated city performance or proof of the 15% hypothesis. No new dependencies or optimization methods were added by the experiment harness.
