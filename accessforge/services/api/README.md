# AccessForge API foundation

FastAPI, SQLAlchemy 2, GeoAlchemy2 and Alembic. This package exposes health checks and anonymous report submission/retrieval. Authentication, photo uploads, verification transitions, and optimization integration are absent.

## Local setup

From `services/api/`:

```sh
uv sync --extra dev
cp .env.example .env
# Replace the placeholder database user/password/host in .env.
uv run alembic upgrade head
uv run uvicorn accessforge_api.main:create_app --factory --host 127.0.0.1 --port 8000 --no-proxy-headers
```

`DATABASE_URL` must be an explicit `postgresql+psycopg://…` URL with a host and database. There is no credential fallback. Settings are frozen, loaded from environment or local `.env`, validated at application startup and migration execution, and redact input values in configuration errors. `LOG_LEVEL` accepts DEBUG/INFO/WARNING/ERROR and defaults to INFO. `.env.example` contains placeholders only; local environment files are ignored.

The database must support PostgreSQL 16/PostGIS 3, and the migration account must be allowed to create tables and, if needed, the PostGIS extension. Provision PostGIS in the public schema before migrations when the runtime/migration account lacks extension-creation privileges. Keep elevated migration credentials separate from runtime credentials in deployed environments.

Startup creates a lazy connection pool, not tables. It does not require a live database or run migrations automatically. Connections use a 5-second connection timeout, 2-second statement timeout, pre-ping, and redacted SQL parameters. Sessions close/roll back on dependency exit; there is no automatic commit. Shutdown disposes the engine.

## Structure and storage

- `accessforge_api/main.py`: application factory and lifecycle.
- `config.py`, `database.py`: validated environment and connection/session boundaries.
- `models.py`, `schemas.py`: constrained storage and frozen Pydantic domain inputs.
- `health.py`, `responses.py`, `errors.py`, `logging.py`: health routes, envelopes, safe errors, JSON application logs.
- `migrations/`: explicit schema snapshots; no dependence on future ORM definitions inside revision scripts.

The initial schema has three tables:

| Table | Purpose and invariants |
|---|---|
| `location` | UUID and nonempty 2D PostGIS POINT in EPSG:4326, world coordinate bounds, GiST spatial index. |
| `barrier` | Location foreign key, defined barrier type, nonblank description up to 2,000 characters, severity 1–5, presence probability 0–1, defined verification state (default unverified), UTC-capable creation timestamp. |
| `evidence_provenance` | Barrier foreign key, defined source kind, nonblank source record reference, optional source version, timezone-aware observation and recording timestamps. |

Foreign keys restrict deletion of referenced rows. Application timestamps use PostgreSQL `timestamptz`. Domain inputs reject unknown fields, invalid coordinate ranges, nonfinite numbers, invalid types/statuses, and naive evidence timestamps. The location validator checks world bounds only: pilot-area geometry is not established in this repository, so pilot-bound validation is not claimed. Metric lengths, when introduced, must be computed in EPSG:32610; this foundation stores points only.

Provenance references are opaque source record references, not reporter identities or public photo URLs. No reporter-contact, disability-status, or photo-storage fields are present. Submission writes community-report provenance; no state-change routes exist. An internal append-only review audit now exists (see below); authentication and authorization still block HTTP status transitions. Privileged database administration can bypass application workflows.

## HTTP behavior

- `GET /health/live`: 200 when the process can serve a request; performs no database query.
- `GET /health/ready`: 200 only after successfully querying `PostGIS_Version()`; otherwise 503 with a sanitized database-unavailable error. It checks connectivity/PostGIS, not migration revision or all business tables.
- Standard FastAPI OpenAPI/docs endpoints remain available; report routes are described below.

Success uses `{"data":{"status":"ok"},"error":null,"meta":{}}` (readiness status is `ready`). Failures use the same envelope with `data:null` and a structured error code/message/details. Validation errors include field/message pairs, not rejected input values. Unknown paths, HTTP errors, database failures, and unexpected errors have sanitized responses. Every response has a generated `X-Request-ID`; client-supplied IDs are not trusted. Application logs are JSON and never include request bodies, SQL statements, credentials, or raw exception strings. This is not a completed deployment/security/authentication layer.

## Reports

Run `alembic upgrade head` before serving requests. Revision `0002_reports` adds a report table linked to the existing barrier table, preserving the original description and creation timestamp.

- `POST /reports`: returns 201 with a report envelope and `Location` header.
- `GET /reports?page=1&limit=20&type=obstruction&state=unverified`: optional type/state filters and pagination metadata (`page`, `limit`, filtered `total`).
- `GET /reports/{id}`: details or sanitized 404; invalid UUIDs/inputs return 422.

Example submission:

```json
{
  "type": "obstruction",
  "description": "Example barrier",
  "severity": 3,
  "location": {"longitude": -121.9886, "latitude": 37.5485}
}
```

Descriptions are trimmed, nonblank, and limited to 2,000 characters. Coordinates must be finite and within world bounds. Types use the existing enum. Severity is required (integer 1–5) by the existing barrier model, not inferred. Unknown fields, including client-supplied state, identity, or provenance, are rejected.

One transaction creates the location, unverified barrier, report, and `community_report` provenance. `unverified` means pending verification. The stored presence probability 0.5 is an **assumed, uncalibrated modeled prior**, not measured confidence or an official assessment. Provenance references the report ID. Its observation timestamp means submission receipt, not field verification; creation/recording timestamps are database-generated. Original report descriptions survive later barrier description changes.

