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
| `destination` | id, geom, category, name, weight, node_id, source_id, source_ref |
| `origin` | id (census block), geom, population, disability_rate (modeled, nullable), node_id, source_id, disability_source_id |
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

## 3. Engine contract (shared interface)

This contract is the **only** coupling between the API (Claude Code) and the engine (Codex). Changing it requires updating this section and following the process in AGENT_OWNERSHIP.md.

```python
# accessforge_engine.contract  (frozen dataclasses; all ids are str)

Edge(id, u, v, length_m, attrs: Mapping[str, float | str])
Barrier(id, edge_id | None, node_id | None, type, severity: int, presence_prob: float)
Repair(id, barrier_ids: tuple[str, ...], cost: float, cost_low: float, cost_high: float)
Profile(id, weight: float, max_incline: float | None, impassable_types: frozenset[str],
        penalties: Mapping[str, float], threshold_m: float)
Origin(id, node_id, weight: float, group: str)       # group = e.g. census tract
Destination(id, node_id, category: str, weight: float)

ProblemInstance(edges, barriers, repairs, profiles, origins, destinations, nodes)
SolveParams(budget: float, method: str, n_scenarios: int, seed: int,
            equity: EquitySpec | None, time_limit_s: float)

solve(instance: ProblemInstance, params: SolveParams) -> SolveResult
SolveResult(method, selected_repair_ids, total_cost, delta_a_expected,
            delta_a_by_profile, delta_a_by_group, explanations: tuple[Explanation, ...],
            diagnostics: Mapping[str, float], engine_version: str)
Explanation(repair_id, marginal_delta_a, profiles_benefiting, destination_categories,
            bundle_id | None, complementary_repair_ids, stable_under_cost_perturbation: bool)

evaluate(instance, selected_repair_ids, params) -> metrics   # used for before/after and baselines
```

Errors: `InvalidInstanceError` for dangling ids, negative costs, or probabilities outside [0, 1]. The engine never returns partial results silently.

**Proposed change (2026-11-17, Claude Code, awaiting maintainer approval):** route analysis in `services/api/accessforge_api/routing_core.py` calls `networkx.single_source_dijkstra` on `build_graph` output to get a path, its edges and its cost. Path finding is not in the contract. Proposed: add `route(instance, origin_id, destination_id, profile_id, *, present_barrier_ids) -> RouteResult | None` to `accessforge_engine`, returning node IDs, edge IDs, generalized cost and length, with the same threshold cutoff as `evaluate`. Codex would own it, and the API would then drop its networkx import. Until approved, the API keeps the current call.

## 4. Data flow

1. **Ingest** → PostGIS (network, origins, destinations, initial barriers), with provenance.
2. **Reports and verification** → `report`, `barrier`, `barrier_event` through the API.
3. **Scenario run:** a planner POSTs `/scenarios`. The API validates and inserts a `scenario` and a `job`. The worker loads an instance (bounded by the pilot area), maps states to `presence_prob`, calls `solve` for the requested method plus baselines B1–B3, and writes `scenario_result`. The web app polls the job status.
4. **Outcome loop:** a repair is marked `repair_completed`, then a verifier marks it `resolved`. `evaluate` is re-run on the current network and the modeled before/after is stored.
5. **Export:** the API streams GeoJSON or CSV with a provenance header.

## 5. API boundaries (MVP outline, `/api/v1`)

| Method & path | Role | Purpose |
|---|---|---|
| GET `/barriers?bbox&type&state&source` | public | List barriers (paginated, bbox required, max area enforced) |
| GET `/barriers/{id}` | public | Detail + public history (no reporter identity) |
| POST `/reports` | public (rate-limited) | Submit a report |
| POST `/barriers/{id}/transitions` | verifier, admin | State change with photo or note |
| POST `/photos` | contributor+ | Upload (size/type limits, EXIF stripped, private bucket) |
| GET/POST `/scenarios` | planner | Create or list scenarios |
| GET `/scenarios/{id}` | planner (public if published) | Params, job status, results |
| GET `/verification-queue` | verifier | Ranked by value of verification |
| PATCH `/repairs/{id}` | planner | Update repair status |
| GET `/exports/{kind}` | public / planner | GeoJSON or CSV export |

The response envelope is `{ "data": …, "error": null | {code, message}, "meta": {page, limit, total} }`.

## 6. Deployment

- **Local:** Docker Compose with `db` (PostGIS image), `api`, `worker`, and `web`. Seed scripts load a small synthetic plus pilot-area fixture.
- **Hosted (Phase 3+), proposed:** managed Postgres with PostGIS; the API and worker as containers on one platform (for example a container PaaS); the web app on a Next.js-capable host; photos in private object storage with signed URLs. The final provider choice depends on cost and on the city's data-hosting requirements, which are unknown.
- **CI:** lint, type-check (mypy/pyright, tsc), unit and integration tests, axe checks, and Alembic migration up/down tests on PostGIS.
- **Environments:** local, staging, production. Production data never copies to local without anonymization.

## 7. Security

- **AuthN:** email magic link or OIDC for staff accounts. Anonymous reporting has no account. Sessions use HTTP-only, Secure, SameSite=Lax cookies.
- **AuthZ:** role checks enforced in the API on every mutating route, with tests per role. Verification transitions are append-only and audited.
- **Input validation:** Pydantic schemas, geometry bounds checks, scenario parameter bounds (budget, n_scenarios, time limit) to prevent resource exhaustion, and upload MIME sniffing with size limits.
- **Rate limiting** on public POST routes and expensive GETs. Scenario jobs have a per-user concurrency cap.
- **Secrets** come from environment or a secret manager only. Startup fails if required secrets are missing.
- **CSRF** protection on cookie-authenticated mutations. Strict CORS allow-list. Security headers and CSP on the web app.
- **XSS:** no raw HTML from user content. Descriptions render as text.
- **Dependencies:** a lockfile per package and automated vulnerability scanning in CI.
- **Logging:** structured logs with no reporter contact data or photos, and IPs truncated after the rate-limit window.

## 8. Future computer vision service (not in MVP)

- `services/vision`: a separate service that runs barrier detection on imagery the project is licensed to process (for example Mapillary CC BY-SA, or city-owned imagery). It would evaluate open models from the Project Sidewalk team (ASSETS 2024 dataset/models) before training anything new.
- It writes **barrier candidates** through the public API with `source=cv:<model>@<version>` and a calibrated `presence_prob`. It never writes directly to the database and never sets a verified state.
- Calibration and per-type precision/recall must be measured on held-out, human-verified Fremont samples before CV candidates may enter planning scenarios.

## 9. Repository layout (target)

```
apps/web/                 Next.js app                    (Claude Code)
services/api/             FastAPI app + worker           (Claude Code)
services/engine/          accessforge_engine + tests     (Codex)
experiments/              configs, runners, results      (Codex)
pipelines/ingest/         data ingestion scripts         (Claude Code)
docs/                     product & architecture docs    (Claude Code; Codex owns docs/engine/)
infra/                    compose, CI                    (Claude Code)
```
