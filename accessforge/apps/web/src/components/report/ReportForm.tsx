"use client";

import Link from "next/link";
import { m } from "motion/react";
import { useEffect, useRef, useState, type FormEvent, type Ref } from "react";
import {
  MOTION_DURATION_S,
  MOTION_EASE_ENTER,
  MOTION_OFFSET_PX,
} from "@/components/motion/motion-tokens";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";
import type { LngLat } from "@/lib/barriers";
import {
  MAX_DESCRIPTION_LENGTH,
  parseLocation,
  validateReport,
  type ReportDraft,
  type ReportErrors,
} from "@/lib/report";
import { isReportId, reportStatusLabel, submitReport } from "@/lib/reports-api";
import { PhotoField } from "./PhotoField";
import { FieldError, INPUT_CLASS } from "./ReportField";
import { ReportLocation } from "./ReportLocation";
import { ReportProgress, type ProgressItem } from "./ReportProgress";
import { SeverityScale } from "./SeverityScale";
import { StepStatus } from "./StepStatus";
import { TypeChoice } from "./TypeChoice";
import { ValidationAlert, type StepCheck } from "./ValidationAlert";
import { Toaster, usePromiseToast } from "@/components/ui/PromiseToast";

const EMPTY_DRAFT: ReportDraft = { type: "", description: "", latitude: "", longitude: "" };
// The counter turns to the warning colour near the limit.
const DESCRIPTION_WARN_SHARE = 0.9;

// Which checklist step each field error belongs to. Latitude and longitude are one step.
const STEP_FOR_FIELD: Readonly<Record<string, string>> = {
  type: "report-type",
  description: "report-description",
  latitude: "report-latitude",
  longitude: "report-latitude",
  severity: "report-severity",
  photo: "report-photo",
};

/** The steps that failed at submit, each still showing its original error text until fixed. */
function stepChecks(
  submitErrors: ReportErrors,
  items: readonly ProgressItem[],
  photoProblem: string | undefined,
): readonly StepCheck[] {
  const details = new Map<string, string[]>();
  for (const [field, error] of Object.entries(submitErrors)) {
    const target = STEP_FOR_FIELD[field];
    if (target && error) details.set(target, [...(details.get(target) ?? []), error]);
  }
  return items
    .filter((item) => details.has(item.target))
    .map((item) => ({
      name: item.label,
      target: item.target,
      detail: (details.get(item.target) ?? []).join(" "),
      isOk: item.target === "report-photo" ? !photoProblem : item.isDone,
    }));
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
  const share = draft.description.length / MAX_DESCRIPTION_LENGTH;
  const isNearLimit = share >= DESCRIPTION_WARN_SHARE;
  return (
    <>
      <TypeChoice
        value={draft.type}
        error={errors.type}
        onChange={(type) => onEdit("type", type)}
      />
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
        {/* Visual only: the help text already states the limit, and maxLength enforces it. */}
        <div aria-hidden="true" className="mt-2 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
            <div
              className={`h-full origin-left rounded-full transition-[transform,background-color] duration-150 ${isNearLimit ? "bg-warning" : "bg-accent"}`}
              style={{ transform: `scaleX(${share})` }}
            />
          </div>
          <span
            className={`text-xs tabular-nums ${isNearLimit ? "font-semibold text-warning" : "text-muted"}`}
          >
            {draft.description.length} / {MAX_DESCRIPTION_LENGTH}
          </span>
        </div>
        <FieldError id="report-description-error" error={errors.description} />
      </div>
    </>
  );
}

function Confirmation({
  receipt,
  confirmationRef,
}: {
  readonly receipt: { readonly id: string; readonly status: string };
  readonly confirmationRef: Ref<HTMLHeadingElement>;
}) {
  const reduceMotion = usePrefersReducedMotion();
  return (
    <m.div
      role="status"
      aria-label="Report submitted"
      initial={{ opacity: 0, y: MOTION_OFFSET_PX }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION_DURATION_S.slow, ease: MOTION_EASE_ENTER }}
      className="flex gap-4 rounded-xl border border-success bg-success-soft p-5 text-ink"
    >
      <svg aria-hidden="true" viewBox="0 0 32 32" className="size-9 shrink-0">
        <circle cx="16" cy="16" r="15" className="fill-success" />
        <m.path
          d="M9.5 16.5 14 21l8.5-9"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-surface"
          initial={{ pathLength: reduceMotion ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{
            duration: reduceMotion ? 0 : MOTION_DURATION_S.slow,
            ease: MOTION_EASE_ENTER,
          }}
        />
      </svg>
      <div>
        <h2 ref={confirmationRef} tabIndex={-1} className="font-semibold">
          Report submitted
        </h2>
        <p>
          {receipt.status === "Status unavailable"
            ? "Your report was saved. Status unavailable."
            : `Your report was saved with status ${receipt.status}.`}{" "}
          Any photo preview stayed on this device.
        </p>
        <p className="break-all">Report ID: {receipt.id}</p>
        <Link
          className="af-link inline-flex min-h-11 items-center"
          href={`/report/track?id=${receipt.id}`}
        >
          Track this report
        </Link>
      </div>
    </m.div>
  );
}

