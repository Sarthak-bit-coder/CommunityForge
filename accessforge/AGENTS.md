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

