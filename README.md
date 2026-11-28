# CommunityForge

One web app for a neighborhood: sidewalk accessibility barriers and repair planning, plus incident alerts and lost & found. The AccessForge web UI is the front end for both.

| Part | What it does | Stack |
|---|---|---|
| [`accessforge/apps/web`](accessforge/apps/web) | The web app. Barriers, repair planner and route analysis, plus the Neighborhood pages: incidents map, lost & found, updates, alerts and account. | Next.js, MapLibre |
| [`accessforge/services/api`](accessforge/services/api) | Barrier reports, reviewer verification, repair planning, routing. | FastAPI, PostGIS, NetworkX |
| [`community/`](community/) | Neighbor reports, lost & found, local news, and alerts by email, SMS, WhatsApp and Telegram. Also runs the bots, the news poller and the admin dashboard. | Flask, SQLite |

The web app proxies `/api/*` to FastAPI and `/api/community/*` to Flask, so the browser only talks to one site.

## Run

Start all three (needs Node.js, Python with [uv](https://docs.astral.sh/uv/), and PostgreSQL + PostGIS):

```sh
# 1. Community service: http://localhost:5000
cd community
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env    # then set SECRET_KEY: python -c "import secrets; print(secrets.token_hex(32))"
python app.py

# 2. AccessForge API: http://localhost:8000
cd accessforge/services/api && uv sync --extra dev && uv run alembic upgrade head && uv run uvicorn accessforge_api.main:create_app --factory --port 8000

# 3. Web app: http://localhost:3000 (open this one)
cd accessforge/apps/web && npm install && npm run dev
```

`API_BASE_URL` and `COMMUNITY_API_BASE_URL` in `accessforge/apps/web/.env` point the web app at the two services; they are read when Next starts or builds.

Set `PUBLIC_BASE_URL` in `community/.env` to the address people open (e.g. `http://localhost:3000`): links in email, SMS and chat alerts are built from it.

Twilio's WhatsApp webhook and Google sign-in talk to the community service directly (port 5000 or its ngrok address), not through the web app. The admin dashboard is still the Flask page at `http://localhost:5000/admin`.

## Tests

```sh
cd community && pip install pytest && python -m pytest tests
cd accessforge/apps/web && npm run check && npm run build
cd accessforge/services/engine && uv run pytest
cd accessforge/services/api && uv run pytest
```

Details are in each folder's README.

## Origin

Merged from [RohinCodes15/AccessForge](https://github.com/RohinCodes15/AccessForge) and [Sarthak-bit-coder/Community_App](https://github.com/Sarthak-bit-coder/Community_App), with both git histories kept. Docs, experiments, IDE files and unused leftovers were removed. A committed test database and user-uploaded photos were purged from history.

## License

[MIT](LICENSE)
