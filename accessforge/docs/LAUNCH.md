# Pilot launch kit

Written 2026-11-17. Everything here must stay true when read. Before sending anything, check every claim against `docs/DEMO.md` ("Community impact to date") and update it if something changed. Never add partners, quotes, participant numbers, or outcomes that have not happened.

## 1. Controlled pilot launch checklist

Tick each item and write the date and who checked it.

**Before anyone outside the team uses it**

- [ ] Deployed per `docs/DEPLOYMENT.md` §8, with every item done or explicitly accepted in writing as a known risk.
- [ ] `scripts/verify-deployment.sh https://WEB` passes. `scripts/verify-deployment.sh https://WEB http://API` passes on the API host.
- [ ] Production database is fresh: `/pilot` shows 0 reports, and the barrier page's "Fictional demo data" option is the only fictional content.
- [ ] Pilot-area network loaded with `pipelines/ingest` (`docs/PILOT_AREA.md`). The note under the map reads "Fremont pilot-area walking network from … OpenStreetMap contributors".
- [ ] Backups are running and one restore has been tested (`docs/DEPLOYMENT.md` §9).
- [ ] At least two trained reviewers have keys. They have read `docs/USER_GUIDE.md` (Reviewers) and `docs/AUDIT_PROTOCOL.md`.
- [ ] A retention period is decided and written into `docs/METHODOLOGY_AND_PRIVACY.md` §5.
- [ ] Manual screen-reader pass (VoiceOver with Safari, NVDA with Firefox) on `/report`, `/barriers`, `/pilot`, `/verify`. Results recorded in `docs/METHODOLOGY_AND_PRIVACY.md` §8.
- [ ] Someone other than the author has reviewed `services/api/accessforge_api/auth.py` and `reviews.py`.

**During the pilot (weekly)**

- [ ] Review every pending report within 7 days.
- [ ] Read new feedback (`docs/DEPLOYMENT.md` §5) and log themes in `docs/DISCOVERY.md`.
- [ ] Check logs for bursts of 401/429 and for `internal_error`.

**End of the pilot**

- [ ] Fill in the impact report (§4) with measured numbers only.
- [ ] Publish what did not work.

## 2. Community outreach email template

Send from a real person's address. Keep it short. Do not attach the app; link to it. Replace every `[bracket]`.

> **Subject:** Feedback request: a sidewalk-repair planning tool for [pilot area], Fremont
>
> Hello [name],
>
> I'm [your name], working on AccessForge, an independent, volunteer-run project. It is not affiliated with the City of Fremont. It lets residents report sidewalk barriers such as missing curb ramps or blocked paths. Volunteer reviewers check the reports, and a planning tool shows which *combination* of repairs would open the most accessible walking routes for a given budget.
>
> It is early. The planning tool currently runs on example networks, not real Fremont costs, and no repairs have resulted from it. Before we invite residents to use it, we want to hear from people with lived experience and from [organization]'s perspective:
>
> - Are we asking about the right kinds of barriers?
> - Is anything about the site hard to use with your assistive technology?
> - What would make the output useful, or harmful, in a real budget discussion?
>
> Would you be open to a 30-minute conversation, by phone, video, or in person, in [month]? We can provide materials in large print or another format if helpful. The site is at [URL]. The feedback form on the Pilot page is anonymous.
>
> Thank you for considering it,
> [name] · [email] · [phone, optional]

## 3. Press pitch draft (factual)

Use only after a pilot has started. Until then, this is a project description, not news. Update the bracketed facts from measured data.

> **AccessForge: choosing sidewalk repairs as a set, not one at a time**
>
> A sidewalk route is only as usable as its worst gap. When cities rank barriers one by one, they can fund a repair that opens nothing because the next barrier on the route is still there. AccessForge is an independent open-source project that models the walking network and searches for the combination of repairs that most improves access to destinations such as clinics, transit, and groceries within a fixed budget. It explains each recommendation.
>
> Residents can report barriers without an account. Trained volunteers verify each report and record why, and unverified reports stay clearly marked. The planning results are modeled estimates, not inspections or compliance determinations.
>
> **Status:** [As of DATE, the project is preparing a pilot in Fremont's [area]. It has collected [N measured] reports, [N] of them verified.] It has no partnership with or endorsement from the City of Fremont. [No repairs have been made as a result.] Code and methodology: [repository URL].
>
> **Contact:** [name, email]

Do not use: "AI-powered inspection", "safe routes", "ADA compliant", "partnered with the City", user counts that are not measured, or any quote that was not actually said by a person who agreed to be quoted.

## 4. Impact report template

Report each number with its source and date. Write "not measured" rather than estimating. Keep modeled and observed results in separate sections.

```markdown
# AccessForge pilot report: [area], [start date] to [end date]

## Participation (observed, from the database on [date])
- Reports submitted: [N]   (source: /pilot CSV, generated_at [timestamp])
- Verified / rejected / still pending: [N] / [N] / [N]
- Median days from report to review: [N or "not measured"]
- Feedback messages received: [N]; main themes: [list, from DISCOVERY.md]

## Data quality (observed)
- Reports found to be duplicates on review: [N or "not measured"]
- Reports rejected because the barrier could not be found: [N]

## Modeled planning results (estimates, not outcomes)
- Network: [source, retrieved date]. Costs: [source, or "relative units, not dollars"]
- Budget scenarios run: [list]. Exported CSVs attached with generated_at timestamps.
- Modeled access gain, recommended plan vs. simple ranking: [numbers], method version [engine_version]

## Real-world outcomes (observed)
- Repairs made that are linked to AccessForge recommendations: [N, with evidence, or "none"]
- Stakeholder decisions influenced: [describe with the person's permission, or "none"]

## What did not work
- [list, including negative results]

## Limits
- Reports reflect who chose to report, not how many barriers exist.
- "Verified" is a volunteer check, not a city inspection.
```