Lists sort newest first by creation timestamp and UUID. Pages range from 1–10,000; limits from 1–100 (default 20). Valid pages beyond the last result return an empty list. Offset pagination provides no stable snapshot during concurrent writes. Routes use root `/reports`; the future `/api/v1` prefix is not introduced here.

Submissions allow 10 attempts per 60 seconds per ASGI peer, returning 429 and `Retry-After` when exceeded. Tracking is bounded and process-local; inactive buckets are pruned on subsequent requests. Addresses are not persisted or logged by the application. The local command disables proxy headers; deployments behind proxies must configure trusted peers and use a shared perimeter limiter before scaling across workers.

Downgrading to `0001_foundation` deletes report rows only, preserving barrier/location/provenance. Re-upgrading cannot reconstruct deleted reports. No authentication, contact collection, photos, or frontend integration is included.

## Checks

```sh
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run mypy accessforge_api migrations
```

The default test command enforces at least 80% package statement coverage. Unit tests exercise health behavior without a running database, configuration/Pydantic failures, error sanitization, logging, offline migration SQL, and schema metadata. A failed real connection to an unreachable local test endpoint exercises the readiness failure path; HTTP report tests stub repository functions for transport checks only, not persistence proof. Repository behavior uses real PostGIS tests, never SQLite or database mocks.

## Real PostGIS integration tests

A Docker daemon is required for the provided disposable database. From `services/api/`:

```sh
export POSTGRES_PASSWORD="$(openssl rand -hex 24)"
export TEST_DATABASE_URL="postgresql+psycopg://accessforge_test:${POSTGRES_PASSWORD}@127.0.0.1:55432/accessforge_test"
docker compose -f compose.test.yaml up -d --wait
uv run pytest
# After the test run, stop only this dedicated disposable service:
docker compose -f compose.test.yaml down
unset TEST_DATABASE_URL POSTGRES_PASSWORD
```

The Compose service binds only loopback and stores test data in tmpfs. It must never be pointed at production data. Use the configured ephemeral password only for this local service. On hosts without native support for the selected PostGIS image, configure the Docker platform/emulation appropriate to the host.

`TEST_DATABASE_URL` is deliberately opt-in and must use psycopg with a database name ending `_test`. Tests require installed PostGIS and create a fresh random schema per test. They migrate that schema, use a real database for spatial persistence, constraints, foreign keys, metadata comparison, readiness success, and an upgrade → downgrade → upgrade cycle, then remove only their generated schema. Existing public application tables are not dropped. Missing test configuration causes explicit skips; a configured but unreachable/misconfigured database causes test failures.

The initial `alembic downgrade base` **deletes all five application tables and their data**. It preserves the shared PostGIS extension. Run downgrade only with an approved rollback plan or on the disposable test database; application startup never performs it. This initial additive migration has no existing application readers/writers to transition.

## Internal report review foundations (authentication blocker)

There is **no authentication or staff role system** in this package. Consequently no review write endpoint or private audit endpoint is mounted, including for requests claiming a bearer token or role header. Existing public POST/GET report contracts remain unchanged. Public `state=unverified` means **pending**, `state=confirmed` means **verified**, and `state=rejected` means **rejected**. These aliases reuse the existing verification vocabulary rather than migrating existing state values or breaking clients.

Trusted in-process callers can use `review_repository.review_report(session, report_id, ReviewInput(...), reviewer_id=...)`. `ReviewInput` accepts the decision vocabulary `verified` or `rejected` and a trimmed, nonblank reason of at most 2,000 characters. A `pending` decision is rejected by the transition policy. A reviewer UUID must come from a trusted staff identity; passing a UUID is **not authentication**. Do not wrap this function in an HTTP route until verified authentication, verifier/admin authorization, and identity binding exist. Those missing controls block the requested review endpoints; no substitute shared secret or client-supplied role was added.

Only pending (`unverified`) barriers can transition to `confirmed` or `rejected`. Repeated reviews and reviews of any other lifecycle state raise `ReviewConflict`; missing reports raise `ReportNotFound`. Reopening, appeals, repair transitions, and authentication are outside this slice. Reviews operate on the associated barrier, so reports sharing a barrier share its state. The barrier row is locked and refreshed from the database to serialize competing decisions, including callers holding cached session objects. One transaction updates state and appends a `report_review` record containing report ID, reviewer UUID, previous/new state, reason, and a database-generated timezone-aware review timestamp. An audit insertion failure rolls back the state change. Presence probabilities and original submission provenance remain unchanged: no calibration or new field observation is inferred from a review.

`review_history` is also internal. Reviewer identities and reasons are not included in public report DTOs. Database triggers reject audit UPDATE, DELETE, and TRUNCATE; there is no editing/deletion helper. This protects ordinary writes, not privileged administrators able to disable triggers or drop tables. Existing assessments receive no fabricated retrospective audit entries. Future staff workflows must enforce the documented site-photo or documented-no-photo verification policy before calling the internal operation.

Run `alembic upgrade head` for additive revision `0003_report_reviews`. Downgrading to `0002_reports` **deletes the audit trail** but preserves reports, barriers, and their current verification states; re-upgrading cannot recover deleted reviews. Do not use downgrade as an undo-review operation. Tests cover transition policy, invalid inputs, absent public writes even with spoofed credentials, and offline migration SQL. Real PostGIS tests additionally cover persistence, missing reports, atomic rollback, audit immutability, and competing reviewers; they explicitly skip without `TEST_DATABASE_URL`.
