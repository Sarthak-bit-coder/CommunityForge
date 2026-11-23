# Roadmap

Phases are gated by acceptance criteria, not dates. No phase is "done" until all of its criteria hold.

## Phase 0: Research and foundation (done)
**Owner:** Claude Code
- [x] Competitor and prior-work analysis with evidence tags (`docs/COMPETITOR_ANALYSIS.md`)
- [x] Falsifiable research hypothesis, algorithms, baselines, and metrics (`docs/RESEARCH_HYPOTHESIS.md`)
- [x] Product requirements (`docs/PRODUCT_REQUIREMENTS.md`)
- [x] Architecture and engine contract (`docs/ARCHITECTURE.md`)
- [x] Repository conventions and agent ownership (`AGENTS.md`, `docs/AGENT_OWNERSHIP.md`)

**Acceptance:** all documents exist with no placeholders, every external claim is tagged, and the open questions are listed.

## Phase 1: Engine prototype on synthetic data (done: 155 engine tests, 98.9% coverage, 2026-11-17)
**Owner:** Codex (engine). Claude Code: evidence-gap research in parallel.
- `accessforge_engine` package: contract types, graph builder, profile costs, accessibility metric A, scenario sampler, B0–B3, P1, `evaluate`.
- Synthetic instance generator with controllable size, barrier density, and **barrier clustering**.
- Claude Code resolves COMPETITOR_ANALYSIS.md gaps 1–2 (vendor prioritization logic, the 2024 PLOS ONE paper) and updates the docs.

**Acceptance:**
- `pytest` passes, with engine coverage ≥ 80%.
- Hand-computed tests: on ≥ 3 small graphs, A and ΔA match manual calculations exactly.
- A property test checks that ΔA is never negative when repairs only remove barriers.
- A complementarity test: a constructed instance where B3 picks zero-value repairs and an exhaustive search finds the two-repair bundle.
- Determinism: same seed gives identical output.

## Phase 2: Fremont data foundation and discovery
**Owner:** Claude Code (ingest, DB, API skeleton). Codex: P2 bundles + MILP benchmark.
- Choose a pilot area of a few km² using documented criteria: mixed land use, presence of essential destinations, data availability, and equity considerations.
- Ingest the OSM network for the pilot area, assess its coverage against imagery, and record gaps. Evaluate Tile2Net or city GIS as a fallback.
- Ingest ACS disability and population data and destination POIs.
- A structured team barrier audit of the pilot area, with photos and a documented protocol. Contact Project Sidewalk about a possible Fremont deployment.
- Discovery: request conversations with Fremont staff and local disability organizations. Record findings in `docs/DISCOVERY.md`, including what we **could not** confirm.
- Codex: P2 bundle generation, the exact MILP on small instances, and optimality-gap measurement.

**Status (2026-11-17): partly done.**
- [x] Pilot area chosen with documented criteria (`docs/PILOT_AREA.md`).
- [x] OSM network, destinations, 2020 Census population and CDC PLACES disability share ingested (`pipelines/ingest`). Coverage gaps recorded.
- [x] Migration `0004_network` with up/down tests. The network is loaded as its largest connected component, and the dropped pieces are documented.
- [x] Barrier source with provenance: 20 OSM `kerb=raised` nodes, as unverified `open_map_data` evidence.
- [x] Data catalog with licenses (`docs/DATA_CATALOG.md`).
- [x] Discovery notes exist (`docs/DISCOVERY.md`). They record that **no conversations have happened yet**.
- [x] Origins and destinations snap to the nearest routable node within 200 m (2026-11-18). Before that, exact-position matching linked 0 of 53 census blocks.
- [x] First modeled pilot finding, from unverified OSM curbs (`docs/PILOT_FINDING.md`).
- [x] The planner and route analysis run on the Fremont pilot network (dataset `fremont_pilot`, default in the UI). Repairs cost one repair unit each. Budgets are limited to 0 to 2 units because exhaustive search does not finish at 3. Plans are precomputed when the API starts.
- [ ] OSM coverage checked against imagery (needs a person).
- [ ] Team field audit with photos. The protocol is drafted (`docs/AUDIT_PROTOCOL.md`); the audit itself has not been done.
- [ ] Contact Fremont staff, disability organizations and Project Sidewalk.
- [ ] Codex: P2 bundles and MILP benchmark.

**Acceptance:** PostGIS schema migrated with up/down tests; the pilot network is a single connected component or has documented, justified components; ≥ 1 source of barriers loaded with provenance; the data catalog lists the license of every source; discovery notes exist; P2 is benchmarked against the MILP.

## Phase 3: MVP web application
**Owner:** Claude Code. Codex: P3 (SAA, value of verification) and P4 (equity).
- Features F1–F9 from PRODUCT_REQUIREMENTS.md, plus the worker, scenario jobs, and the engine adapter.

**Acceptance:** WCAG 2.2 AA with zero critical or serious axe issues plus manual screen-reader passes; E2E tests for UC1–UC8; role-based authorization tests; a security review passed; disclaimers present on all result and export surfaces.

## Phase 4: Evaluation
**Owner:** Codex (experiments). Claude Code: reporting UI and write-up.
- Pre-registered experiment configs, then run H1–H4 on synthetic, external (Project Sidewalk city), and Fremont pilot instances.

**Acceptance:** all pre-registered results are reported, including negative ones, in `docs/engine/RESULTS.md`, with reproducible configs and seeds.

## Phase 5: Verification loop pilot
- Train volunteer verifiers on the documented protocol. Run the report → verify → plan → repair-tracking loop in the pilot area.

**Acceptance:** PRODUCT_REQUIREMENTS.md §10 data-quality and outcome-loop metrics are measured and reported.

## Phase 6: Computer vision candidates (post-MVP)
- `services/vision` using licensed imagery, evaluating existing open models first.

**Acceptance:** per-type precision, recall, and calibration on held-out, verified Fremont samples, published before any CV candidate enters planning.

## Phase 7: Multi-community scaling
- Multi-tenant areas, an onboarding playbook, and evaluation of graph-library performance at city scale.

**Acceptance:** a second community onboarded using the documented playbook without code changes to the engine.
