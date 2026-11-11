# Architecture

Status: Phase 0 proposal. Nothing is implemented yet. Versions are pinned when each component is first implemented. This document names technologies, not version numbers.

## 1. Principles

- **Engine as a pure library.** The optimization engine is a Python package with no web, database, or network I/O. It takes plain data in and returns plain data out. This makes it testable, lets Codex own it independently, and lets the API swap storage without touching algorithms.
- **Few moving parts.** One web app, one API service, and one database. Background jobs use a Postgres-backed queue, not a separate broker. Add infrastructure only when measured load requires it.
- **Provenance everywhere.** Every barrier, repair, and result row records its source, its time, and the parameters that produced it.
- **Accessibility and privacy are architectural constraints**, not later polish (PRODUCT_REQUIREMENTS.md §6, §8).

## 2. Components

```
                ┌──────────────────────────────┐
 Browser ──────►│ apps/web  (Next.js + TS)     │  SSR pages, MapLibre map, accessible list views
                └──────────────┬───────────────┘
                               │ HTTPS JSON (OpenAPI-typed client)
                ┌──────────────▼───────────────┐
                │ services/api (FastAPI)       │  auth, validation, CRUD, scenario jobs
                │  ├─ routers / schemas        │
                │  ├─ repositories (SQLAlchemy │
                │  │   + GeoAlchemy2)          │
                │  └─ worker (same codebase,   │──► imports accessforge_engine
                │      separate process)       │
                └──────────────┬───────────────┘
                               │ SQL
                ┌──────────────▼───────────────┐
                │ PostgreSQL + PostGIS         │  network, barriers, repairs, scenarios, jobs, audit
                └──────────────────────────────┘
                ┌──────────────────────────────┐
                │ services/engine              │  pure Python: NetworkX graphs, metrics, optimizers
                │ (accessforge_engine package) │  no I/O; owned by Codex
                └──────────────────────────────┘
                ┌──────────────────────────────┐
                │ pipelines/ingest (Python)    │  OSM / city GIS / Project Sidewalk / ACS → PostGIS
                └──────────────────────────────┘
   Future:      services/vision (CV inference) ──► writes barrier *candidates* via API only
```

### 2.1 `apps/web`: Next.js + TypeScript
- App Router with server components for public pages, so barrier lists render without JS-dependent maps.
- **MapLibre GL JS** for maps. It is open source (BSD-3), which avoids proprietary map SDK terms. Basemap tiles come from a provider whose terms allow this use (chosen in Phase 3; OSM-based).
- Every map component has a paired list/table component that shares the same query hook.
- The API client is generated from FastAPI's OpenAPI schema, so there are no hand-written request types.
- Testing: Vitest + Testing Library for units, Playwright + axe for E2E and accessibility.

### 2.2 `services/api`: Python + FastAPI
- Pydantic models validate every request at the boundary. Geometry inputs are validated for type, coordinate range, and pilot-area bounds.
- Repository pattern over SQLAlchemy 2 + GeoAlchemy2 with parameterized queries only. Alembic handles migrations.
- **Worker process:** polls a `jobs` table (`SELECT … FOR UPDATE SKIP LOCKED`), builds engine inputs from PostGIS, calls the engine, and stores results. This avoids Redis and Celery until there is evidence they are needed.
- Testing: pytest, plus integration tests against a real PostGIS container. No DB mocks for repository tests.

### 2.3 PostgreSQL + PostGIS
Core tables (an outline; the final schema arrives in Phase 2 migrations):

| Table | Key columns |
|---|---|
| `network_node` | id, geom (Point, EPSG:4326), kind (junction, curb_ramp, crossing_end), source |
| `network_edge` | id, from_node, to_node, geom (LineString), length_m, incline, width_m, surface, kind (sidewalk, crossing, footway), source, source_version |
| `barrier` | id, geom, edge_id/node_id, type, severity, state, presence_prob, source, source_ref, created_at |
| `barrier_event` | barrier_id, from_state, to_state, actor_id, photo_id, note, at (append-only audit) |
| `repair_candidate` | id, barrier_ids[], type, cost_estimate, cost_low, cost_high, cost_source |
| `destination` | id, geom, category, weight, source |
| `origin` | id (census block), geom, population, disability_est, source_year |
| `scenario` | id, owner_id, params (JSONB, validated), engine_version, created_at |
| `job` | id, scenario_id, status, attempts, error, timestamps |
| `scenario_result` | scenario_id, method, selected_repairs, delta_a, metrics (JSONB), explanations (JSONB) |
| `report` | id, barrier_id, description, photo_id, contact (nullable, retention-limited) |
| `app_user` | id, role (contributor, verifier, planner, admin), auth fields |

- Spatial indexes (GiST) on all geometries. Store data in EPSG:4326, and compute metric lengths in a projected CRS (UTM 10N, EPSG:32610, for Fremont).

### 2.4 `services/engine`: `accessforge_engine` (pure Python)
- **NetworkX** for graph construction and shortest paths in Phase 1. If profiling on Fremont-scale graphs shows NetworkX is the bottleneck, evaluate igraph or rustworkx behind the same interface. Do not switch preemptively.
- **NumPy** for scenario sampling. **SciPy** (`scipy.optimize.milp`, HiGHS) for exact small-instance baselines only. No other optimization dependency unless HiGHS proves insufficient (RESEARCH_HYPOTHESIS.md §4).
- Deterministic: every stochastic function takes an explicit seed.

### 2.5 `pipelines/ingest`
- Batch scripts, run by hand at first, that load sources into PostGIS with source, version, and license metadata. Candidate sources: OSM extracts (ODbL), City of Fremont open data (license to be verified), Project Sidewalk API (if a Fremont deployment exists), US Census ACS 5-year (disability table S1810) and block-level population, and destination POIs (OSM and city facility lists).
- A data catalog (`docs/DATA_CATALOG.md`, Phase 2) records each source's license, version, and refresh date.

