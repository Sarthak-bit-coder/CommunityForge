"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FieldError, INPUT_CLASS } from "@/components/report/ReportField";
import { communityRequest, type LostItem, type Session } from "@/lib/community-api";
import { LocationButton, type Spot } from "./LocationButton";
import { SignInPrompt } from "./SignInPrompt";
import { useCommunity } from "./useCommunity";

const REQUIRED = {
  title: "Give it a short title.",
  description: "Describe it.",
  zip: "Enter a 5-digit ZIP code.",
};
type Field = keyof typeof REQUIRED | "category";

export function LostItemForm() {
  const router = useRouter();
  const { data: session, error: loadError } = useCommunity<Session>("/me");
  const [spot, setSpot] = useState<Spot | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState("");

  if (loadError) return <p role="alert">{loadError}</p>;
  if (!session) return <p role="status">Loading…</p>;
  if (!session.user) return <SignInPrompt action="post a lost or found item" />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const form = new FormData(event.currentTarget);
    const problems: Partial<Record<Field, string>> = {};
    for (const [name, message] of Object.entries(REQUIRED) as [Field, string][]) {
      const value = String(form.get(name) ?? "").trim();
      if (!value || (name === "zip" && !/^\d{5}$/.test(value))) problems[name] = message;
    }
    if (!form.get("category")) problems.category = "Choose a category.";
    setErrors(problems);
    setFailure("");
    const first = Object.keys(problems)[0];
    if (first) {
      document.getElementById(`lf-${first}`)?.focus();
      return;
    }
    if (spot) {
      form.set("lat", String(spot.lat));
      form.set("lng", String(spot.lng));
    }
    setSending(true);
    try {
      const item = await communityRequest<LostItem>("/lost-found", { body: form });
      router.push(`/lost-found/item?id=${item.id}`);
    } catch (error) {
      setSending(false);
      setFailure(error instanceof Error ? error.message : "Your post could not be saved.");
    }
  }

  const invalid = (name: Field) => ({
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `lf-${name}-error` : undefined,
  });

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-label="Post a lost or found item"
      className="max-w-prose space-y-5"
    >
      <fieldset>
        <legend className="font-medium text-ink">Did you lose or find something?</legend>
        <div className="mt-1 flex gap-3">
          {(["lost", "found"] as const).map((kind) => (
            <label
              key={kind}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-surface px-3 has-checked:border-accent has-checked:bg-accent-soft"
            >
              <input type="radio" name="kind" value={kind} defaultChecked={kind === "lost"} />
              {kind === "lost" ? "I lost it" : "I found it"}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="lf-title" className="font-medium text-ink">
          Title
        </label>
        <input
          id="lf-title"
          name="title"
          maxLength={120}
          placeholder="Brown dog, blue keyring…"
          className={INPUT_CLASS}
          {...invalid("title")}
        />
        <FieldError id="lf-title-error" error={errors.title} />
      </div>
      <div>
        <label htmlFor="lf-category" className="font-medium text-ink">
          Category
        </label>
        <select
          id="lf-category"
          name="category"
          defaultValue=""
          className={INPUT_CLASS}
          {...invalid("category")}
        >
          <option value="">Choose a category</option>
          {session.item_categories.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
        <FieldError id="lf-category-error" error={errors.category} />
      </div>
      <div>
        <label htmlFor="lf-description" className="font-medium text-ink">
          Description
        </label>
        <textarea
          id="lf-description"
          name="description"
          rows={4}
          maxLength={2000}
          className={INPUT_CLASS}
          {...invalid("description")}
        />
        <FieldError id="lf-description-error" error={errors.description} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="lf-zip" className="font-medium text-ink">
            ZIP code
          </label>
          <input
            id="lf-zip"
            name="zip"
            inputMode="numeric"
            defaultValue={session.user.zip ?? ""}
            className={INPUT_CLASS}
            {...invalid("zip")}
          />
          <FieldError id="lf-zip-error" error={errors.zip} />
        </div>
        <div>
          <label htmlFor="lf-seen" className="font-medium text-ink">
            Date (optional)
          </label>
          <input id="lf-seen" name="seen_on" type="date" className={INPUT_CLASS} />
        </div>
      </div>
      <div>
        <label htmlFor="lf-place" className="font-medium text-ink">
          Where (optional)
        </label>
        <input
          id="lf-place"
          name="place"
          maxLength={160}
          placeholder="near Dolores Park"
          className={INPUT_CLASS}
        />
      </div>
      <LocationButton spot={spot} onSpot={setSpot} />
      <div>
        <label htmlFor="lf-radius" className="font-medium text-ink">
          How sure are you of the spot?
        </label>
        <select id="lf-radius" name="radius_m" defaultValue="300" className={INPUT_CLASS}>
          <option value="100">Very sure (100 m)</option>
          <option value="300">Roughly (300 m)</option>
          <option value="1000">Somewhere around here (1 km)</option>
        </select>
      </div>
      <div>
        <label htmlFor="lf-image" className="font-medium text-ink">
          Photo (optional)
        </label>
        <input id="lf-image" name="image" type="file" accept="image/*" className={INPUT_CLASS} />
      </div>
      <button type="submit" disabled={sending} className="af-button-primary">
        {sending ? "Posting…" : "Post and alert neighbors"}
      </button>
      {failure ? (
        <p role="alert" className="font-medium text-warning">
          {failure}
        </p>
      ) : null}
    </form>
  );
}
