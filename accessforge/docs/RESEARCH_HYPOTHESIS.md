# Research Hypothesis: Accessibility Impact Optimization Engine

Status: Phase 0 proposal. No experiments have been run, and no result in this document is measured.

## 1. Problem statement

Cities fix sidewalk barriers on limited budgets. Common practice scores each defect independently by severity, proximity, usage, and risk (see COMPETITOR_ANALYSIS.md §5). Pedestrian access, however, is a **network property**. A route from a home to a clinic is usable for a wheelchair user only if **every** barrier on it is passable for that user. Two consequences follow:

- **Complementarity:** fixing barrier A may give zero benefit until barrier B on the same corridor is also fixed. Fixing both may unlock a large gain.
- **Substitutability:** fixing barrier C may be worthless if a nearby accessible detour already exists.

Ranking defects one at a time cannot see either effect. Our question is whether modeling these effects measurably improves the access gained per dollar.

