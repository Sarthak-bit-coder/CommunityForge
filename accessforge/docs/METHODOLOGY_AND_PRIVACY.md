# Pilot methodology, privacy, and limits

Written 2026-11-16. This describes what the software does today and what a Fremont pilot would need. No pilot has started, and no conversation with the City of Fremont or any organization has taken place [U: nothing to verify].

## 1. What a report is

A report is one anonymous person's description of a barrier at a point: type, free-text description, severity 1 to 5, and coordinates. It starts as **pending**. The software assigns pending reports an assumed 0.5 chance of being real; that number is a placeholder, not a measurement.

A report becomes **verified** or **rejected** only when a signed-in reviewer decides and writes a reason. "Verified" means that reviewer accepted it. It is not a city inspection, an engineering assessment, or an ADA determination.

## 2. Proposed pilot method

1. Pick a pilot area of a few square kilometres using written criteria (ROADMAP Phase 2).
2. Train a small group of volunteer reviewers on a written protocol: visit the location or use a dated photo, record what was checked in the reason field.
3. Collect reports for a fixed period. Publish the counts on the pilot dashboard with the collection dates.
4. Load the pilot area's pedestrian network and destinations, with each source's license and date recorded. Only then run the planner on real data.
5. Report results with their limits, including anything that did not work.

Steps 2 to 5 are not possible yet: the audit protocol is only a draft (`AUDIT_PROTOCOL.md`), there is no photo evidence, and the network loader (`pipelines/ingest`) has run only against a local test database, not a deployment.

## 3. Stakeholder feedback plan

- Who: residents with disabilities and local disability organizations first, then city public works or ADA staff.
- How: the anonymous feedback form on the pilot dashboard (topic and message only). It also shows an email address if the deployment sets `FEEDBACK_EMAIL`. Form feedback is stored in the `feedback` table and has no public read route; read it with SQL (`docs/DEPLOYMENT.md` §5).
- What to ask: Are the barrier types the right ones? Is "verified" explained honestly? Would the planner's output be usable in a real budget discussion, and what is missing?
- Record what was heard in `docs/DISCOVERY.md`, including what could not be confirmed.

## 4. Privacy

**Stored:** barrier type, description, severity, coordinates, timestamps, verification status. For reviews: the reviewer's UUID, the reason, and the time. For feedback: the topic, the message, and the time, and nothing that identifies the sender.

**Not stored:** names, email addresses, phone numbers, IP addresses, disability status, photos, or accounts for people who report.

**Public:** every report's type, severity, exact coordinates, status, and timestamps. The **description becomes public only after a reviewer confirms the report**; until then, and if it is rejected, only signed-in reviewers can read it. Reviewer IDs and reasons are visible only to signed-in reviewers.

Things to know before a launch:

- The **description is free text**. Nothing stops someone typing a name, a phone number, or an accusation into it, so it is hidden from the public until a reviewer confirms the report. Reviewers must reject, not verify, a report whose text contains personal information. A confirmed report's text cannot be hidden again without database access.
- **Exact coordinates are public.** A report made outside someone's home shows that location. Rounding coordinates for public display has not been implemented.
- The report form lets you choose a photo, but it only previews on your device and is **never uploaded**. Photo upload is deliberately not built: it needs private storage, removal of location metadata, moderation, and alt text.
- Rate limiting keeps recent network addresses in memory for about a minute. Behind the web app, addresses come from the edge proxy only when `TRUSTED_PROXY_IPS` is set (`docs/DEPLOYMENT.md` §3). They are not written to the database or to logs.

## 5. Retention and deletion

There is no retention period and no way to delete or edit a report through the application. The review audit log cannot be changed or deleted by design. Removing a report today needs direct database access, and a report that has a review cannot be removed without disabling the audit protection. Before a pilot, decide how long reports are kept and build a takedown path.

## 6. Abuse and duplicates

- Submissions are limited to 10 per minute per network peer. This is per server process and treats everyone behind one proxy as one peer.
- The form disables itself while sending and after success, which prevents double clicks. The server does not detect duplicate reports of the same barrier; two reports create two barriers.
- Feedback is limited to 5 per minute per network peer, and the form has a hidden honeypot field that bots tend to fill; the API rejects any submission that fills it.
- There is no CAPTCHA and no spam filtering. Feedback messages are free text, like report descriptions, but they are never shown publicly.

## 7. Limits of the planner

- It runs only on synthetic networks. No figure it produces describes Fremont.
- Barriers in the demonstration are treated as certainly present; uncertainty is not sampled.
- Costs are abstract units with one fixed value per repair.
- The exact method handles about twenty candidate repairs. Methods for city-scale networks are not built.
- Equity is reported (gain by profile and by origin group) but not optimized.
- A model of access is not a measurement of whether real people can make real trips.

## 8. Accessibility testing

Automated: axe checks in unit tests for each page and component, and in a real browser at 320, 375, 768, and 1440 px for every page, plus the planner and verification flows.

Manual checks required before launch, **not yet done**:

- VoiceOver on Safari (macOS and iOS) and NVDA on Firefox or Chrome: complete report, verify, and plan flows.
- Keyboard only: reach and operate every control, including map markers and scrolling tables.
- 200% and 400% zoom, and Windows high-contrast mode.
- Review by at least one person who uses assistive technology daily.
