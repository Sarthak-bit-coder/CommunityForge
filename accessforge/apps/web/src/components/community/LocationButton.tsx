"use client";

import { useState } from "react";

export type Spot = { readonly lat: number; readonly lng: number };

/** Fills in the device's location. The spot is only sent when the form is submitted. */
export function LocationButton({
  spot,
  onSpot,
}: {
  readonly spot: Spot | null;
  readonly onSpot: (spot: Spot | null) => void;
}) {
  const [message, setMessage] = useState("");

  function locate() {
    if (!navigator.geolocation) {
      setMessage("This browser can't share its location. The post will be placed by ZIP code.");
      return;
    }
    setMessage("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        onSpot({ lat: coords.latitude, lng: coords.longitude });
        setMessage("");
      },
      () => setMessage("Couldn't get your location. The post will be placed by ZIP code."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div>
      <p className="font-medium text-ink">Exact spot (optional)</p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <button type="button" onClick={locate} className="af-button-secondary">
          Use my location
        </button>
        {spot ? (
          <>
            <span className="text-muted tabular-nums">
              {spot.lat.toFixed(5)}, {spot.lng.toFixed(5)}
            </span>
            <button type="button" onClick={() => onSpot(null)} className="af-link min-h-11">
              Clear
            </button>
          </>
        ) : null}
      </div>
      <p role="status" className="mt-1 text-sm text-muted">
        {message}
      </p>
    </div>
  );
}
