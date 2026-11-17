"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BARRIER_TYPES,
  BARRIER_TYPE_LABELS,
  STATE_DISPLAY,
  VERIFICATION_STATES,
} from "@/lib/barriers";
import { dataUri } from "@/lib/planning-api";
import { fetchSummary, type ReportSummary } from "@/lib/reports-api";

const PERCENT = 100;
const TH = "border-b border-line px-3 py-2 text-left font-semibold text-ink";
const TD = "border-b border-line px-3 py-2 align-top";
const NOTICE =
  "Counts of community reports submitted to AccessForge. Unverified unless marked verified. Not an official inspection or a City of Fremont record.";

function day(value: string | null): string {
  return value ? value.slice(0, 10) : "No reports yet";
}

export function summaryCsv(summary: ReportSummary): string {
  const rows = [
    ["notice", `"${NOTICE}"`],
    ["first_report_at", summary.first_report_at ?? ""],
    ["last_report_at", summary.last_report_at ?? ""],
    ["total_reports", summary.total],
    [],
    ["group", "key", "reports"],
    ...VERIFICATION_STATES.map((state) => ["status", state, summary.by_state[state] ?? 0]),
    ...BARRIER_TYPES.map((type) => ["barrier_type", type, summary.by_type[type] ?? 0]),
  ];
  return rows.map((row) => row.join(",")).join("\n");
}

