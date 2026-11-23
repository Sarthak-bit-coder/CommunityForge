# Demonstrating AccessForge

Written 2026-11-16. Everything here can be reproduced from this repository. Numbers marked **modeled** come from the optimization engine running on synthetic networks; none describes a real place.

## The problem in two sentences

A sidewalk route is only usable if every piece of it is. Repair lists that rank barriers one at a time (worst first, or busiest location first) cannot tell when two repairs are only worth funding together, so limited budgets get spent on fixes that open no complete route.

## What AccessForge does

1. **Report.** Anyone can submit a barrier with a type, description, severity, and location. No account or name.
2. **Verify.** A signed-in reviewer confirms or rejects each report and must record a reason. Decisions go into an append-only audit log.
3. **Plan.** Given a budget, the engine searches for the set of repairs that most increases modeled access to destinations, and explains each choice.

## What is real, modeled, planned

| | Status |
|---|---|
| Barrier reporting, map with matching list, filters, pagination | Working, tested against a real PostGIS database |
| Reviewer sign-in, verify/reject with audit log | Working, tested against a real PostGIS database |
| Repair planner: budget, four selection methods compared, explanations, saved scenarios, CSV/JSON export | Working, on synthetic networks only |
| Pilot dashboard: report counts by status and type, CSV export, anonymous feedback form | Working |
| Planner exports: CSV with generation date, source and method; JSON; print view | Working |
| Accessibility numbers | **Modeled** estimates from a simplified network model |
| Fremont sidewalk network, destinations, repair costs | Not loaded. Planned (ROADMAP Phase 2) |
| Uncertainty sampling, equity-targeted optimization, city-scale solver | Not available in the product. See `services/engine/README.md` |
| Photos, user accounts | Not built |
| Use by, or agreement with, the City of Fremont or any organization | None |
| Verified real-world outcomes | None |

## How the engine works (short version)

The engine treats sidewalks as a network of segments. Each mobility profile (for example a wheelchair user) has barrier types it cannot pass. For each profile, the engine counts the destinations each starting point can reach within a fixed distance, weighted by how many people start there. That total is the access score. A repair removes a barrier; the engine recomputes the score with a set of repairs applied and compares it with the score before.

To choose repairs under a budget, the reference method tries every affordable combination and keeps the best. This is exact for the model but only feasible for about twenty candidate repairs. It is shown next to three simpler methods so you can see where they differ. Details and limits: `services/engine/README.md`, `docs/RESEARCH_HYPOTHESIS.md`, and the benchmark report in `docs/engine/BENCHMARK_RESULTS.md`.

## Reproducible demo scenario

Start the app (`docs/DEPLOYMENT.md` section 2), then open `/planner`.

**Scenario A: two barriers on one route.** Network "Two-barrier corridor".

| Budget | Method | Repairs | Cost | Modeled gain |
|---|---|---|---|---|
| 10 | Best combination | none | 0 | 0 |
| 10 | Worst severity first | r0 | 10 | 0 |
| 20 | Best combination | r0, r1 | 20 | 10 (access 10 → 20) |
| 20 | One repair at a time | none | 0 | 0 |

At budget 10, severity ranking spends everything and opens nothing. At budget 20, the single-repair method never starts, because neither repair is worth anything alone; the combination search funds both. The gain of 10 is checked by hand in `services/api/tests/test_planning.py`.

**Scenario B: clustered barriers on a grid.** Network "Street grid, clustered barriers", budget 60.

| Method | Repairs | Cost | Modeled gain |
|---|---|---|---|
| Best combination | r2 | 28 | 28 |
| One repair at a time | r2 | 28 | 28 |
| Worst severity first | r4, r5, r6 | 44 | 0 |
| Nearby destinations and residents | r4, r5, r6 | 44 | 0 |

Here the two network-blind rankings spend 44 cost units for no modeled gain, while one 28-unit repair captures all of it. These figures were read from the running API on 2026-11-16 and are deterministic for engine version 0.1.0.

Costs are abstract units, not dollars. Do not quote these numbers as evidence about Fremont or about real repair programs.

## 60-second walkthrough

