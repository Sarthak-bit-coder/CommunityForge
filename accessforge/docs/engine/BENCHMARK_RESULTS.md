# Synthetic benchmark results

Run date: 2026-11-12. Status: **exploratory synthetic results**, not real-world validation.

## What was run

The benchmark completed **410/410 method evaluations successfully**, with no recorded timeout or error:

- 400 grid evaluations: 2 grid sizes × 2 spatial-clustering settings × 5 seeds × 4 budgets × 5 methods.
- 10 evaluations of a separately constructed complementary-repair corridor: 2 budgets × 5 methods.

These are 20 generated grid instances in five seed blocks, not 400 independent networks. Size/clustering variants reuse seeds, attributes, and demand draws where their configurations permit; budgets and methods are repeated comparisons on the same input. The corridor is one constructed example, not an independent random sample for each method.

All gains below are **modeled/estimated weighted opportunities**. They are not measured trips, distinct residents helped, official inspections, compliance determinations, or safe-route findings. There are no city observations or field outcomes in this benchmark.

Raw evidence, including every selection, budget, profile gain, runtime, and failure-status field:

- [3×3 grid: 200 rows](benchmark_runs/grid_3x3.json)
- [4×4 grid: 200 rows](benchmark_runs/grid_4x4.json)
- [Complementary corridor: 10 rows](benchmark_runs/complementarity.json)

## Reproduction commands

From the repository root:

```sh
cd services/engine
uv sync --extra dev
uv run python benchmarks/run.py --width 3 --height 3 --barriers 6 --clusterings 0 1 --seeds 0 1 2 3 4 --budgets 0.05 0.1 0.2 0.5 --output ../../docs/engine/benchmark_runs/grid_3x3.json
uv run python benchmarks/run.py --width 4 --height 4 --barriers 8 --clusterings 0 1 --seeds 0 1 2 3 4 --budgets 0.05 0.1 0.2 0.5 --output ../../docs/engine/benchmark_runs/grid_4x4.json
uv run python benchmarks/run.py --case complementarity --seeds 0 --budgets 0.5 1 --output ../../docs/engine/benchmark_runs/complementarity.json
```

These commands match the archived runs. The runner deliberately refuses to overwrite existing evidence. To repeat them after checkout, choose new output filenames, for example `/private/tmp/accessforge-grid-3x3-repeat.json`. The actual run used the installed `.venv/bin/python` interpreter directly, equivalent to the locked `uv run python` environment above. Runtime is observed and will vary; generated inputs, selections, and score metrics reproduce on the same code/runtime and seeds.

Configuration is persisted inside each JSON artifact. `--methods` can restrict the compared methods; `--cost-min`, `--cost-max`, `--edge-length-m`, `--threshold-m`, sizes, barrier count, clustering, seeds, and budget fractions are configurable. Invalid configurations fail; unsupported solver sizes and timeouts become explicit result rows with null score metrics. Programming/invariant errors are not converted into zero gains.

Verification commands from `services/engine`:

```sh
uv run pytest
uv run mypy accessforge_engine benchmarks/run.py
uv run ruff check .
uv run ruff format --check .
```

## Generator and fixed evaluation protocol

The run axes were chosen before the archived sweeps. This is an exploratory protocol recorded in code and artifacts, not an externally registered confirmatory study.

| Input | Recorded settings |
|---|---|
| Topology | Undirected rectangular grids: 3×3 (9 nodes, 12 edges), 4×4 (16 nodes, 24 edges) |
| Barriers / repair candidates | 6 on the smaller grid; 8 on the larger; one unique barrier per selected edge and one full-removal repair per barrier |
| Geometry | Abstract planar coordinates in meters; every edge is 25 m with zero incline; no georeferenced Fremont geometry |
| Barrier types | Seeded uniform choices among step, rough surface, and missing signal; severity integers 1–5 |
| Presence | Exactly 1 for all generated barriers; this run does not test uncertain-presence calibration or SAA generalization |
| Nominal costs | Seeded uniform integers 10–30 in synthetic currency units; cost bounds equal nominal cost |
| Demand | One origin per left-column node, population weight sampled uniformly from integers 20–100; one unit-weight destination per right-column node |
| Destination categories | Cycling health, transit, grocery labels by row; labels carry no additional score multiplier |
| Threshold | 150 generalized meters for every grid profile |
| Seeds | 0, 1, 2, 3, 4; local PRNGs only, without global random-state changes |
| Budget | 5%, 10%, 20%, 50% of the same total candidate repair cost for every method |
| Solver deadline | 30 s per solve including explanation and cost-stability work |