function progressItems(
  draft: ReportDraft,
  severity: string,
  hasPhoto: boolean,
): readonly ProgressItem[] {
  return [
    { label: "Barrier type", target: "report-type", isDone: draft.type !== "" },
    {
      label: "Description",
      target: "report-description",
      isDone: draft.description.trim() !== "",
    },
    {
      label: "Location",
      target: "report-latitude",
      isDone: parseLocation(draft.latitude, draft.longitude) !== null,
    },
    { label: "Severity", target: "report-severity", isDone: severity !== "" },
    { label: "Photo (optional)", target: "report-photo", isDone: hasPhoto, isOptional: true },
  ];
}

export function ReportForm() {
  const [severity, setSeverity] = useState("");
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState("");
  const locked = useRef(false);
  const [draft, setDraft] = useState<ReportDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<ReportErrors>({});
  const [photoProblem, setPhotoProblem] = useState<string | undefined>();
  const [hasPhoto, setHasPhoto] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [receipt, setReceipt] = useState<{ id: string; status: string } | null>(null);
  const confirmed = receipt !== null;
  const summaryRef = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Field errors as they stood at the last submit; the alert lists their steps until resubmitted.
  const [submitErrors, setSubmitErrors] = useState<ReportErrors>({});
  const toaster = usePromiseToast();
  const reduceMotion = usePrefersReducedMotion();
  const items = progressItems(draft, severity, hasPhoto);
  const checks = stepChecks(submitErrors, items, photoProblem);
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
    setReceipt(null);
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
    setReceipt(null);
  }
  function changePhoto(error: string | undefined) {
    setPhotoProblem(error);
    setErrors((previous) => {
      const next = { ...previous };
      delete next.photo;
      return next;
    });
    setReceipt(null);
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
    setSubmitErrors(problems);
    setFailure("");
    if (Object.keys(problems).length === 0) {
      locked.current = true;
      setSending(true);
      try {
        await toaster.show(save, {
          loading: "Submitting report",
          success: ["Report submitted", "It is pending verification by a reviewer."],
          error: (error) => [
            "Report not submitted",
            error instanceof Error ? error.message : "Submission failed.",
          ],
          // Retry re-runs the whole submit, so it checks the current form again.
          onRetry: () => formRef.current?.requestSubmit(),
        });
      } catch {
        // save() already recorded the failure for the page; the toast shows it with Retry.
      } finally {
        locked.current = false;
        setSending(false);
      }
    }
    setAttempts((count) => count + 1);
  }
  async function save() {
    try {
      const response = await submitReport(draft, Number(severity));
      if (!isReportId(response?.data?.id))
        throw new Error("The service returned no valid report ID.");
      setReceipt({ id: response.data.id, status: reportStatusLabel(response.data.state) });
    } catch (error) {
      setFailure(
        `${error instanceof Error ? error.message : "Submission failed."} Your report may have arrived if the connection was lost.`,
      );
      throw error;
    }
  }
  return (
    <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <form
        ref={formRef}
        noValidate
        onSubmit={check}
        className="space-y-8"
        aria-label="Barrier report"
      >
        {checks.length > 0 ? <ValidationAlert checks={checks} alertRef={summaryRef} /> : null}
        {receipt ? <Confirmation receipt={receipt} confirmationRef={confirmationRef} /> : null}
        <p className="text-sm text-muted">
          All fields except the local photo preview are required. Submitting saves a real, pending
          report. The description is shown publicly only after a reviewer confirms it. Do not
          include personal information.
        </p>
        {failure ? (
          <p ref={summaryRef} tabIndex={-1} role="alert" className="text-ink">
            {failure}{" "}
            <Link href="/barriers" className="af-link">
              Check the reports list before retrying
            </Link>
            .
          </p>
        ) : null}
        <fieldset disabled={sending || confirmed} className="min-w-0 space-y-8">
          <ReportDescription draft={draft} errors={errors} onEdit={edit} />
          <ReportLocation draft={draft} errors={errors} onEdit={edit} onSelect={chooseLocation} />
          <SeverityScale
            value={severity}
            error={errors.severity}
            onChange={(value) => {
              setSeverity(value);
              setErrors((previous) => ({ ...previous, severity: undefined }));
            }}
          />
          <PhotoField error={photoProblem} onError={changePhoto} onPhotoChange={setHasPhoto} />
          {confirmed ? null : <StepStatus items={items} />}
          <button type="submit" className="af-button-primary min-w-44">
            {sending ? (
              <span
                aria-hidden="true"
                // Under reduced motion the ring stays still; the button text says it is working.
                className={`size-4 rounded-full border-2 border-surface/40 border-t-surface ${reduceMotion ? "" : "animate-spin"}`}
              />
            ) : null}
            {sending ? "Submitting…" : confirmed ? "Report submitted" : "Submit report"}
          </button>
        </fieldset>
      </form>
      {/* Pinned beside the form on wide screens; phones keep the single column. */}
      <div className="hidden lg:sticky lg:top-24 lg:block">
        <ReportProgress items={items} />
      </div>
      <Toaster toaster={toaster} />
    </div>
  );
}
