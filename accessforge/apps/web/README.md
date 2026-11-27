# AccessForge web (`apps/web`)

Next.js (App Router) + TypeScript + Tailwind CSS frontend. See `../../docs/ARCHITECTURE.md` §2.1.

```bash
npm install
npm run dev     # http://localhost:3000
npm run check      # lint + prettier + typecheck + unit tests with 80% coverage gate
npm run test:e2e   # Playwright smoke + axe at 320/375/768/1440 px (first run: npx playwright install chromium)
npm run build
```

Design tokens live in `src/app/globals.css`. Shared UI is in `src/components/ui`, the shell in `src/components/layout`.

Known audit finding: 7 moderate (minimatch < 11.0.1 via typescript-eslint, dev-only lint tooling). No stable typescript-eslint release accepts minimatch 11 yet; revisit when one ships.

## Connected barrier reports

Copy `.env.example` to `.env.local`. Set server-only `API_BASE_URL` to the FastAPI HTTP(S) origin (default `http://127.0.0.1:8000`), then restart/rebuild Next. Start FastAPI and apply its migrations using `services/api/README.md`. No credentials belong in this URL.

The browser requests same-origin `/api/reports`; Next proxies only that path to FastAPI `/reports`, preserving query parameters. No CORS change or public backend URL is required. Production proxy trust and shared rate limiting must be configured together; the API's process-local limiter may group users behind the proxy.

`/report` submits type, description, explicitly chosen severity, and coordinates. Success means a real saved **unverified** report pending verification, not an official inspection. Controls lock during submission and after success to prevent repeated clicks. Failed requests preserve input and never automatically retry POSTs. A lost response can hide a successful save: users are told to check reports before retrying. Server-side idempotency is not part of the current API contract.

`/barriers` fetches reports with server-side type/status filters and 20-item pages. Both map and accessible list show the current page. Selecting either fetches report details. Loading, empty, failure, and retry states are announced. Filter/page changes cancel stale reads. Fictional samples require explicit selection and never replace failed live requests. The map still uses a fictional street background; report markers use submitted coordinates and fit into view. It is not a navigation map.

Optional photos remain device-only previews: JPEG/PNG/WebP up to 5 MiB. They are never included in submissions. No uploads, authentication, or verification transitions were added.

Integration tests intercept HTTP at the fetch/browser boundary to check the real UI and wire contract. They do not prove PostGIS persistence; that requires the API's real-database suite. Automated axe checks cover live reports and existing responsive pages; manual screen-reader verification remains a release requirement.

## Read-only verification dashboard

`/verify` reuses the report browser and defaults to `state=unverified` (pending). Status filters support `confirmed` (verified), `rejected`, and the existing barrier lifecycle states. The list displays coordinates, type, description, submission time, and public evidence provenance. Selecting a report loads current details through `GET /reports/{id}`. Community-report observation times mean submission receipt, not a verified site visit. Empty provenance is explicitly labeled rather than inferred.

Reviewer authentication and protected review endpoints are absent in the inspected API. Approval/rejection controls are therefore not rendered, and a permanent explanation identifies this blocker. The dashboard only issues GET requests; it does not expose the internal review repository, reviewer identities, or audit reasons. There is no simulated approval success. Existing load/error/retry/pagination states and the equivalent map/list remain available. No backend changes were made.

## Verification status presentation and refresh

All status labels, marker symbols, filter labels, and explanations share one definition. API `unverified` displays **Pending** (`?`), `confirmed` displays **Verified** (`V`), and `rejected` displays **Rejected** (`×`). Existing repair lifecycle states remain distinct. Missing or unrecognized values display **Unknown status** (`–`), appear only under All statuses, and are never promoted to Verified. Status explanations accompany the map legend and selected report details; verification does not imply an official inspection or safe route.

Live report views offer **Refresh reports** and refresh when the window regains focus. Both the current filtered page and open detail are re-fetched without reloading the page. Reports leaving the filter are removed and their detail selection cleared. Refresh failures label retained results as potentially stale. This uses existing GET endpoints, not polling or a push subscription; changes made elsewhere become visible on refresh or window focus. Fictional demo views do not perform these live refreshes. Review actions remain unavailable until protected reviewer authentication/endpoints exist.
