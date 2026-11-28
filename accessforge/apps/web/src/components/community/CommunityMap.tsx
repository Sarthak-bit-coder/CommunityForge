"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { basemap, FREMONT_CENTER, FREMONT_ZOOM, MAX_FIT_ZOOM } from "@/lib/basemap";

export type MapPin = {
  readonly id: string;
  readonly lat: number;
  readonly lng: number;
  /** Accessible name of the marker. */
  readonly label: string;
  /** Where the marker leads: a list anchor or a detail page. */
  readonly href: string;
  readonly tone: "incident" | "lost" | "found" | "resolved";
};

const BASEMAP = basemap(process.env.NEXT_PUBLIC_MAPTILER_KEY);
const TONE_CLASSES: Record<MapPin["tone"], string> = {
  incident: "bg-warning",
  lost: "bg-accent",
  found: "bg-success",
  resolved: "bg-muted",
};

// Markers are links in DOM order, so the map works with Tab and Enter. The list beside it carries
// the same items, so the map is never the only way to reach them.
export function CommunityMap({ pins }: { readonly pins: readonly MapPin[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let removed = false;
    let cleanup = () => {};
    async function start() {
      try {
        const maplibre = await import("maplibre-gl");
        if (removed || !container.current) return;
        maplibre.setWorkerUrl(
          new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href,
        );
        const map = new maplibre.Map({
          container: container.current,
          style: BASEMAP.styleUrl,
          center: [FREMONT_CENTER.lng, FREMONT_CENTER.lat],
          zoom: FREMONT_ZOOM,
        });
        map.addControl(new maplibre.NavigationControl({ visualizePitch: false }), "top-left");
        const markers = pins.map((pin) => {
          const element = document.createElement("a");
          element.href = pin.href;
          element.setAttribute("aria-label", pin.label);
          element.className = `block size-4 rounded-full border-2 border-surface shadow-card ${TONE_CLASSES[pin.tone]}`;
          return new maplibre.Marker({ element }).setLngLat([pin.lng, pin.lat]).addTo(map);
        });
        if (pins.length) {
          const lngs = pins.map((pin) => pin.lng);
          const lats = pins.map((pin) => pin.lat);
          map.fitBounds(
            [
              [Math.min(...lngs), Math.min(...lats)],
              [Math.max(...lngs), Math.max(...lats)],
            ],
            { padding: 48, maxZoom: MAX_FIT_ZOOM, animate: false },
          );
        }
        cleanup = () => {
          markers.forEach((marker) => marker.remove());
          map.remove();
        };
      } catch {
        if (!removed) setFailed(true);
      }
    }
    void start();
    return () => {
      removed = true;
      cleanup();
    };
  }, [pins]);

  return failed ? (
    <p role="status" className="af-panel p-4 text-muted">
      The map could not load in this browser. Every item is still in the list.
    </p>
  ) : (
    <div
      ref={container}
      role="region"
      aria-label="Map of neighborhood posts"
      className="h-80 overflow-hidden rounded-2xl border border-line bg-canvas shadow-card sm:h-96"
    />
  );
}