function CountTable({
  caption,
  rows,
  total,
}: {
  readonly caption: string;
  readonly rows: readonly (readonly [string, number])[];
  readonly total: number;
}) {
  return (
    <div
      role="region"
      aria-label={`${caption}, scrollable table`}
      tabIndex={0}
      className="overflow-x-auto rounded-lg border border-line bg-surface"
    >
      <table className="w-full border-collapse text-sm">
        <caption className={`${TH} border-b-0`}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={TH}>
              Group
            </th>
            <th scope="col" className={TH}>
              Reports
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, count]) => (
            <tr key={label}>
              <th scope="row" className={`${TD} text-left font-normal`}>
                {label}
              </th>
              <td className={TD}>
                {count}
                <span
                  aria-hidden="true"
                  className="mt-1 block h-2 rounded bg-accent"
                  style={{ width: `${total ? Math.max((count / total) * PERCENT, 1) : 1}%` }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PilotDashboard({ feedbackEmail }: { readonly feedbackEmail: string | null }) {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchSummary(controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setSummary(response.data);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : "Could not load the summary.");
      });
    return () => controller.abort();
  }, [attempt]);

  const verified = summary?.by_state.confirmed ?? 0;
  const pending = summary?.by_state.unverified ?? 0;

  return (
    <div className="space-y-10">
      <aside
        aria-labelledby="pilot-status-heading"
        className="rounded-lg border border-warning bg-warning-soft p-4 text-ink"
      >
        <h2 id="pilot-status-heading" className="font-semibold">
          Pilot preview, not an official dashboard
        </h2>
        <p className="mt-1">
          AccessForge is an independent project preparing a pilot in Fremont, California. The City
          of Fremont has not reviewed, endorsed, or adopted it. No repair has been made or confirmed
          because of anything shown here.
        </p>
      </aside>

      <section aria-labelledby="counts-heading">
        <h2 id="counts-heading" className="text-xl font-semibold text-ink">
          Reports received
        </h2>
        {error ? (
          <div role="alert" className="mt-3">
            <p>{error}</p>
            <button
              type="button"
              className="min-h-11 underline"
              onClick={() => {
                setError("");
                setAttempt((value) => value + 1);
              }}
            >
              Retry summary
            </button>
          </div>
        ) : !summary ? (
          <p role="status" className="mt-3 text-muted">
            Loading report counts…
          </p>
        ) : (
          <>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["Total reports", summary.total, "Everything submitted through this site."],
                  ["Verified", verified, "Confirmed by a signed-in reviewer."],
                  ["Pending", pending, "Not yet checked. Treat as unconfirmed."],
                ] as const
              ).map(([label, value, note]) => (
                <div key={label} className="rounded-lg border border-line bg-surface p-4">
                  <dt className="text-sm font-medium text-muted">{label}</dt>
                  <dd className="mt-1 text-3xl font-bold text-ink">{value}</dd>
                  <dd className="mt-1 text-sm text-muted">{note}</dd>
                </div>
              ))}
            </dl>
            {summary.total === 0 ? (
              <p className="mt-4 text-muted">
                No reports have been submitted yet.{" "}
                <Link href="/report" className="font-semibold text-accent underline">
                  Report the first barrier
                </Link>
                .
              </p>
            ) : null}
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <CountTable
                caption="By verification status"
                total={summary.total}
                rows={VERIFICATION_STATES.map(
                  (state) => [STATE_DISPLAY[state].label, summary.by_state[state] ?? 0] as const,
                )}
              />
              <CountTable
                caption="By barrier type"
                total={summary.total}
                rows={BARRIER_TYPES.map(
                  (type) => [BARRIER_TYPE_LABELS[type], summary.by_type[type] ?? 0] as const,
                )}
              />
            </div>
            <p className="mt-4">
              <a
                className="inline-flex min-h-11 items-center rounded-md border border-line bg-surface px-4 font-semibold text-accent underline"
                download="accessforge-pilot-summary.csv"
                href={dataUri("text/csv", summaryCsv(summary))}
              >
                Download pilot summary (CSV)
              </a>
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="provenance-heading">
        <h2 id="provenance-heading" className="text-xl font-semibold text-ink">
          Where the data comes from
        </h2>
        <dl className="mt-3 grid max-w-prose grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt className="font-semibold text-ink">Source</dt>
          <dd>Community reports submitted through this site. No city records are loaded.</dd>
          <dt className="font-semibold text-ink">First report</dt>
          <dd>{summary ? day(summary.first_report_at) : "Unavailable"}</dd>
          <dt className="font-semibold text-ink">Latest report</dt>
          <dd>{summary ? day(summary.last_report_at) : "Unavailable"}</dd>
          <dt className="font-semibold text-ink">Locations</dt>
          <dd>
            Shown on the{" "}
            <Link href="/barriers" className="font-semibold text-accent underline">
              barrier map and list
            </Link>
            . Reports are anonymous; no names, contact details, or photos are stored.
          </dd>
        </dl>
      </section>

      <section aria-labelledby="modeled-heading">
        <h2 id="modeled-heading" className="text-xl font-semibold text-ink">
          Modeled repair planning
        </h2>
        <p className="mt-2 max-w-prose">
          There is no modeled accessibility estimate for Fremont yet. The pedestrian network,
          destinations, and repair costs for the pilot area have not been loaded, so the
          optimization engine currently runs only on labeled synthetic networks. Compare scenarios
          and download results in the{" "}
          <Link href="/planner" className="font-semibold text-accent underline">
            repair planner
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="limits-heading">
        <h2 id="limits-heading" className="text-xl font-semibold text-ink">
          Method and limits
        </h2>
        <ul className="mt-3 max-w-prose list-disc space-y-1 pl-5">
          <li>
            A report is one person’s observation. “Verified” means a signed-in reviewer accepted it
            and recorded a reason; it is not a city inspection or an ADA determination.
          </li>
          <li>Counts reflect who chose to report, not how many barriers exist.</li>
          <li>Several reports can describe the same barrier; duplicates are not merged yet.</li>
          <li>Nothing here says a route is safe or usable.</li>
        </ul>
      </section>

      <section aria-labelledby="feedback-heading">
        <h2 id="feedback-heading" className="text-xl font-semibold text-ink">
          Feedback from advocates, residents, and city staff
        </h2>
        {feedbackEmail ? (
          <p className="mt-2 max-w-prose">
            Tell us what is wrong, missing, or unclear:{" "}
            <a
              className="font-semibold text-accent underline"
              href={`mailto:${feedbackEmail}?subject=${encodeURIComponent("AccessForge pilot feedback")}`}
            >
              {feedbackEmail}
            </a>
            . Please do not include private details about other people.
          </p>
        ) : (
          <p className="mt-2 max-w-prose text-muted">
            A feedback contact has not been set up for this deployment yet.
          </p>
        )}
      </section>
    </div>
  );
}