The `clustering` parameter specifies the fraction of barrier placements grown as one connected edge cluster: `round(barrier_count × clustering)` placements are grown from a seeded anchor edge by adding adjacent edges, then the rest are sampled without replacement. At 0, all placements are uniformly sampled; chance clusters can still occur. At 1, all barrier-bearing edges form a connected subgraph. This is **spatial clustering**, not the still-unresolved H2 index of multiple required repairs on relevant paths. Clustering does not guarantee repair complementarity in a grid with detours.

Grid profiles are deliberately assumed illustrative parameters:

| Profile | Weight | Hard barrier types | Rough-surface penalty | Maximum absolute incline |
|---|---:|---|---:|---:|
| Wheelchair | 0.50 | step | 2.00 | 0.08 rise/run |
| Low vision | 0.25 | signal | 0.50 | none |
| Pedestrian | 0.25 | none | 0.25 | none |

These profiles are not calibrated mobility models. The score is the existing evaluator's sum of profile weight × origin weight × reachable destination weight, with inclusive distance thresholds. Profile gains include profile weights. Both sides of each repair comparison use identical data; every method receives the same candidate set and budget.

The placement and candidate-attribute streams derive explicit seeds from the instance seed. Origin draws are deterministic and do not depend on the clustering setting. B0 selection uses `seed + 1,000,000`; evaluation uses `seed + 2,000,000`. Presence is deterministic here, so evaluation uses one exact scenario. No new dependencies or engine input-contract fields were introduced.

## Baseline definitions

| Method | Implemented selection policy |
|---|---|
| B0 | Shuffle sorted repair IDs with the declared local seed, then scan all candidates and skip unaffordable repairs. One random ordering per instance/budget, not an averaged random-baseline distribution. |
| B1 | Rank repairs by maximum covered-barrier severity, then lower nominal cost, then repair ID; scan and skip unaffordable candidates. |
| B2 | Fixed per-defect severity × geometric proximity × local population density, summed over barriers covered by a repair, divided by nominal cost; scan and skip unaffordable candidates. |
| B3 | Existing fully recomputed single-repair marginal-gain/cost greedy; stop when no affordable positive-gain candidate exists. It is not lazy greedy. |
| Exhaustive | Existing complete feasible-subset search, including the empty set; ties prefer lower cost, then fewer repairs, then sorted IDs. This is not the planned MILP method X. |

For B2, edge barriers use edge midpoints and node barriers use node positions. Proximity is `Σ_d w_d / (1 + EuclideanDistance(barrier,d)/100 m)`. Population density is the sum of origin weights within 100 m divided by `π × (100 m)^2`. All three factors have unit multiplier. The formula and scales were fixed before these sweeps. B2 does not examine counterfactual accessible routes or complementary repairs. It is a **stylized municipal-style proxy**, not an empirically established city policy. Actual municipal/vendor prioritization logic remains [U] unverified as recorded in `docs/COMPETITOR_ANALYSIS.md` §8; no new external research was performed here.

Zero-cost positive-score repairs rank before paid repairs in B2. ID ties are deterministic. B0–B2 may spend on zero-gain repairs; B3/exhaustive can leave budget unused. No repair is charged twice. Unreachable opportunities and zero-gain cases remain in the results. Undefined gain/spend, gain/budget, zero-budget usage, and zero-reference optimality gaps are stored as null rather than divided by an epsilon.

