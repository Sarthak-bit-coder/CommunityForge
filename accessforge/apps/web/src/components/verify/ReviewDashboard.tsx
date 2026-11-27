"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LiveReports } from "@/components/barriers/ReportsExplorer";
import { fetchSession, signIn, signOut } from "@/lib/review-api";
import { FieldChecklist, type FieldVisit } from "./FieldChecklist";
import { ReviewForm } from "./ReviewForm";

const BUTTON = "min-h-11 rounded-md border border-accent px-4 font-semibold disabled:opacity-60";

/** Public visitors get the read-only queue; signed-in reviewers also get decisions. */
export function ReviewDashboard() {
  const [reviewer, setReviewer] = useState<string | null>(null);
  const [visits, setVisits] = useState<readonly FieldVisit[]>([]);
  const remove = (id: string) => setVisits((items) => items.filter((item) => item.id !== id));
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchSession(controller.signal)
      .then((id) => {
        if (!controller.signal.aborted) setReviewer(id);
      })
      .catch(() => undefined); // Aborted on unmount; the visitor stays read-only.
    return () => controller.abort();
  }, []);

  async function handleSignIn(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsBusy(true);
    try {
      setReviewer(await signIn(key));
      setKey("");
      setNotice("Signed in as a reviewer.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Sign-in failed.");
    }
    setIsBusy(false);
  }

  async function handleSignOut() {
    setError("");
    try {
      await signOut();
      setVisits([]);
      setReviewer(null);
      setNotice("Signed out.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Sign-out failed.");
    }
  }

  return (
    <>
      <aside
        aria-labelledby="review-access-heading"
        className="print:hidden mb-6 rounded-lg border border-warning bg-warning-soft p-4 text-ink"
      >
        <h2 id="review-access-heading" className="font-semibold">
          {reviewer ? "Signed in as a reviewer" : "Read-only verification dashboard"}
        </h2>
        {reviewer ? (
          <>
            <p className="break-words">
              Reviewer ID {reviewer}. Select a pending report to verify or reject it, or change the
              status filter to record the next repair step for a verified report. Each decision is
              recorded with your ID, your reason, and the time.
            </p>
            <button type="button" className={`${BUTTON} mt-3 bg-surface`} onClick={handleSignOut}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <p>
              Anyone can inspect reports here. Only signed-in reviewers can verify or reject them,
              so approve and reject controls are hidden until you sign in.
            </p>
            <form onSubmit={handleSignIn} className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="reviewer-key" className="block font-medium">
                  Reviewer access key
                </label>
                <input
                  id="reviewer-key"
                  type="password"
                  autoComplete="off"
                  required
                  className="mt-1 min-h-11 w-64 max-w-full rounded border border-control bg-surface p-2"
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={isBusy || !key}
                className={`${BUTTON} bg-accent text-surface`}
              >
                Sign in
              </button>
            </form>
          </>
        )}
        {error ? (
          <p role="alert" className="mt-3 font-medium">
            {error}
          </p>
        ) : null}
        <p className="mt-3">
          Pending reports await verification. Verified reports have been confirmed by a reviewer.
          Rejected reports were not accepted by a reviewer. Verified barriers then move through
          repair planned, repair completed, and resolved; resolved needs a follow-up site visit.
          These records are not official inspections or City repair records.
        </p>
      </aside>
      <p role="status" className="print:hidden mb-4 font-medium text-ink">
        {notice}
      </p>
      {reviewer && <FieldChecklist visits={visits} remove={remove} />}
      <div className={reviewer ? "print:hidden" : undefined}>
        <LiveReports
          initialFilter={{ type: "all", state: "unverified" }}
          review={
            reviewer
              ? (report, reload) => (
                  <>
                    {report.state === "unverified" && (
                      <button
                        type="button"
                        className="af-button-secondary mb-3"
                        disabled={visits.some((item) => item.id === report.id)}
                        onClick={() =>
                          setVisits((items) =>
                            items.some((item) => item.id === report.id)
                              ? items
                              : [
                                  ...items,
                                  { id: report.id, type: report.type, location: report.location },
                                ],
                          )
                        }
                      >
                        {visits.some((item) => item.id === report.id)
                          ? "Added to checklist"
                          : "Add to field checklist"}
                      </button>
                    )}
                    <ReviewForm
                      key={report.id}
                      report={report}
                      onReviewed={(message) => {
                        remove(report.id);
                        setNotice(message);
                        reload();
                      }}
                    />
                  </>
                )
              : undefined
          }
        />
      </div>
    </>
  );
}
