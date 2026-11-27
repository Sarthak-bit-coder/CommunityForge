# Frontend handoff

The route analysis page renders current and modeled post-repair outcomes in `apps/web/src/components/routing/RouteResults.tsx`. I found no pedestrian route map in that flow. Claude Code owns the frontend. Confirm the intended map before editing. On that map, use distinct colors, a solid current line, a dashed modeled post-repair line, and matching labeled legend samples. Preserve the existing route data and text comparison.

## Barrier markers

In `BarrierMap.tsx`, reuse the existing status symbols and labels for a compact legend. Distinguish verified, unverified, and known-absent barriers using recorded states only. Show the selected barrier’s type and verification status as visible text. Preserve keyboard activation and the pressed state. Extend `BarrierMap.test.tsx` to cover the marker-to-legend mapping and selection details.

## Selected-route barrier highlights

The route page renders RouteResults without a map. When connecting the marker view, match marker IDs to the selected outcome’s `barriers_on_route` within the same dataset. The separate `affecting_barriers` list describes the direct path and can differ from the selected route. Use a non-color cue and a short selection explanation based on the matched record. Test a route switch with different IDs, an unrelated nearby marker, and an empty result that clears prior highlights. Distinguish a missing route from a route with no identified barriers.

## Route calculation states

RouteAnalysis already announces calculations and request errors. A failed retry reveals the previous analysis and barrier rows because the component retains the old result. Switching datasets during calculation aborts the request but leaves isLoading true, disabling submission. Clear the previous result on submission and reset loading on dataset change. Announce invalid selections and no-route outcomes. Use empty network choices or an explicit load failure to explain unavailable data. Keep the combined distance_or_disconnected reason intact. Cover success followed by failure, switching datasets mid-request, empty choices, and live announcements in focused frontend tests.

## Route selection changes

Changing start or end edits form state but leaves the submitted request active. Its response can appear under the newer selection. The route page exposes a repair budget and renders RouteResults; it has no route overlay or individual repair selector. Tie each displayed result to the active inputs, invalidate prior route and barrier state on edit, and guard success and failure against superseded requests. Test changing the destination during a delayed request and changing the repair budget after success, including loading and failure announcements.

## Route summary

Show the returned origin_id and destination_id in the summary. Use each outcome's barriers_on_route for its barrier list, retaining the separate direct-path table. Render a null distance as unavailable, never zero by default. The API verifies individual barriers and models routes; only attribute blockage to barriers when reason is barrier. Keep proposed repairs conditional. Cover endpoints, different barrier lists before and after, and absent distance in the existing accessible summary test.

## Uncertainty and simulations

In the summary and comparison row, label the post-repair result “Simulation with recommended repairs.” Keep verification attached to barrier records. For uncertain results, explain that the modeled route depends on unverified barriers being absent. Explain the API’s recorded-barriers limitation separately from the reason a particular route is unavailable: distance_or_disconnected does not establish missing network data. Preserve every returned limitation, including unfamiliar text. Test these distinctions in the rendered summary.

## Modeled route impacts for recommended repairs

The engine's `evaluation.evaluate_route_impacts(instance, selected_repair_ids, params)` evaluates the chosen portfolio on the same sampled scenarios as `evaluate`. Each result identifies a traveler profile, origin, and destination, with the modeled fraction of scenarios reaching the destination within the profile threshold before and after repairs. A contributing repair is one whose omission reduces that trip's modeled reach in the chosen portfolio. Complementary repairs can both contribute. Interchangeable repairs can have zero individual contribution. An empty result means the portfolio improves no modeled reachability. A shorter route that was already reachable in every scenario does not count toward this metric.

Proposed shared contract addition, pending maintainer approval: expose this helper and its immutable `RouteImpact` result for opt-in reporting, without adding fields to `SolveResult` or changing selection. This lets the adapter attach trip-level evidence without recomputing or redefining the model.

Claude Code owns the remaining integration. In `planning_adapter.py`, evaluate the selected plan with the same instance, scenario count, seed, and direction used for selection. Extend `MethodPlanView` and the existing `PlanResults` view to show modeled before-and-after reachability beside repair recommendations. For `RouteAnalysisView`, filter impacts by the requested profile, origin, and destination. Keep these sample-based results distinct from the existing route status and distance. Label them as modeled and handle an empty result or a recommended repair with no marginal gain for the selected trip.

## Production readiness

