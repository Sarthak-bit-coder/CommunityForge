"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap, Marker, StyleSpecification } from "maplibre-gl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { verificationDisplay, barrierSummary, type Barrier, type LngLat } from "@/lib/barriers";
import { SAMPLE_MAP_CENTER, SAMPLE_MAP_ZOOM, sampleStreetGrid } from "@/lib/sample-barriers";

import { MapLocationSelection } from "./MapLocationSelection";

type MapStatus = "loading" | "ready" | "error";

type BarrierMapProps = {
  readonly barriers: readonly Barrier[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onLocationSelect?: (location: LngLat) => void;
  readonly location?: LngLat | null;
};

const MAP_TITLE = "Accessibility barrier map";
const STREET_COLOR = "#9aa0a6";
const BACKGROUND_COLOR = "#f6f6f3";
const STREET_WIDTH_PX = 6;

// Self-contained style: no tiles, glyphs, or sprites, so nothing is fetched from the network.
function sampleStyle(): StyleSpecification {
  return {
    version: 8,
    sources: { streets: { type: "geojson", data: sampleStreetGrid() } },
    layers: [
      { id: "background", type: "background", paint: { "background-color": BACKGROUND_COLOR } },
      {
        id: "streets",
        type: "line",
        source: "streets",
        paint: { "line-color": STREET_COLOR, "line-width": STREET_WIDTH_PX },
      },
    ],
  };
}

const MARKER_BASE_CLASS =
  "flex size-11 items-center justify-center rounded-full border-2 border-ink bg-surface text-lg font-bold text-ink shadow";
const MARKER_SELECTED_CLASS = "bg-ink text-surface ring-4 ring-accent";

function styleMarker(element: HTMLElement, isSelected: boolean): void {
  element.className = isSelected
    ? `${MARKER_BASE_CLASS} ${MARKER_SELECTED_CLASS}`
    : MARKER_BASE_CLASS;
  element.setAttribute("aria-pressed", String(isSelected));
}

function createMarkerElement(barrier: Barrier): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", barrierSummary(barrier));
  button.dataset.barrierId = barrier.id;
  const symbol = document.createElement("span");
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = verificationDisplay(barrier.state).symbol;
  button.append(symbol);
  return button;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

type LoadedMap = { readonly map: MapLibreMap; readonly MarkerClass: typeof Marker };

export function BarrierMap({
  barriers,
  selectedId,
  onSelect,
  onLocationSelect,
  location = null,
}: BarrierMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<ReadonlyMap<string, Marker>>(new Map());
  const [loaded, setLoaded] = useState<LoadedMap | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const selectBarrier = useEffectEvent((id: string) => onSelect(id));

  useEffect(() => {
    let isCancelled = false;
    let instance: MapLibreMap | null = null;

    function fail(error: unknown): void {
      console.error("Barrier map failed to load", error);
      instance?.remove();
      instance = null;
      if (!isCancelled) {
        setLoaded(null);
        setStatus("error");
      }
    }

    async function initialise(container: HTMLElement): Promise<void> {
      const maplibre = await import("maplibre-gl");
      if (isCancelled) return;
      // Bundling moves maplibre away from its worker file; point it at the copy the bundler emits.
      maplibre.setWorkerUrl(
        new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href,
      );
      const map = new maplibre.Map({
        container,
        style: sampleStyle(),
        center: [SAMPLE_MAP_CENTER.lng, SAMPLE_MAP_CENTER.lat],
        zoom: SAMPLE_MAP_ZOOM,
        locale: { "Map.Title": MAP_TITLE },
        // The style is generated here with no third-party tiles, so there is nothing to
        // attribute; the default control's 15px targets also fail WCAG 2.5.8.
        attributionControl: false,
      });
      instance = map;
      map.addControl(new maplibre.NavigationControl({ showCompass: false }));
      map.on("error", (event) => {
        if (!map.loaded()) fail(event.error);
      });
      map.once("load", () => {
        if (isCancelled) return;
        setLoaded({ map, MarkerClass: maplibre.Marker });
        setStatus("ready");
      });
    }

    if (containerRef.current) initialise(containerRef.current).catch(fail);
    return () => {
      isCancelled = true;
      instance?.remove();
    };
  }, []);

  // Markers are real buttons in DOM order: reachable with Tab, operable with Enter or Space.
  useEffect(() => {
    if (!loaded) return;
    const markers = new Map(
      barriers.map((barrier) => {
        const element = createMarkerElement(barrier);
        element.addEventListener("click", () => selectBarrier(barrier.id));
        const marker = new loaded.MarkerClass({ element })
          .setLngLat([barrier.location.lng, barrier.location.lat])
          .addTo(loaded.map);
        return [barrier.id, marker] as const;
      }),
    );
    if (barriers.length && barriers[0].dataKind === "report") {
      const longitudes = barriers.map((barrier) => barrier.location.lng);
      const latitudes = barriers.map((barrier) => barrier.location.lat);
      loaded.map.fitBounds(
        [
          [Math.min(...longitudes), Math.min(...latitudes)],
          [Math.max(...longitudes), Math.max(...latitudes)],
        ],
        { padding: 50, maxZoom: SAMPLE_MAP_ZOOM, animate: false },
      );
    }
    markersRef.current = markers;
    return () => markers.forEach((marker) => marker.remove());
  }, [loaded, barriers]);

  useEffect(() => {
    markersRef.current.forEach((marker, id) => styleMarker(marker.getElement(), id === selectedId));
  }, [loaded, barriers, selectedId]);

  useEffect(() => {
    const selected = selectedId ? markersRef.current.get(selectedId) : undefined;
    if (!loaded || !selected) return;
    loaded.map.easeTo({ center: selected.getLngLat(), animate: !prefersReducedMotion() });
  }, [loaded, selectedId]);

  return (
    <div className="relative h-80 overflow-hidden rounded-lg border border-line bg-canvas sm:h-[28rem]">
      {/* Sized by height, not inset: MapLibre forces position: relative on this element. */}
      <div ref={containerRef} className="h-full w-full" />
      {status === "ready" && loaded && onLocationSelect ? (
        <MapLocationSelection
          map={loaded.map}
          MarkerClass={loaded.MarkerClass}
          location={location}
          onSelect={onLocationSelect}
        />
      ) : null}
      {status === "ready" ? null : (
        <div
          role={status === "error" ? "alert" : "status"}
          className="absolute inset-0 flex items-center justify-center bg-surface p-6 text-center text-ink"
        >
          {status === "error"
            ? onLocationSelect
              ? "The map could not be loaded. Enter coordinates using the fields instead."
              : "The map could not be loaded. Every barrier is still available in the list below."
            : "Loading map…"}
        </div>
      )}
    </div>
  );
}