| Time | Show | Say |
|---|---|---|
| 0:00 | Landing page | "Fixing the worst barrier first can waste the budget. Here is why." |
| 0:10 | `/planner`, corridor, budget 10, Run | "With money for one repair, ranking by severity spends it and opens nothing." |
| 0:20 | Budget 20, Run | "With money for both, the engine funds the pair. The simpler method funds neither." |
| 0:30 | "Why these repairs" table | "Each repair lists what it fixes, who gains, and which repair it depends on." |
| 0:40 | `/report`, submit a barrier | "Anyone can report a barrier without an account." |
| 0:48 | `/verify`, sign in, verify with a reason | "A reviewer confirms it and has to say why. That is logged permanently." |
| 0:55 | `/pilot` | "The dashboard separates verified from unverified, and says what the data cannot tell you." |

Close with: "The planner runs on generated example networks today. Loading Fremont's sidewalk network is the next step."

## Architecture in one paragraph

The browser only talks to a Next.js web app (`apps/web`). The web app proxies `/api/*` to a private FastAPI service (`services/api`), which validates every request, stores reports, reviews and feedback in PostgreSQL with PostGIS, and runs the planning engine (`services/engine`, pure Python with NetworkX) in-process on synthetic networks. Reviewers sign in with a pre-shared key that the server stores only as a SHA-256 digest; the session is an HttpOnly, SameSite=Strict cookie. There are no accounts for reporters, no photo uploads, and no third-party scripts. The full design is in `docs/ARCHITECTURE.md`.

## Community impact to date (factual)

As of 2026-11-17:

- **Reports from residents:** none collected in a pilot yet. The live count is on `/pilot`.
- **Repairs made or influenced:** none.
- **Conversations with the City of Fremont, disability organizations, or Project Sidewalk:** none yet (`docs/DISCOVERY.md`).
- **Fremont data loaded:** the OSM pedestrian network, destinations, Census population and CDC PLACES disability estimates for the pilot area (`docs/PILOT_AREA.md`), plus 20 unverified OSM `kerb=raised` barriers. The planner does not run on this network yet.
- **Modeled results:** only on synthetic networks (above). They show how the method behaves. They are not evidence of impact.

Update this section only with things that can be checked. Do not round "no data" up to an estimate.

## Fremont pilot outreach plan

Goal: hear from the people the tool is for before collecting real reports. Every step is logged in `docs/DISCOVERY.md`, including requests that got no reply.

1. **Prepare.** Deploy following `docs/DEPLOYMENT.md` §8. Set `FEEDBACK_EMAIL`. Print the plain summary below.
2. **Disability community first.** Ask local disability organizations and independent-living centers serving the Tri-City area for a 30-minute conversation. Ask the questions in `docs/METHODOLOGY_AND_PRIVACY.md` §3. Offer accessible formats and do not ask anyone about their own disability.
3. **Project Sidewalk.** Ask whether a Fremont deployment exists or is planned, and whether its labels could be used under their license.
4. **City staff.** Contact Fremont public works or ADA staff only to ask how repairs are prioritized today and what an output would need to be useful. Do not ask for an endorsement, and do not describe the project as a city pilot.
5. **Small field test.** Run the audit protocol (`docs/AUDIT_PROTOCOL.md`) with two or three volunteers in the pilot area, then invite residents to report through `/report`.
6. **Report back.** Publish what was heard, what changed, and what did not work, including negative results.

## Screenshots

With the app running locally, capture these at 1440 px wide and again at 375 px:

1. `/` landing page, top section.
2. `/planner` after running the corridor at budget 20, showing "Recommended plan" and "Why these repairs".
3. `/planner` method comparison table for the clustered grid at budget 60.
4. `/barriers` with at least one submitted report selected, showing the map and the list together.
5. `/verify` signed in, with the decision form open.
6. `/pilot` with report counts.

Keep the "Synthetic demonstration" notice and the `/pilot` "Run by" line (not affiliated with or endorsed by the City of Fremont) in frame. Do not crop them out.

## Plain summary for outreach

> AccessForge is an independent, early-stage project exploring how communities could choose sidewalk repairs so that limited budgets open the most accessible routes. People can report barriers, trained reviewers can confirm them, and a planning tool compares repair combinations within a budget. Today the planning tool runs on generated example networks, not real streets. AccessForge has no partnership with, or endorsement from, the City of Fremont or any other organization, and has not yet measured any real-world outcome. We are looking for feedback from disability advocates, residents, and city staff before running a pilot.
