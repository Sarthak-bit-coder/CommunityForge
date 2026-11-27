# accessforge-ingest

Loads one pilot area into PostGIS. Sources: the OSM pedestrian network, raised-kerb barriers, destinations, 2020 Census block population, and the CDC PLACES modeled disability share.

```bash
uv sync --extra dev
# Database must already be migrated: (cd ../../services/api && uv run alembic upgrade head)
DATABASE_URL=postgresql+psycopg://... uv run accessforge-ingest fremont_bart
```

- The whole load is one transaction: on any error nothing is written.
- Re-running replaces the network, destinations and origins. OSM barriers are only ever added; one already loaded from the same OSM node keeps its row and review state.
- On a brand-new database, create the PostGIS extension as a superuser before migrating. The API engine's 2 s statement timeout can cancel `CREATE EXTENSION postgis`.

Tests: `TEST_DATABASE_URL=postgresql+psycopg://...@127.0.0.1:55432/accessforge_test uv run pytest`. Without it, the PostGIS tests are skipped.
