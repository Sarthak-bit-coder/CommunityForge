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

