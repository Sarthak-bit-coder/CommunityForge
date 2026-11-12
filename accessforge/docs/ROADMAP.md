# Roadmap

Phases are gated by acceptance criteria, not dates. No phase is "done" until all of its criteria hold.

## Phase 0: Research and foundation (current)
**Owner:** Claude Code
- [x] Competitor and prior-work analysis with evidence tags (`docs/COMPETITOR_ANALYSIS.md`)
- [x] Falsifiable research hypothesis, algorithms, baselines, and metrics (`docs/RESEARCH_HYPOTHESIS.md`)
- [x] Product requirements (`docs/PRODUCT_REQUIREMENTS.md`)
- [x] Architecture and engine contract (`docs/ARCHITECTURE.md`)
- [x] Repository conventions and agent ownership (`AGENTS.md`, `docs/AGENT_OWNERSHIP.md`)

**Acceptance:** all documents exist with no placeholders, every external claim is tagged, and the open questions are listed.

## Phase 1: Engine prototype on synthetic data
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

**Acceptance:** PostGIS schema migrated with up/down tests; the pilot network is a single connected component or has documented, justified components; ≥ 1 source of barriers loaded with provenance; the data catalog lists the license of every source; discovery notes exist; P2 is benchmarked against the MILP.

## Phase 3: MVP web application
**Owner:** Claude Code. Codex: P3 (SAA, value of verification) and P4 (equity).
- Features F1–F9 from PRODUCT_REQUIREMENTS.md, plus the worker, scenario jobs, and the engine adapter.

**Acceptance:** WCAG 2.2 AA with zero critical or serious axe issues plus manual screen-reader passes; E2E tests for UC1–UC8; role-based authorization tests; a security review passed; disclaimers present on all result and export surfaces.

