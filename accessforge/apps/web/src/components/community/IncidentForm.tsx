"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { FieldError, INPUT_CLASS } from "@/components/report/ReportField";
import { communityRequest, type Session } from "@/lib/community-api";
import { LocationButton, type Spot } from "./LocationButton";
import { SignInPrompt } from "./SignInPrompt";
import { useCommunity } from "./useCommunity";

const ZIP_PATTERN = /^\d{5}$/;

export function IncidentForm() {
  const { data: session, error: loadError } = useCommunity<Session>("/me");
  const [spot, setSpot] = useState<Spot | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [failure, setFailure] = useState("");

  if (loadError) return <p role="alert">{loadError}</p>;
  if (!session) return <p role="status">Loading…</p>;
  // Reports alert the whole ZIP, so only members can send them.
  const user = session.user;
  if (!user) return <SignInPrompt action="report an incident" />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const problems: Record<string, string> = {};
    if (!text("type")) problems.type = "Choose what happened.";
    if (!text("description")) problems.description = "Describe what happened.";
    if (!ZIP_PATTERN.test(text("zip"))) problems.zip = "Enter a 5-digit ZIP code.";
    setErrors(problems);
    setFailure("");
    if (Object.keys(problems).length) {
      document.getElementById(`incident-${Object.keys(problems)[0]}`)?.focus();
      return;
    }
    if (spot) {
      form.set("lat", String(spot.lat));
      form.set("lng", String(spot.lng));
    }
    setStatus("sending");
    try {
      await communityRequest("/reports", { body: form });
      setStatus("sent");
    } catch (error) {
      setStatus("idle");
      setFailure(error instanceof Error ? error.message : "Your report could not be sent.");
    }
  }

  if (status === "sent")
    return (
      <div role="status" className="af-panel max-w-prose space-y-3 p-5">
        <p className="font-semibold text-ink">Thanks. Your report is on the map.</p>
        <p className="text-muted">Neighbors in that ZIP code have been alerted.</p>
        <Link href="/incidents" className="af-link inline-flex min-h-11 items-center">
          Back to the map
        </Link>
      </div>
    );

  const field = (name: string, label: string, input: ReactNode, help?: string) => (
    <div>
      <label htmlFor={`incident-${name}`} className="font-medium text-ink">
        {label}
      </label>
      {input}
      {help ? <p className="mt-1 text-sm text-muted">{help}</p> : null}
      <FieldError id={`incident-${name}-error`} error={errors[name]} />
    </div>
  );
  const describedBy = (name: string) => (errors[name] ? `incident-${name}-error` : undefined);

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-label="Report an incident"
      className="max-w-prose space-y-5"
    >
      {field(
        "type",
        "What happened?",
        <select
          id="incident-type"
          name="type"
          defaultValue=""
          className={INPUT_CLASS}
          aria-invalid={Boolean(errors.type)}
          aria-describedby={describedBy("type")}
        >
          <option value="">Choose a category</option>
          {Object.entries(session.categories).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>,
      )}
      {field(
        "description",
        "Details",
        <textarea
          id="incident-description"
          name="description"
          rows={4}
          maxLength={2000}
          className={INPUT_CLASS}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={describedBy("description")}
        />,
      )}
      {field(
        "zip",
        "ZIP code",
        <input
          id="incident-zip"
          name="zip"
          inputMode="numeric"
          autoComplete="postal-code"
          defaultValue={user.zip ?? ""}
          className={INPUT_CLASS}
          aria-invalid={Boolean(errors.zip)}
          aria-describedby={describedBy("zip")}
        />,
      )}
      <LocationButton spot={spot} onSpot={setSpot} />
      {field(
        "image",
        "Photo (optional)",
        <input
          id="incident-image"
          name="image"
          type="file"
          accept="image/*"
          className={INPUT_CLASS}
        />,
      )}
      <p className="text-sm text-muted">
        Only admins see who sent a report, to follow up through your account details.
      </p>
      <button type="submit" disabled={status === "sending"} className="af-button-primary">
        {status === "sending" ? "Sending…" : "Send report"}
      </button>
      {failure ? (
        <p role="alert" className="font-medium text-warning">
          {failure}
        </p>
      ) : null}
    </form>
  );
}
