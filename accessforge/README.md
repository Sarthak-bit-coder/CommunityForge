# AccessForge AI

AccessForge helps a community map pedestrian accessibility barriers, check them, and choose the **set** of sidewalk repairs that opens the most accessible routes within a budget.

> AccessForge outputs are planning estimates. They are **not** official accessibility inspections, ADA compliance determinations, or safe-route guarantees. AccessForge is an independent project with no partnership with, or endorsement from, the City of Fremont or any other organization.

## The problem

A route is usable only if every piece of it is. Repair lists that rank barriers one at a time cannot see that two repairs may only be worth funding together, so a limited budget can be spent on fixes that open no complete route. AccessForge scores repairs as a group, on the network they sit on, and explains each choice.

## Status (2026-11-17)

| | |
|---|---|
| Barrier reporting, map with an equivalent list, filters | Working. Stored in PostgreSQL/PostGIS |
| Reviewer sign-in, verify/reject with an append-only audit log | Working |
| Report text hidden from the public until a reviewer confirms it | Working |
| Repair planner: budget, four methods compared, explanations, saved scenarios, CSV/JSON/print | Working, **on synthetic networks only** |
| Pilot dashboard: counts by status and type, CSV, anonymous feedback form | Working |
| Fremont network, destinations, population (OSM, Census, CDC PLACES) | Ingested for the pilot area; **not yet connected to the planner** |
| Repair tracking: reviewers move verified barriers through repair planned → repair completed → resolved, each step in the append-only audit log; pilot dashboard counts repairs | Working. Statuses are reviewer records, not City records |
| Real repair costs, photos, equity-targeted planning | Not built |
| Deployment | **Not deployed.** Runs locally |
| Community participation and real-world outcomes | **None yet.** |

## Quick start

Needs Python with [uv](https://docs.astral.sh/uv/), Node.js, and PostgreSQL with PostGIS (see `services/api/.env.example`).

```sh
cd services/api && uv sync --extra dev && uv run alembic upgrade head && uv run uvicorn accessforge_api.main:create_app --factory --port 8000
cd apps/web && npm install && npm run dev   # http://localhost:3000
```

## Layout

| Path | What |
|---|---|
| `apps/web` | Next.js + TypeScript web app (MapLibre map, every map has a matching list) |
| `services/api` | FastAPI, SQLAlchemy, Alembic migrations, PostGIS |
| `services/engine` | `accessforge_engine`: graph model, access metric, optimizers (pure Python, NetworkX) |
| `pipelines/ingest` | Fremont pilot-area data ingestion (OSM, Census, CDC PLACES) |

## Checks

```sh
cd services/engine && uv run pytest
cd services/api && uv run pytest && uv run ruff check . && uv run mypy accessforge_api migrations
cd apps/web && npm run check && npm run build && npm run test:e2e
```

Set `TEST_DATABASE_URL` to include the real-PostGIS API tests; without it they skip.