## Grid accessibility results

Each cell below is the arithmetic mean modeled gain over **all 20 grid instances** at the given budget, including zero gains. The 50% budget is an additional exploratory setting, outside H1's stated budget levels.

| Budget share | B0 | B1 | B2 | B3 | Exhaustive |
|---|---:|---:|---:|---:|---:|
| 5% | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| 10% | 6.1250 | 2.4250 | 2.4250 | 12.0250 | 13.0000 |
| 20% | 7.4125 | 22.1625 | 19.6375 | 34.7500 | 35.7500 |
| 50% | 21.7875 | 33.5500 | 31.4500 | 37.5250 | 37.5250 |

Mean nominal budget usage, as a percentage of allowed budget:

| Budget share | B0 | B1 | B2 | B3 | Exhaustive |
|---|---:|---:|---:|---:|---:|
| 5% | 0.00% | 0.00% | 0.00% | 0.00% | 0.00% |
| 10% | 58.36% | 61.10% | 61.10% | 14.32% | 16.38% |
| 20% | 76.73% | 78.00% | 77.59% | 40.04% | 41.41% |
| 50% | 90.55% | 91.54% | 90.05% | 18.58% | 18.46% |

Unused budget is an outcome, not a normalization adjustment. Higher spend efficiency is not the same objective as higher total gain at a fixed allowed budget. Per-row gain/budget and gain/spend are included in the raw artifacts.

Negative and null findings are material:

- At 5%, no method could buy any repair in any grid instance: all gains and spending were zero. These budget levels are uninformative for relative improvement on this small candidate set.
- Exhaustive found zero achievable gain in 20/20, 16/20, 8/20, and 8/20 instances at the four respective budget levels. Detours and already-accessible opportunities often made repairs unnecessary for the threshold score.
- Exhaustive matched B3's gain in **78 of 80** grid instance/budget comparisons, exceeding it in only one 10% case and one 20% case. This does not show a broad empirical complementarity advantage for exhaustive over single-repair greedy on these grids.
- B0 outperformed B3 in **two** of the 80 grid comparisons. A random baseline is not a guaranteed lower bound.
- B2 had lower mean gain than B1 at 20% and 50%. Its fixed proxy is not uniformly stronger than severity-first ranking.

Mean gains across all four budgets, shown only as descriptive generator behavior:

| Grid / spatial clustering | B0 | B1 | B2 | B3 | Exhaustive |
|---|---:|---:|---:|---:|---:|
| 3×3 / 0 | 0.4875 | 0.9750 | 0.9750 | 0.9750 | 0.9750 |
| 3×3 / 1 | 11.0750 | 5.0500 | 5.0500 | 10.0750 | 11.0750 |
| 4×4 / 0 | 14.2750 | 29.6625 | 28.6875 | 42.4750 | 43.4500 |
| 4×4 / 1 | 9.4875 | 22.4500 | 18.8000 | 30.7750 | 30.7750 |

Clustering does not consistently increase gains or the exhaustive-over-B3 advantage across the two sizes. There is no H2 correlation test or causal conclusion here.

## Performance across mobility profiles

At the 20% budget, mean modeled gain over the same 20 grid instances is:

| Method | Wheelchair contribution | Low-vision contribution | Pedestrian contribution | Total |
|---|---:|---:|---:|---:|
| B0 | 1.5500 | 5.8625 | 0.0000 | 7.4125 |
| B1 | 18.5000 | 2.9875 | 0.6750 | 22.1625 |
| B2 | 15.9750 | 2.9875 | 0.6750 | 19.6375 |
| B3 | 23.5750 | 10.5000 | 0.6750 | 34.7500 |
| Exhaustive | 23.5750 | 11.5000 | 0.6750 | 35.7500 |

This is a breakdown of a weighted objective, not evidence of equitable service to real disability populations. No fairness constraint or demographic validation was used. Per-profile gains at every other budget are preserved in the artifacts.

