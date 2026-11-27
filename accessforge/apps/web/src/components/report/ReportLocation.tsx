"use client";

import { useMemo } from "react";
import { BarrierMap } from "@/components/barriers/BarrierMap";
import { NearbyReports } from "./NearbyReports";
import { BARRIER_TYPES, type Barrier, type LngLat } from "@/lib/barriers";
import { parseLocation, type ReportDraft, type ReportErrors } from "@/lib/report";
import { FieldError, INPUT_CLASS } from "./ReportField";

const NO_BARRIERS: readonly Barrier[] = [];
type Props = {
  readonly draft: ReportDraft;
  readonly errors: ReportErrors;
  readonly onEdit: (field: keyof ReportDraft, value: string) => void;
  readonly onSelect: (location: LngLat) => void;
};

export function ReportLocation({ draft, errors, onEdit, onSelect }: Props) {
  const location = useMemo(
    () => parseLocation(draft.latitude, draft.longitude),
    [draft.latitude, draft.longitude],
  );
  const type = BARRIER_TYPES.find((value) => value === draft.type);
  return (
    <fieldset className="space-y-3">
      <legend className="text-lg font-semibold text-ink">Location</legend>
      <p id="location-help" className="text-muted">
        Click the map to choose a point, or focus the map, pan with arrow keys, then choose “Use map
        center”. The note under the map says whether it shows real streets. You can also enter
        coordinates without the map.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["latitude", "longitude"] as const).map((field) => (
          <div key={field}>
            <label htmlFor={`report-${field}`} className="font-medium text-ink">
              {field === "latitude" ? "Latitude" : "Longitude"}
            </label>
            <input
              id={`report-${field}`}
              type="text"
              inputMode="decimal"
              required
              value={draft[field]}
              onChange={(event) => onEdit(field, event.target.value)}
              className={INPUT_CLASS}
              aria-invalid={Boolean(errors[field])}
              aria-describedby={`location-help${errors[field] ? ` report-${field}-error` : ""}`}
            />
            <FieldError id={`report-${field}-error`} error={errors[field]} />
          </div>
        ))}
      </div>
      <BarrierMap
        barriers={NO_BARRIERS}
        selectedId={null}
        onSelect={() => {}}
        onLocationSelect={onSelect}
        location={location}
      />
      <dl aria-label="Selected location" aria-live="polite" className="text-sm text-muted">
        <div>
          <dt className="inline font-semibold">Selected coordinates: </dt>
          <dd className="inline">
            {location
              ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
              : "No valid location selected."}
          </dd>
        </div>
      </dl>
      {type && location && (
        <NearbyReports
          key={`${type}/${location.lat}/${location.lng}`}
          type={type}
          point={location}
        />
      )}
    </fieldset>
  );
}
