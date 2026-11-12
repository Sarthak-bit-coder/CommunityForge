# Agent Ownership

Two coding agents work in this repository: **Claude Code** and **Codex**. Each path has exactly one owner. An agent may **read** anything but may **write** only to paths it owns, except through the change process below.

## Ownership map

| Path | Owner | Notes |
|---|---|---|
| `README.md`, `AGENTS.md` | Claude Code | Codex proposes edits via a note in `docs/engine/HANDOFF.md` |
| `docs/*.md` (top level) | Claude Code | Product, architecture, roadmap, research hypothesis |
| `docs/engine/**` | Codex | Algorithm notes, experiment reports, `HANDOFF.md` |
| `apps/web/**` | Claude Code | Next.js frontend |
| `services/api/**` | Claude Code | FastAPI app, worker, migrations, API tests |
| `pipelines/ingest/**` | Claude Code | Data ingestion |
| `infra/**`, CI config | Claude Code | Codex may request CI jobs for engine tests |
| `services/engine/**` | **Codex** | `accessforge_engine` package and its tests |
| `experiments/**` | **Codex** | Configs, runners, result artifacts, notebooks |
| `docs/ARCHITECTURE.md` §3 (Engine contract) | **Shared** | See change process |

## Responsibilities

**Claude Code** owns:
- product requirements, architecture, roadmap, and documentation;
- the frontend (UX, accessibility conformance, map and list views);
- the backend API, database schema and migrations, auth, the worker, and ingestion pipelines;
- the adapter that turns PostGIS rows into an engine `ProblemInstance` and stores a `SolveResult` (in `services/api`).

**Codex** owns:
- graph construction from contract types, accessibility metrics, and scenario sampling;
- baselines B0–B3, proposed methods P1–P4, and the exact MILP benchmark;
- explanation generation and the engine's validation errors;
- synthetic instance generators, experiment configs, statistical tests, and result reports;
- engine unit tests, property-based tests, and coverage (≥ 80%).

## Engine contract change process

1. The proposing agent writes the proposed change, with a reason, in `docs/engine/HANDOFF.md` (Codex) or as a dated note at the end of ARCHITECTURE.md §3 (Claude Code).
2. The human maintainer approves.
3. Codex updates `accessforge_engine.contract` and the engine tests. Claude Code then updates the API adapter and integration tests. Both changes land together, or with the engine change first in a backward-compatible form.
4. `engine_version` is bumped on every contract change and stored with each scenario result.

