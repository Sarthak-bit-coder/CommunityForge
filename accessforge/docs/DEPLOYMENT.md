# Running and deploying AccessForge

Status on 2026-11-17: the application runs locally and has not been deployed anywhere. Nothing in this document has been exercised on a hosting provider. Treat the production section as a checklist, not a tested runbook.

## 1. What you need

- Python 3.11+ and [uv](https://docs.astral.sh/uv/)
- Node.js 20+ and npm
- Docker (for PostgreSQL 16 + PostGIS 3)

## 2. Local setup

### Database

```sh
cd services/api
export POSTGRES_PASSWORD="$(openssl rand -hex 24)"
docker compose -f compose.test.yaml up -d --wait
# Apple Silicon: the postgis/postgis image has no arm64 build. Prefix the command with
# DOCKER_DEFAULT_PLATFORM=linux/amd64
```

The Compose file starts one disposable PostGIS server on `127.0.0.1:55432` with a database named `accessforge_test`. The integration tests use that database. **Use a separate database for the running app**, because migrating the test database's public schema makes the test fixtures skip their own migrations:

```sh
docker exec api-db-1 psql -U accessforge_test -d accessforge_test -c "CREATE DATABASE accessforge_dev"
docker exec api-db-1 psql -U accessforge_test -d accessforge_dev -c "CREATE EXTENSION IF NOT EXISTS postgis"
```

Data in this container lives in memory (`tmpfs`) and is lost when the container stops.

### API

```sh
cd services/api
uv sync --extra dev
export DATABASE_URL="postgresql+psycopg://accessforge_test:${POSTGRES_PASSWORD}@127.0.0.1:55432/accessforge_dev"
uv run alembic upgrade head
uv run uvicorn accessforge_api.main:create_app --factory --host 127.0.0.1 --port 8000 --no-proxy-headers
```

### Web

```sh
cd apps/web
npm install
cp .env.example .env.local   # API_BASE_URL defaults to http://127.0.0.1:8000
npm run dev                  # http://localhost:3000
```

Open the site at `http://localhost:3000`, not `http://127.0.0.1:3000`: the Next development server refuses its own scripts from an origin it was not started for, and the pages then never finish loading.

## 3. Environment variables

| Variable | Where | Required | Meaning |
|---|---|---|---|
| `DATABASE_URL` | API | yes | `postgresql+psycopg://user:password@host:port/database`. Startup fails without it. |
| `LOG_LEVEL` | API | no | `DEBUG`, `INFO` (default), `WARNING`, or `ERROR`. |
| `REVIEWER_KEYS` | API | no | Comma-separated `reviewer-uuid:sha256-hex-of-key` pairs. Empty means nobody can verify or reject reports. |
| `REVIEWER_COOKIE_SECURE` | API | no | Defaults to `true`. Set `false` only for local HTTP in a browser that drops `Secure` cookies on localhost (Safari). |
| `TRUSTED_PROXY_IPS` | API | no | Comma-separated IPs of the web server(s). Rate limits then use the rightmost `X-Forwarded-For` entry from those peers. **Set it only when an edge proxy that sets `X-Forwarded-For` sits in front of the web app**: Next.js passes a client-supplied `X-Forwarded-For` through unchanged, so without an edge proxy the header is spoofable. Empty (default) means every client behind the web app shares one limit. |
| `TEST_DATABASE_URL` | API tests | no | Enables the real-PostGIS tests. Must name a database ending in `_test`. |
| `API_BASE_URL` | Web (server only) | no | Origin of the API. Read when Next starts or builds. Never sent to the browser. |
| `FEEDBACK_EMAIL` | Web (server only) | no | Address shown on the pilot dashboard. Read at build time. |

No secret belongs in the repository. `.env` files are ignored by git; only `.env.example` files with placeholders are committed.

## 4. Giving someone reviewer access

Each reviewer gets their own key, so the audit log records who decided what.

```sh
KEY="$(openssl rand -hex 32)"                  # give this to the reviewer, once, privately
REVIEWER_ID="$(uuidgen | tr A-Z a-z)"
DIGEST="$(printf '%s' "$KEY" | shasum -a 256 | cut -d' ' -f1)"
echo "${REVIEWER_ID}:${DIGEST}"                # add this to REVIEWER_KEYS and restart the API
```

The API stores and compares only the SHA-256 digest. To remove a reviewer, delete their pair and restart. Keep a private record of which person holds which reviewer UUID; the application does not store names.

Known limits of this scheme:

- There are no reviewer accounts, password resets, or roles beyond "reviewer". Adding or removing a reviewer needs a restart.
- A signed-in browser holds the key in an HTTP-only, `SameSite=Strict`, `Secure` cookie for eight hours. Signing out clears the cookie but does not invalidate the key.
- After ten failed sign-in attempts in a minute from one network peer, further attempts from that peer get `429`, including correct ones. Behind a shared proxy this lockout is shared by everyone. Put per-client rate limiting at the proxy before exposing reviewer sign-in publicly.

## 5. Migrations

```sh
cd services/api
uv run alembic upgrade head      # apply
uv run alembic current           # show the applied revision
```

Downgrades delete data (`0005` drops feedback, `0003` drops the review audit log, `0002` drops reports). Do not run them against real data without a backup.

Read feedback (there is deliberately no API route for it):

```sh
psql "$DATABASE_URL_FOR_PSQL" -c "SELECT created_at, topic, message FROM feedback ORDER BY created_at DESC LIMIT 50;"
```

## 6. Health checks and logs

- `GET /health/live` returns 200 when the API process is serving. It does not touch the database.
- `GET /health/ready` returns 200 only when PostgreSQL with PostGIS answers; otherwise 503.
- API logs are one JSON object per line and never include request bodies, SQL, credentials, or reporter addresses. Every response carries an `X-Request-ID` that also appears in the log line.
- Watch for: `/health/ready` failures, `database_unavailable` and `internal_error` log codes, and bursts of 401 or 429 on `/reviewer/session`.

There is no metrics endpoint, error tracker, or alerting configured.

**Verify a deployment.** The script is read-only and writes nothing:

```sh
scripts/verify-deployment.sh https://WEB_HOST                         # from anywhere
scripts/verify-deployment.sh https://WEB_HOST http://127.0.0.1:8000   # on the API host
```

It checks web → API → database, the pilot and synthetic labels, security headers, that feedback has no read route, that anonymous reads hide pending report text, and HSTS on HTTPS. Then by hand:

1. `uv run alembic current` prints `0005_feedback (head)`.
2. Send one feedback message from `/pilot`, confirm it with the SQL in §5, then delete that row.
3. On a fresh production database `/pilot` shows 0 reports. Never point production at a database used for demos or tests.

**Error monitoring:** none is built in. Minimum for a pilot: alert when the readiness check fails, and on any `internal_error` log line (both are visible to any log-based alerting your host offers).

## 7. Demonstration data versus real data

- The **repair planner** always runs on synthetic networks generated by the engine. They are labeled as synthetic in the API response (`"synthetic": true`), on the page, and in exports. No real street network can be loaded yet.
- **Reports** are whatever people submit to the database the API is pointed at. A fresh database has none.
- The barrier page can show built-in **fictional sample barriers**, only when a visitor explicitly chooses "Fictional demo data". They are never mixed with submitted reports.

## 8. Production checklist (not yet done)

Each item is required before a public launch and none has been done:

1. Serve the web app and API over HTTPS. Keep the API private; the browser only talks to the web app, which proxies `/api/reports`, `/api/planning`, `/api/reviewer`, and `/api/feedback`. No CORS configuration is needed or present.
2. Put an edge proxy (the host's load balancer, Caddy, or nginx) in front of the web app that terminates TLS, sends `Strict-Transport-Security`, and sets `X-Forwarded-For`. Then set `TRUSTED_PROXY_IPS` to the web server's address so per-client limits work. Adding per-client rate limiting at the edge is still recommended.
3. Run the API with one worker, or move rate limiting out of process first.
4. Use separate database credentials for migrations and for the running API.
5. Set up database backups and decide how long reports are kept (see `docs/METHODOLOGY_AND_PRIVACY.md`).
6. Content-Security-Policy is set on every page from `apps/web/src/lib/security-headers.ts` (wired in `apps/web/next.config.ts`). Scripts and styles allow `'unsafe-inline'` because the pages are prerendered and cannot take per-request nonces; all other directives are same-origin, and `frame-ancestors 'none'` blocks framing. Verify the header on the deployed origin. Tighten to nonces if pages move to dynamic rendering.
7. Complete the manual screen-reader checks listed in `docs/METHODOLOGY_AND_PRIVACY.md`.
8. Have someone other than the author review the reviewer authentication code.

## 9. Backups and recovery

- Take a daily `pg_dump --format=custom` of the production database (or use the host's managed point-in-time recovery), and keep copies off the database host. Reports and the review audit log exist nowhere else.
- Test a restore before launch and then monthly: `createdb accessforge_restore && pg_restore -d accessforge_restore BACKUP.dump`, then point a local API at it and run `scripts/verify-deployment.sh`.
- The pilot network is reproducible: re-run `pipelines/ingest`. Reports, reviews, and feedback are not.

## 10. Rollback

- **Web or API code:** redeploy the previous build. Every migration so far only adds tables or allowed values, so older code runs against a newer schema.
- **Migrations:** do not downgrade a database with real data. Downgrades delete data (§5). Restore from a backup taken before the upgrade instead.
- After any rollback, run `scripts/verify-deployment.sh`.

## 11. Checks

```sh
cd services/engine && uv run pytest
cd services/api && uv run pytest && uv run ruff check . && uv run mypy accessforge_api migrations
cd apps/web && npm run check && npm run build && npm run test:e2e
```

Set `TEST_DATABASE_URL` (see `services/api/README.md`) to include the real-PostGIS tests; without it they are skipped, not passed.
