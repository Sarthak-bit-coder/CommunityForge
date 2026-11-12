# AGENTS.md: Repository Conventions for AccessForge AI

Read this file, `docs/AGENT_OWNERSHIP.md`, and `docs/ARCHITECTURE.md` before changing anything.

## Project status
Phase 0 (research and documentation) is complete. There is no application code yet. See `docs/ROADMAP.md` for the current phase and its acceptance criteria.

## Ownership
Every path has one owner (Claude Code or Codex). See `docs/AGENT_OWNERSHIP.md`. Write only to paths you own. The engine contract (`docs/ARCHITECTURE.md` §3) changes only through the documented process.

## Truthfulness rules (apply to code, docs, and UI copy)
- Never fabricate research findings, citations, partnerships, user interviews, measured outcomes, or benchmarks.
- Tag external claims in docs as [V] verified, [S] secondary, or [U] unverified (see `docs/COMPETITOR_ANALYSIS.md`).
- Label model outputs as **modeled/estimated**. Never present them as official inspections, compliance determinations, or safe routes.
- Report negative experimental results.

## Languages and layout
| Area | Stack | Path |
|---|---|---|
| Web | Next.js (App Router) + TypeScript (strict) | `apps/web/` |
| API + worker | Python + FastAPI, SQLAlchemy 2 + GeoAlchemy2, Alembic | `services/api/` |
| Engine | Python, NetworkX, NumPy, SciPy | `services/engine/` (`accessforge_engine`) |
| Experiments | Python | `experiments/` |
| Ingestion | Python | `pipelines/ingest/` |
| Database | PostgreSQL + PostGIS | migrations in `services/api/` |

## Coding conventions
- Immutable data: frozen dataclasses or Pydantic models. Return new objects rather than mutating inputs.
- Small, focused files (≈200–400 lines, 800 max) and functions (< 50 lines). Organize by feature or domain.
- Validate at boundaries (API requests, ingested files, engine `ProblemInstance`). Fail fast with clear errors and never swallow exceptions.
- No magic numbers. Thresholds and defaults are named constants or validated config.
- Python: type hints everywhere, `ruff` for lint and format, `mypy --strict` for the engine. TypeScript: `strict: true`, ESLint, Prettier.
- Geometry: store EPSG:4326 and compute lengths in EPSG:32610 (Fremont).
- Every stochastic function takes an explicit `seed`.
- No secrets in code. Use environment variables, validated at startup.
- Do not add dependencies without a one-line justification. Prefer the standard library and already-chosen libraries.

## Testing requirements
- Write tests first where practical (red → green → refactor).
- Coverage of at least 80% per package.
- The engine needs unit tests with hand-computed expected values, property-based tests (Hypothesis) for invariants, and determinism tests.
- The API needs unit tests plus integration tests against a real PostGIS container (no DB mocks for repositories), and authorization tests per role.
- The web app needs component tests (Vitest + Testing Library), E2E tests (Playwright), and automated accessibility checks (axe) on every page. Manual screen-reader checks happen before each release.
- Use the Arrange-Act-Assert pattern and descriptive test names.

## Accessibility (non-negotiable)
WCAG 2.2 AA. Every map has an equivalent list or table. Full keyboard support. Never use color as the only encoding. See `docs/PRODUCT_REQUIREMENTS.md` §6.

## Privacy
Photos are visible only to verifiers in the MVP, with EXIF stripped. Store no individual disability data. Reporter identity is never public or exported. See `docs/PRODUCT_REQUIREMENTS.md` §8.