1. Fix OSM ingestion before enabling real routing. `_split_way` currently drops missing references before splitting. An input way with references `[1, 2, 3]` and no geometry for node 2 produces a synthetic edge `(1, 3)`. Split at gaps or reject the way. Verify pedestrian access and direction from source tags. The loader also snaps origins and destinations to any stored node, including shape points with no incident edges. Require supported access to a graph vertex and leave locations unlinked when the evidence is missing.
2. Run the read-only `experiments/network_integrity.sql` against a staged Fremont import. It flags incorrect CRS or coordinates, invalid or missing geometry, incorrect projected lengths, mismatched references and endpoints, off-network trip endpoints, and disconnected vertices. Verify source continuity separately because stored geometry cannot prove that its connections existed in OSM. PostGIS fixture coverage does not validate the real dataset.
3. Bind routing and planning to one versioned network and barrier snapshot. The street endpoint serves geometry only, and the route endpoint still uses synthetic datasets. Resolve IDs before running optimization, distinguish missing network data from an unreachable trip, and include snapshot identity in cache keys for real data. Map review states to modeled presence at the adapter boundary and link barriers by explicit node or edge references. Add a colocated-endpoints regression to the route API: NetworkX returns a zero-length path at an isolated node, so the API also needs to honor the graph's blocked-node flag or use the approved engine routing interface.
4. Invalidate the visible analysis when route inputs change or a retry starts. Reset loading and ignore late completions when a request is cancelled. Add a retry-failure and dataset-switch test. Once the adapter supplies route impacts, show them alongside repairs using the existing summary and table. Keep the current and simulated outcomes distinct and preserve a readable text alternative to any overlays.

## Fremont BART staged audit (November 17, 2026, Pacific)

[V] Local PostGIS database `accessforge_dev`, OSM source label `snapshot 2026-11-18`. The read-only query in `experiments/network_integrity.sql` checked 3,642 stored nodes/shape points and 1,251 edges. The configured pilot is a 1.6 km square around Fremont BART; complete street segments extend beyond the box. Actual edge extent (longitude, latitude): (−121.9898697, 37.5475166) to (−121.9660546, 37.5677023). The audit found one connected edge network and no bad CRS, coordinates, lines, projected lengths, edge endpoints, or dangling edge references. Of the edges, 383 are street proxies (21.98 km), so sidewalk availability along those edges is unknown.

[V] Endpoint validation failed. Of 53 origins and 138 destinations, 31 origins and 99 destinations reference nodes outside the usable edge network. Another 22 origins and 38 destinations attach to usable vertices but have a spatial offset with no stored pedestrian access leg. The maximum offsets across all assigned origins and destinations are 172.0 m and 125.1 m respectively. The audit identifies evidence gaps; it does not infer a path across the offset.

[V] Current parser tests verify splitting at missing OSM nodes. The current loader restricts candidate nodes to edge endpoints. The existing snapshot still contains invalid assignments. No raw OSM extract was found in the repository to independently replay the source continuity of every stored edge. Rebuild in separate staging from a dated extract, retain source references, and rerun the audit before using these endpoints for routes. Geographic coverage and field accessibility outside the loaded pilot remain unverified.

The ingestion parser now excludes ways explicitly tagged `foot=private`, including when general access is allowed. A PostGIS regression covers origin and destination snapping near an interior shape point and a private-only endpoint. This change applies to future imports; the inspected snapshot was not reloaded.

## Planning snapshot validation

The standalone planning endpoint ignores a supplied stale snapshot ID and returns HTTP 200. Claude Code owns the fix in the API. Compare the supplied ID against the current network and barrier snapshot before simulation, and bind cached plans to that same snapshot. The regression in `experiments/test_snapshot_validation.py` expects HTTP 409. Route analysis already rejects stale requests and mismatched plans after a barrier-only change.

## Barriers pagination layout

The pagination nav in `ReportsExplorer.tsx` forces two buttons and a variable-length status into one flex row. The containing sidebar in `BarrierExplorer.tsx` is 20–24 rem wide even on large screens. Give the status its own row and the buttons two equal, shrinkable columns. Keep the native disabled conditions, focus treatment, and 44 px minimum target height. Keep the footer in normal flow and allow long report names and detail values to wrap within shrinkable grid tracks. Check both page boundaries and unavailable results at 320 px and in the narrow desktop sidebar. All eight ReportsExplorer component tests passed; they do not measure rendered geometry.

## 2026-11-18 — Barrier reporting form (for Claude Code)

`ReportForm.tsx` tells users to check the reports list after a submission error but renders the instruction as plain text. Add a keyboard- and touch-accessible link to the existing reports view. Preserve the draft for retry and keep photo previews local. Extend the existing failure test to check the link destination, alert focus, and retained input. The existing 10 form tests passed before changes.

## Report confirmation and tracking (for Claude Code)

`ReportForm` discards the POST response and announces “Pending” even if the response omits the state. The existing success fixture returns only an ID and currently asserts that announcement. Show the returned report ID in the receipt. Use the tracking view’s existing verification labels for recognized states and its “Unknown status” fallback for missing or unfamiliar values. Link to submitted reports at `/barriers`, where the same ID identifies the report. For a lost connection, preserve the draft and link to the list so the reporter can check before retrying. A rate-limit rejection should retain its own wait instruction.

Proposed focused regression for `ReportForm.test.tsx`, using its existing ID-only success fixture:

```tsx
it("shows the receipt ID without guessing a missing verification status", async () => {
  await loadedForm();
  const user = await fillRequired();
  await user.click(screen.getByRole("button", { name: "Submit report" }));
  const receipt = await screen.findByRole("status", { name: "Report submitted" });
  expect(receipt).toHaveTextContent("report-1");
  expect(receipt).toHaveTextContent(/unknown status/i);
  expect(receipt).not.toHaveTextContent(/pending|verified/i);
  expect(receipt).toHaveFocus();
});
```
