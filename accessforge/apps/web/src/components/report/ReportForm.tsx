"use client";

import { useEffect, useRef, useState, type FormEvent, type Ref } from "react";
import { BARRIER_TYPES, BARRIER_TYPE_LABELS, type LngLat } from "@/lib/barriers";
import {
  MAX_DESCRIPTION_LENGTH,
  validateReport,
  type ReportDraft,
  type ReportErrors,
} from "@/lib/report";
import { submitReport } from "@/lib/reports-api";
import { PhotoField } from "./PhotoField";
import { FieldError, INPUT_CLASS } from "./ReportField";
import { ReportLocation } from "./ReportLocation";

const EMPTY_DRAFT: ReportDraft = { type: "", description: "", latitude: "", longitude: "" };

function ErrorSummary({
  errors,
  summaryRef,
}: {
  readonly errors: ReportErrors;
  readonly summaryRef: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={summaryRef}
      role="alert"
      aria-labelledby="report-errors-heading"
      tabIndex={-1}
      className="rounded-lg border-2 border-warning bg-warning-soft p-4 text-ink"
    >
      <h2 id="report-errors-heading" className="font-semibold">
        Please correct your report
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {Object.entries(errors)
          .filter(([, error]) => Boolean(error))
          .map(([field, error]) => (
            <li key={field}>
              <a
                href={`#report-${field}`}
                className="underline"
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById(`report-${field}`)?.focus();
                }}
              >
                {error}
              </a>
            </li>
          ))}
      </ul>
    </div>
  );
}

function ReportDescription({
  draft,
  errors,
  onEdit,
}: {
  readonly draft: ReportDraft;
  readonly errors: ReportErrors;
  readonly onEdit: (field: keyof ReportDraft, value: string) => void;
}) {
  return (
    <>
      <div>
        <label htmlFor="report-type" className="font-medium text-ink">
          Barrier type
        </label>
        <select
          id="report-type"
          required
          value={draft.type}
          onChange={(event) => onEdit("type", event.target.value)}
          className={INPUT_CLASS}
          aria-invalid={Boolean(errors.type)}
          aria-describedby={errors.type ? "report-type-error" : undefined}
        >
          <option value="">Choose a type</option>
          {BARRIER_TYPES.map((type) => (
            <option key={type} value={type}>
              {BARRIER_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <FieldError id="report-type-error" error={errors.type} />
      </div>
      <div>
        <label htmlFor="report-description" className="font-medium text-ink">
          Description
        </label>
        <p id="description-help" className="mt-1 text-sm text-muted">
          Describe the barrier, without names or private information. Up to {MAX_DESCRIPTION_LENGTH}{" "}
          characters.
        </p>
        <textarea
          id="report-description"
          required
          rows={4}
          maxLength={MAX_DESCRIPTION_LENGTH}
          value={draft.description}
          onChange={(event) => onEdit("description", event.target.value)}
          className={INPUT_CLASS}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={`description-help${errors.description ? " report-description-error" : ""}`}
        />
        <FieldError id="report-description-error" error={errors.description} />
      </div>
    </>
  );
}

export function ReportForm() {
  const [severity, setSeverity] = useState("");
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState("");
  const locked = useRef(false);
  const [draft, setDraft] = useState<ReportDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<ReportErrors>({});
  const [photoProblem, setPhotoProblem] = useState<string | undefined>();
  const [attempts, setAttempts] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (attempts) (confirmed ? confirmationRef : summaryRef).current?.focus();
  }, [attempts, confirmed]);

  function edit(field: keyof ReportDraft, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => {
      const next = { ...previous };
      delete next[field];
      return next;
    });
    setConfirmed(false);
  }
  function chooseLocation(location: LngLat) {
    setDraft((previous) => ({
      ...previous,
      latitude: location.lat.toFixed(6),
      longitude: location.lng.toFixed(6),
    }));
    setErrors((previous) => {
      const next = { ...previous };
      delete next.latitude;
      delete next.longitude;
      return next;
    });
    setConfirmed(false);
  }
  function changePhoto(error: string | undefined) {
    setPhotoProblem(error);
    setErrors((previous) => {
      const next = { ...previous };
      delete next.photo;
      return next;
    });
    setConfirmed(false);
  }
  async function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || confirmed) return;
    const problems = {
      ...validateReport(draft),
      ...(photoProblem ? { photo: photoProblem } : {}),
      ...(!severity ? { severity: "Choose a severity from 1 to 5." } : {}),
    };
    setErrors(problems);
    setFailure("");
    if (Object.keys(problems).length === 0) {
      locked.current = true;
      setSending(true);
      try {
        await submitReport(draft, Number(severity));
        setConfirmed(true);
      } catch (error) {
        setFailure(
          `${error instanceof Error ? error.message : "Submission failed."} Your report may have arrived if the connection was lost. Check the reports list before retrying.`,
        );
      } finally {
        locked.current = false;
        setSending(false);
      }
    }
    setAttempts((count) => count + 1);
  }
  return (
    <form noValidate onSubmit={check} className="space-y-6" aria-label="Barrier report">
      {Object.values(errors).some(Boolean) ? (
        <ErrorSummary errors={errors} summaryRef={summaryRef} />
      ) : null}
      {confirmed ? (
        <div
          ref={confirmationRef}
          role="status"
          aria-label="Report submitted"
          tabIndex={-1}
          className="rounded-lg border border-success bg-success-soft p-4 text-ink"
        >
          <h2 className="font-semibold">Report submitted</h2>
          <p>
            Your report was saved with status Pending, awaiting verification. This is not an
            official inspection. Any photo preview stayed on this device.
          </p>
        </div>
      ) : null}
      <p className="text-sm text-muted">
        All fields except the local photo preview are required. Submitting saves a real, public,
        pending report. Do not include personal information.
      </p>
      {failure ? (
        <p ref={summaryRef} tabIndex={-1} role="alert" className="text-ink">
          {failure}
        </p>
      ) : null}
      {sending ? <p role="status">Submitting report…</p> : null}
      <fieldset disabled={sending || confirmed} className="space-y-6">
        <ReportDescription draft={draft} errors={errors} onEdit={edit} />
        <ReportLocation draft={draft} errors={errors} onEdit={edit} onSelect={chooseLocation} />
        <div>
          <label htmlFor="report-severity" className="font-medium text-ink">
            Severity (1–5)
          </label>
          <select
            id="report-severity"
            value={severity}
            required
            aria-invalid={Boolean(errors.severity)}
            aria-describedby={errors.severity ? "report-severity-error" : undefined}
            onChange={(event) => {
              setSeverity(event.target.value);
              setErrors((previous) => ({ ...previous, severity: undefined }));
            }}
            className={INPUT_CLASS}
          >
            <option value="">Choose severity</option>
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <FieldError id="report-severity-error" error={errors.severity} />
        </div>
        <PhotoField error={photoProblem} onError={changePhoto} />
        <button
          type="submit"
          className="min-h-11 rounded-md bg-accent px-5 py-3 font-semibold text-surface hover:bg-ink"
        >
          {sending ? "Submitting…" : confirmed ? "Report submitted" : "Submit report"}
        </button>
      </fieldset>
    </form>
  );
}