## Complementary-repair fixture

The corridor has nodes `a–b–c`, two 25 m edges, and one impassable step on each edge for the wheelchair profile. Each repair costs 10. One origin has weight 10, one clinic has weight 2, and wheelchair/pedestrian profiles each have weight 0.5. Both profiles use threshold 100 m; the pedestrian profile ignores steps in this deliberately simplified fixture.

Baseline access is `0.5 × 10 × 2 = 10` from the pedestrian profile. Either repair alone yields zero additional access. Both together unlock another `0.5 × 10 × 2 = 10` from the wheelchair profile.

| Allowed budget | B0 gain / spend | B1 gain / spend | B2 gain / spend | B3 gain / spend | Exhaustive gain / spend |
|---|---|---|---|---|---|
| 10 (50%) | 0 / 10 | 0 / 10 | 0 / 10 | 0 / 0 | 0 / 0 |
| 20 (100%) | 10 / 20 | 10 / 20 | 10 / 20 | 0 / 0 | 10 / 20 |

At budget 20, B3's optimality gap is 1.0; exhaustive and B0–B2 have gap 0.0. At budget 10 the optimum is zero, so all relative gaps are undefined/null. This verifies the intended failure mode; it is a planted example, not a population-level superiority result. In particular, per-defect baselines also succeed when the budget buys both repairs.

## Runtime observations and reproducibility limits

Captured environment: Python **3.13.15**, NetworkX **3.6.1**, engine **0.1.0**, macOS **26.6.2**, ARM64, **8 logical CPUs**. The OS did not permit the attempted CPU-model/memory query; a more specific hardware model was not established. Run the locked environment for dependency reproduction.

Observed single-run wall-clock durations across the 80 grid rows per method:

| Method | Median runtime (ms) | Maximum runtime (ms) |
|---|---:|---:|
| B0 | 0.973 | 2.145 |
| B1 | 0.774 | 2.205 |
| B2 | 0.863 | 1.490 |
| B3 | 4.313 | 77.140 |
| Exhaustive | 6.167 | 556.904 |

Grid runs were executed sequentially. Runtime includes selection and a final shared-evaluator pass. Existing B3/exhaustive `solve()` additionally generates removal explanations and reruns cost-stability searches; B0–B2 return ranking portfolios without those extra outputs. Consequently, these are **end-to-end implementation timings with unequal auxiliary work**, not isolated algorithm-speed comparisons. There were no repeated timing trials, warm-up controls, or guarantees about other system load. No scalability or real-world response-time claim follows from these tiny instances.

The CLI preserves complete protocol/environment metadata and refuses to overwrite existing output. Seeded non-timing row equality, metric arithmetic, budget feasibility, the corridor failure case, and JSON persistence are tested. All **155 pytest tests passed**, with **98.87% package statement coverage**; strict mypy, Ruff lint, and Ruff format checks passed for the implemented state.

## What this says about H1–H4

**H1 is not proven, and was not tested as specified.** P2 is not implemented; exhaustive is a correctness reference, not a substitute for the proposed algorithm. Only five seed blocks and tiny artificial grid families were used. The 5/10/20% cells include **52 of 60** instance/budget cases where the best B1/B2 gain is zero. Every grid instance has an undefined relative improvement at its 5% budget, so no complete three-budget per-instance relative-improvement statistic exists for this run. No epsilon, favorable exclusion, p-value, or 15% threshold claim was used. Arithmetic mean absolute gains above must not be read as the pre-specified median relative H1 statistic.

**H2:** spatial clustering is configurable, but no validated path-based clustering index, correlation inference, or P2 comparison exists. **H3:** barrier presence was deterministic, so uncertainty/generalization was not evaluated. **H4:** profile breakdowns do not implement an equity constraint or measure fairness cost.

The immediate result is a reproducible synthetic test harness and published exploratory evidence, including the many null outcomes. Real-world performance, calibrated mobility parameters, municipal baseline validity, and the research hypotheses remain unresolved.
