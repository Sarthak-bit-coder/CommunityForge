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

## 4. MVP features (in scope)

| ID | Feature | Acceptance criteria |
|---|---|---|
| F1 | Pilot-area pedestrian network | Network ingested from a licensed source. Coverage and known gaps documented. Graph connectivity checks pass. |
| F2 | Barrier store with provenance | Every barrier records its source, timestamps, verification state, presence probability, and history. Nothing is ever silently overwritten. |
| F3 | Public barrier map + list | Map (MapLibre) and list views show the same data. The list is fully usable without the map. |
| F4 | Community report form | Works without an account (rate-limited). Photo optional. EXIF stripped. Accessible form validation. |
| F5 | Verification workflow | Role-gated. State machine as in §7. Each transition is audit-logged. |
| F6 | Scenario planner | Budget, profile weights, destination weights, and equity toggle. Runs the engine asynchronously and shows progress. |
| F7 | Results and explanations | Portfolio on map and table. Per-repair explanation per RESEARCH_HYPOTHESIS.md §4. Baseline comparison table. Assumptions panel. |
| F8 | Outcome tracking | Repair status: planned → completed → verified. Modeled before/after ΔA. |
| F9 | Export | GeoJSON and CSV with a provenance and disclaimer header. |

## 5. Explicitly excluded from MVP

- Turn-by-turn or "accessible route" navigation for end users. This is a liability risk, and AccessMap already serves the need.
- The computer-vision barrier detection service. It is designed later (ARCHITECTURE.md §8), and no CV output appears in MVP data.
- Labeling tools for street-view imagery. Use Project Sidewalk instead.
- Areas beyond the Fremont pilot, and multi-tenant city onboarding.
- Native mobile apps. The site is responsive.
- Indoor or building-entrance accessibility, and transit-vehicle accessibility.
- LLM-generated text presented as findings. If an LLM is used later for summaries, its output is labeled and grounded in engine output.
- Payments, procurement, and work-order integration with city asset systems.
- Public user profiles, social features, and gamification.

## 6. Accessibility requirements (non-negotiable)

- **WCAG 2.2 Level AA** conformance for every page. Automated checks (axe) run in CI, plus manual screen-reader testing (VoiceOver and NVDA) before each release.
- **The map is never the only channel.** Every map view has an equivalent list or table with the same filters and actions.
- Full keyboard operation, visible focus, and no keyboard traps in map widgets.
- Color is never the only encoding. Severity and status also use text and icons. Contrast is ≥ 4.5:1 for text.
- Respect `prefers-reduced-motion`. Text reflows at 320 px width and 400% zoom.
- Plain-language explanations. Technical terms (ΔA, scenario) are given a plain-language label.
- The report form works with a screen reader and with voice dictation. Its errors are announced.
- An accessibility statement, plus a way to report accessibility problems with AccessForge itself.

