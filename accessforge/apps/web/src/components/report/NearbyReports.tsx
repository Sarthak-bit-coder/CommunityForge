"use client";

import { useEffect, useRef, useState } from "react";
import type { BarrierType, LngLat } from "@/lib/barriers";
import { fetchReports, isReportId, reportStatusLabel } from "@/lib/reports-api";

const NEARBY_METERS = 100;
type Match = { id: string; meters: number; status: string };

export function NearbyReports({ type, point }: { type: BarrierType; point: LngLat }) {
  const [matches, setMatches] = useState<readonly Match[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(1);
  const [checked, setChecked] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function check() {
    if (pending.current || nextPage === null) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError("");
    try {
      const [{ data, meta }, { LngLat: Coordinates }] = await Promise.all([
        fetchReports({ type, state: "all" }, nextPage, controller.signal, "omit"),
        import("maplibre-gl"),
      ]);
      if (controller.signal.aborted) return;
      const center = new Coordinates(point.lng, point.lat);
      const nearby = data.flatMap((report) => {
        if (!isReportId(report.id) || report.type !== type) return [];
        const meters = center.distanceTo(
          new Coordinates(report.location.longitude, report.location.latitude),
        );
        return meters <= NEARBY_METERS
          ? [{ id: report.id, meters, status: reportStatusLabel(report.state) }]
          : [];
      });
      setMatches((previous) =>
        [...new Map([...previous, ...nearby].map((r) => [r.id, r])).values()].sort(
          (a, b) => a.meters - b.meters,
        ),
      );
      setTotal(meta.total);
      setChecked(checked + data.length);
      setNextPage(data.length && meta.page * meta.limit < meta.total ? nextPage + 1 : null);
    } catch {
      if (!controller.signal.aborted)
        setError("Could not check nearby reports. Try again or continue submitting.");
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <section aria-label="Nearby reports" className="space-y-2">
      <p>Check for reports of the same barrier type within {NEARBY_METERS} m of this point.</p>
      {nextPage !== null && (
        <button className="af-button-secondary" type="button" disabled={busy} onClick={check}>
          {busy ? "Checking…" : checked ? "Check older reports" : "Check nearby reports"}
        </button>
      )}
      <p aria-live="polite">
        {busy
          ? "Checking nearby reports…"
          : total !== null
            ? `Checked ${checked} of ${total} reports. ${matches.length} nearby.`
            : ""}
      </p>
      {error && <p role="alert">{error}</p>}
      {matches.length > 0 && (
        <>
          <p>Open a possible match in a new tab, or continue reporting a different barrier.</p>
          <ul>
            {matches.map((r) => (
              <li key={r.id}>
                <a
                  className="af-link inline-block min-h-11 break-all"
                  href={`/report/track?id=${r.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Report {r.id} · about {Math.round(r.meters)} m · {r.status} (new tab)
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
