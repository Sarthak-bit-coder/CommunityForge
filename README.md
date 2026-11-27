# CommunityForge

Two community tools in one repo, side by side. Each folder runs on its own.

| Folder | What it does | Stack |
|---|---|---|
| [`accessforge/`](accessforge/) | Map sidewalk accessibility barriers, have reviewers verify them, and pick the set of repairs that reconnects the most routes within a budget. | Next.js, FastAPI, PostGIS, NetworkX |
| [`community/`](community/) | Neighborhood safety app: incident map, lost & found, local news, and alerts by email, SMS, WhatsApp and Telegram. | Flask, SQLite, Leaflet |

## Run

**AccessForge** (needs Python with uv, Node.js, PostgreSQL + PostGIS):

```sh
cd accessforge/services/api && uv sync --extra dev && uv run alembic upgrade head && uv run uvicorn accessforge_api.main:create_app --factory --port 8000
cd accessforge/apps/web && npm install && npm run dev   # http://localhost:3000
```

**Community** (needs Python):

```sh
cd community
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python app.py   # http://localhost:5000
```

Details are in each folder's README.

## Origin

Merged from [RohinCodes15/AccessForge](https://github.com/RohinCodes15/AccessForge) and [Sarthak-bit-coder/Community_App](https://github.com/Sarthak-bit-coder/Community_App), with both git histories kept. Docs, experiments, IDE files and unused leftovers were removed. A committed test database and user-uploaded photos were purged from history.

## License

[MIT](LICENSE)
