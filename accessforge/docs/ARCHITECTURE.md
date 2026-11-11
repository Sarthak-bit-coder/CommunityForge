# Architecture

Status: Phase 0 proposal. Nothing is implemented yet. Versions are pinned when each component is first implemented. This document names technologies, not version numbers.

## 1. Principles

- **Engine as a pure library.** The optimization engine is a Python package with no web, database, or network I/O. It takes plain data in and returns plain data out. This makes it testable, lets Codex own it independently, and lets the API swap storage without touching algorithms.
- **Few moving parts.** One web app, one API service, and one database. Background jobs use a Postgres-backed queue, not a separate broker. Add infrastructure only when measured load requires it.
- **Provenance everywhere.** Every barrier, repair, and result row records its source, its time, and the parameters that produced it.
- **Accessibility and privacy are architectural constraints**, not later polish (PRODUCT_REQUIREMENTS.md §6, §8).

