"use client";

import { useEffect, useState, type FormEvent } from "react";
import { verificationDisplay, type Barrier } from "@/lib/barriers";
import {
  REASON_MAX_LENGTH,
  REPAIR_STEPS,
  fetchReviews,
  submitReview,
  type Review,
  type ReviewDecision,
} from "@/lib/review-api";

const BUTTON = "min-h-11 rounded-md border px-4 font-semibold disabled:opacity-60";
const REASON_ERROR_ID = "review-reason-error";

function doneMessage(report: Barrier, decision: ReviewDecision): string {
  if (decision === "verified") return `${report.name} was marked verified.`;
  if (decision === "rejected") return `${report.name} was rejected.`;
  return `${report.name} was ${REPAIR_STEPS[report.state]?.done ?? "updated"}.`;
}

/** Decide one report's next lifecycle step, and show its private audit history. */
export function ReviewForm({
  report,
  onReviewed,
}: {
  readonly report: Barrier;
  readonly onReviewed: (message: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState<readonly Review[] | null>(null);
  const repairStep = REPAIR_STEPS[report.state];
  const canDecide = report.state === "unverified" || repairStep !== undefined;

  useEffect(() => {
    const controller = new AbortController();
    fetchReviews(report.id, controller.signal)
      .then((reviews) => {
        if (!controller.signal.aborted) setHistory(reviews);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : "Could not load review history.");
      });
    return () => controller.abort();
  }, [report.id]);

  async function decide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const decision = submitter?.value as ReviewDecision;
    if (!reason.trim()) {
      setReasonError("Give a reason. It is recorded with your decision.");
      // After the error renders, so screen readers announce it as the field's description.
      requestAnimationFrame(() => document.getElementById("review-reason")?.focus());
      return;
    }
    setReasonError("");
    setError("");
    setIsSubmitting(true);
    try {
      await submitReview(report.id, decision, reason);
      onReviewed(doneMessage(report, decision));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The review was not saved.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-5 border-t border-line pt-4">
      <h3 className="font-semibold text-ink">Review and repair history</h3>
      {history === null ? (
        <p className="text-muted">{error ? "Unavailable." : "Loading review history…"}</p>
      ) : history.length === 0 ? (
        <p className="text-muted">No review has been recorded for this report.</p>
      ) : (
        <ol className="mt-1 space-y-2">
          {history.map((review) => (
            <li key={review.id} className="break-words text-sm">
              <span className="font-semibold text-ink">
                {verificationDisplay(review.to_state).label}
              </span>{" "}
              on {review.reviewed_at} by reviewer {review.reviewer_id}
              <span className="block text-muted">Reason: {review.reason}</span>
            </li>
          ))}
        </ol>
      )}
      {canDecide ? (
        <form onSubmit={decide} noValidate className="mt-4 space-y-3">
          <label htmlFor="review-reason" className="block font-semibold text-ink">
            {repairStep ? "Note for this repair update" : "Reason for your decision"}
          </label>
          <textarea
            id="review-reason"
            className="block min-h-24 w-full rounded border border-control bg-surface p-2"
            maxLength={REASON_MAX_LENGTH}
            value={reason}
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={reasonError ? REASON_ERROR_ID : "review-reason-help"}
            onChange={(event) => setReason(event.target.value)}
          />
          <p id="review-reason-help" className="text-sm text-muted">
            {repairStep ? `${repairStep.help} ` : ""}
            Saved permanently in the audit log with your reviewer ID and the time. A decision cannot
            be edited or undone here.
          </p>
          {reasonError ? (
            <p id={REASON_ERROR_ID} className="font-medium text-warning">
              {reasonError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {repairStep ? (
              <button
                type="submit"
                value={repairStep.decision}
                disabled={isSubmitting}
                className={`${BUTTON} border-accent bg-accent text-surface`}
              >
                {repairStep.action}
              </button>
            ) : (
              <>
                <button
                  type="submit"
                  value="verified"
                  disabled={isSubmitting}
                  className={`${BUTTON} border-success bg-success text-surface`}
                >
                  ✓ Verify report
                </button>
                <button
                  type="submit"
                  value="rejected"
                  disabled={isSubmitting}
                  className={`${BUTTON} border-warning bg-surface text-warning`}
                >
                  ✕ Reject report
                </button>
              </>
            )}
          </div>
        </form>
      ) : (
        <p className="mt-3 text-muted">
          {report.state === "resolved"
            ? "This repair is resolved. No further steps remain."
            : report.state === "rejected"
              ? "This report was rejected, so it has no further steps."
              : "This report's status is unavailable, so it cannot be updated here."}
        </p>
      )}
      {error ? (
        <p role="alert" className="mt-3 font-medium text-warning">
          {error}
        </p>
      ) : null}
    </div>
  );
}
