# Product Requirements: AccessForge AI MVP

Status: Phase 0 draft. Initial target: Fremont, California, one pilot area.
The user needs below are **assumptions drawn from published research and municipal documents**. We have conducted **no user interviews** and have **no partnerships**. Validating these needs is a Phase 2 exit criterion (see ROADMAP.md).

## 1. Product statement

AccessForge helps a community decide **which pedestrian repairs to fund first** by showing, for a given budget, which set of repairs most improves access to essential destinations for people with different mobility needs. It also helps the community **verify** whether those repairs happened and worked.

It is **not** an official accessibility inspection, an ADA compliance determination, or a navigation app. It never tells anyone a route is safe.

## 2. Target users

| User | Need (assumed) | Primary MVP surface |
|---|---|---|
| **City staff**: public works, transportation engineering, ADA coordinator | Defensible, explainable repair priorities within a fixed budget, and evidence for grant applications | Planner workspace |
| **Disability advocates and community organizations** | See where barriers cut people off, contribute knowledge, hold plans accountable | Public map/list and report form |
| **Residents with mobility, vision, or other disabilities** | Report barriers easily and see whether reports led to action | Report form, report status page |
| **Volunteer verifiers** (trained) | A clear task list of barriers to confirm or reject, with photo capture | Verification queue |
| **Researchers** (including us) | Reproducible benchmarks and open, documented data | Data export, experiments |

## 3. Primary use cases

1. **UC1 – Explore barriers.** Any visitor views known barriers in the pilot area on a map **and** in an equivalent accessible list or table, filtered by type, severity, verification status, and source.
2. **UC2 – Report a barrier.** A resident submits a location, type, optional photo, and description. The report enters the system as `unverified`.
3. **UC3 – Verify a barrier.** A trained verifier visits a site and marks it `confirmed`, `rejected`, or `resolved` with a photo and timestamp.
4. **UC4 – Plan a budget.** A planner chooses a budget, profile weights, destination categories, and an optional equity setting. They get a recommended repair portfolio, baseline comparisons, and per-repair explanations.
5. **UC5 – Compare scenarios.** A planner compares two or more saved scenarios side by side (budget levels, equity on or off).
6. **UC6 – Prioritize verification.** A planner sees which unverified barriers would most change the recommendation if verified (value of verification) and sends them to the verifier queue.
7. **UC7 – Track outcomes.** A planner marks repairs as completed. After a verifier confirms a repair, the system recomputes connectivity and shows the **modeled** before/after change, clearly labeled as modeled.
8. **UC8 – Export.** Barriers, scenarios, and results export as GeoJSON or CSV with provenance and a methodology note.

