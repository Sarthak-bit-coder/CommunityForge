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

