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

## 7. Human verification requirements

Barrier verification states:

```
unverified ──► confirmed ──► repair_planned ──► repair_completed ──► resolved
     │              │                                   │
     └──► rejected  └──► rejected (re-check)             └──► confirmed (repair failed)
```

- Only `verifier` or `admin` roles may move a barrier out of `unverified`. Confirming requires a site photo or a documented reason it was not possible.
- `repair_completed` is set by a planner. **`resolved` requires a verifier visit after completion.**
- Engine inputs map states to presence probabilities, for example unverified community report → q from a calibrated prior, confirmed → high q, resolved → removed. The mapping is documented in the assumptions panel.
- Future CV outputs enter as a separate source with their own prior. They **never** auto-confirm.
- Every UI surface showing barriers or results shows its verification state and source.

## 8. Privacy requirements

- Reports can be anonymous. If an account exists, the reporter's identity is never shown publicly.
- Strip EXIF and GPS metadata from uploaded photos. Location is set explicitly by the reporter. Before public display, either blur faces and plates or keep photos verifier-only until a moderation step. For MVP: **photos are visible only to verifiers.**
- Store no home addresses and no disability status of individual users. Disability-related demand uses only aggregate ACS data.
- Collect the minimum. No third-party analytics or advertising trackers. Server logs drop full IPs after the rate-limiting window.
- A published data retention policy. Reporter contact info, if given, is deleted after report closure plus 90 days.
- Data export never includes reporter identity or contact information.

## 9. Disclaimers (shown in the UI and exports)

- "Barrier data comes from community reports and other sources and may be incomplete or wrong. It is not an official inspection."
- "Recommendations are model estimates to support planning. They are not engineering, legal, or ADA compliance determinations."
- "AccessForge does not provide routes and cannot tell you whether a path is safe."

## 10. Success metrics (targets are proposals, not results)

| Area | Metric | MVP target |
|---|---|---|
| Research | H1 result determined on the pre-registered benchmark (either way) | Done, with all results published |
| Data quality | Share of pilot-area barriers with verification state ≠ unverified | ≥ 50% |
| Data quality | Verifier agreement on a double-checked sample | Measured and reported (no target until a baseline exists) |
| Planner usefulness | Planners can complete UC4 unaided in a usability test | ≥ 4 of 5 participants |
| Accessibility | WCAG 2.2 AA audit issues of severity critical or serious | 0 at release |
| Reporting | Median time to submit a report on mobile, measured in usability testing | ≤ 2 minutes |
| Outcome loop | Repairs marked completed that receive a verifier visit within 30 days | ≥ 80% (pilot) |

No targets for "lives improved" or measured trip changes. We cannot measure them in the MVP.

## 11. Major risks and assumptions

| Risk / assumption | Impact | Mitigation |
|---|---|---|
| **A1:** Fremont staff want budget-optimized portfolios | No adoption | Phase 2 discovery interviews before building F6–F8 UI polish |
| **A2:** Network data for Fremont sidewalks is available and licensable | Engine has no graph | OSM audit early. Tile2Net fallback. Ask the city for GIS layers. |
| **A3:** Enough barrier data can be gathered for one pilot area | Results meaningless | Small pilot area. Structured team audit. Request a Project Sidewalk deployment. |
| R1: Users treat recommendations as official or safe | Harm, liability | Disclaimers, no routing, verification states everywhere |
| R2: Network-aware optimization shows no advantage (H1 false) | Core thesis weakened | Pre-registered. Report honestly. Product still offers verification and explanation. |
| R3: Profile parameters misrepresent disabled people's needs | Biased recommendations | Participatory parameter review. Sensitivity analysis shown in UI. |
| R4: Abuse of the open report form (spam, doxxing via photos) | Data quality, privacy | Rate limits, verifier-only photos, moderation queue |
| R5: Imagery or data licensing conflicts (Street View ToS, ODbL share-alike) | Legal | License review per source, recorded in the data catalog |
| R6: Small team, two agents, ownership drift | Inconsistency | AGENT_OWNERSHIP.md, contract-first engine interface |
