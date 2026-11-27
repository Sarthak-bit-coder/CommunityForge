"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useEffectEvent, useRef, useState, type ReactNode, type RefObject } from "react";
import type { BadgeTone } from "@/components/ui/Badge";
import { verificationDisplay, barrierSummary, type Barrier, type LngLat } from "@/lib/barriers";
import { FREMONT_CENTER, FREMONT_ZOOM, MAX_FIT_ZOOM, basemap } from "@/lib/basemap";
import { fetchStreets, lockBounds, streetBounds } from "@/lib/network-api";

import { MapLocationSelection } from "./MapLocationSelection";
import { MapKey } from "./MapKey";
import { FLYOVER_MAX_PITCH, addCityscape, flyoverStartView, playFlyover } from "./map-flyover";
import { addInteractionLayers, showBarrierReach } from "./map-interactions";
import {
  addDestinationLayers,
  emptyCounts,
  metersBetween,
  refreshDestinations,
  setHiddenPlaceTypes,
  trackDestinationHover,
  type DestinationCounts,
  type DestinationHover,
} from "./map-destinations";
import { DESTINATION_TYPES, type DestinationTypeId } from "./place-types";

type MapStatus = "loading" | "ready" | "error";

type BarrierMapProps = {
  readonly barriers: readonly Barrier[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onLocationSelect?: (location: LngLat) => void;
  readonly location?: LngLat | null;
  /** Height of the map itself; the key sits below it and never takes the map's room. */
  readonly className?: string;
  /** Overlays drawn on the map, such as the legend. */
  readonly children?: ReactNode;
  /** Opens with a 3D camera flyover of Fremont instead of framing the markers. */
  readonly isFlyover?: boolean;
  /** Leaves the mouse wheel to the page, for maps inside a scroll-driven story. */
  readonly isWheelZoomOff?: boolean;
};

const MAP_TITLE = "Accessibility barrier map";
const BASEMAP = basemap(process.env.NEXT_PUBLIC_MAPTILER_KEY);
// Extra room at the bottom keeps markers clear of the legend and attribution.
const FIT_PADDING = { top: 64, right: 64, bottom: 112, left: 64 };

// Fill colour follows the status tone; the symbol inside still carries the meaning (WCAG 1.4.1).
const MARKER_TONE_CLASSES: Record<BadgeTone, string> = {
  success: "border-surface bg-success text-surface",
  warning: "border-surface bg-warning text-surface",
  info: "border-surface bg-accent text-surface",
  neutral: "border-ink bg-surface text-ink",
  modeled: "border-surface bg-modeled text-surface",
};
const MARKER_BASE_CLASS =
  "af-drop flex cursor-pointer items-center justify-center rounded-full border-[3px] text-base font-bold shadow-lift outline-offset-4 transition-[width,height] duration-200";
// Size, not `scale`: the scale property would also scale MapLibre's positioning transform
// and push the pin off its location.
const MARKER_SIZE_CLASS = "size-10";
const MARKER_SELECTED_CLASS = "af-pulse z-10 size-12 ring-4 ring-ink";
// Selecting a barrier zooms in to street level, but never zooms out a closer view.
const SELECT_ZOOM = 16;
// Browsing maps open tilted so the 3D buildings read as buildings.
const BROWSE_TILT = { pitch: 50, bearing: -20 } as const;
// Pins drop in one after another; the cap keeps a long list from making anyone wait.
const DROP_STAGGER_MS = 60;
const DROP_MAX_PINS = 12;
const MAX_PIXEL_RATIO = 2;
const TILE_CACHE_ZOOM_LEVELS = 8;

function styleMarker(element: HTMLElement, barrier: Barrier, isSelected: boolean): void {
  const tone = MARKER_TONE_CLASSES[verificationDisplay(barrier.state).tone];
  // MapLibre's own classes position the marker on the map; dropping them leaves it in page flow.
  const maplibre = [...element.classList].filter((name) => name.startsWith("maplibregl-"));
  element.className = [
    ...maplibre,
    MARKER_BASE_CLASS,
    tone,
    isSelected ? MARKER_SELECTED_CLASS : MARKER_SIZE_CLASS,
  ]
    .join(" ")
    .trim();
  element.setAttribute("aria-pressed", String(isSelected));
}

function createMarkerElement(barrier: Barrier, index: number): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.style.animationDelay = `${Math.min(index, DROP_MAX_PINS) * DROP_STAGGER_MS}ms`;
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

function pointBounds(points: readonly LngLat[]): [[number, number], [number, number]] {
  const longitudes = points.map((point) => point.lng);
  const latitudes = points.map((point) => point.lat);
  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ];
}

type LoadedMap = { readonly map: MapLibreMap; readonly MarkerClass: typeof Marker };

function useMapInstance(
  containerRef: RefObject<HTMLDivElement | null>,
  isFlyover: boolean,
  isTilted: boolean,
  isWheelZoomOff: boolean,
) {
  const [loaded, setLoaded] = useState<LoadedMap | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [hasTileError, setHasTileError] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    let instance: MapLibreMap | null = null;
    const reduceMotion = prefersReducedMotion();

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
      // A flyover opens where its camera starts, so no tiles load for a view it leaves at once.
      const view = isFlyover
        ? { ...flyoverStartView(reduceMotion), maxPitch: FLYOVER_MAX_PITCH }
        : {
            center: [FREMONT_CENTER.lng, FREMONT_CENTER.lat] as [number, number],
            zoom: FREMONT_ZOOM,
            ...(isTilted ? BROWSE_TILT : {}),
          };
      const map = new maplibre.Map({
        container,
        style: BASEMAP.styleUrl,
        ...view,
        locale: { "Map.Title": MAP_TITLE },
        // Expanded attribution is plain inline text, so it needs no small toggle button.
        attributionControl: { compact: false },
        // 3x phone screens triple the pixels to shade for no visible gain over 2x.
        pixelRatio: Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO),
        // Hold more tiles so panning back does not re-parse buildings.
        maxTileCacheZoomLevels: TILE_CACHE_ZOOM_LEVELS,
        scrollZoom: !isWheelZoomOff,
      });
      instance = map;
      map.addControl(new maplibre.NavigationControl({ visualizePitch: false }), "top-left");
      map.on("error", (event) => {
        // Before load the style itself failed; afterwards only some tiles did.
        if (!map.loaded()) fail(event.error);
        else if (!isCancelled) setHasTileError(true);
      });
      map.once("style.load", () => {
        addCityscape(map);
        addInteractionLayers(map);
        addDestinationLayers(map);
      });
      map.once("load", () => {
        if (isCancelled) return;
        if (isFlyover) playFlyover(map, reduceMotion);
        setLoaded({ map, MarkerClass: maplibre.Marker });
        setStatus("ready");
      });
    }

    if (containerRef.current) initialise(containerRef.current).catch(fail);
    return () => {
      isCancelled = true;
      instance?.remove();
    };
  }, [containerRef, isFlyover, isTilted, isWheelZoomOff]);

  return { loaded, status, hasTileError };
}

export function BarrierMap({
  barriers,
  selectedId,
  onSelect,
  onLocationSelect,
  location = null,
  className = "h-80 sm:h-[28rem]",
  children,
  isFlyover = false,
  isWheelZoomOff = false,
}: BarrierMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<ReadonlyMap<string, Marker>>(new Map());
  // The location picker stays top-down, so a tap lands where it looks like it lands.
  const { loaded, status, hasTileError } = useMapInstance(
    containerRef,
    isFlyover,
    onLocationSelect === undefined,
    isWheelZoomOff,
  );
  // The flyover owns the camera, so nothing else reframes or locks the view.
  const ownsCamera = useEffectEvent(() => isFlyover);
  const selectBarrier = useEffectEvent((id: string) => onSelect(id));
  // Markers already frame the view; otherwise frame the loaded streets.
  const hasMarkers = useEffectEvent(() => barriers.length > 0);
  // Everything shown must stay reachable inside the lock: markers and the picked location.
  const markerBounds = useEffectEvent(() => {
    const points = [
      ...barriers.map((barrier) => barrier.location),
      ...(location ? [location] : []),
    ];
    return points.length ? pointBounds(points) : null;
  });

  useEffect(() => {
    if (!loaded) return;
    const controller = new AbortController();
    // The pilot network is not drawn; its extent frames the map and bounds panning.
    fetchStreets(controller.signal).then((network) => {
      if (!network || !network.lines.length || controller.signal.aborted) return;
      const streets = streetBounds(network);
      // Every map, picker included, keeps panning on the pilot area.
      const lock = () => loaded.map.setMaxBounds(lockBounds(streets, markerBounds()));
      if (ownsCamera()) {
        // Clamping mid-flight would cut the opening camera move short; lock once it lands.
        if (loaded.map.isMoving()) loaded.map.once("moveend", lock);
        else lock();
        return;
      }
      lock();
      if (!hasMarkers()) loaded.map.fitBounds(streets, { animate: false });
    });
    return () => controller.abort();
  }, [loaded]);

  // Markers are real buttons in DOM order: reachable with Tab, operable with Enter or Space.
  useEffect(() => {
    if (!loaded) return;
    const markers = new Map(
      barriers.map((barrier, index) => {
        const element = createMarkerElement(barrier, index);
        element.addEventListener("click", () => selectBarrier(barrier.id));
        const marker = new loaded.MarkerClass({ element })
          .setLngLat([barrier.location.lng, barrier.location.lat])
          .addTo(loaded.map);
        return [barrier.id, marker] as const;
      }),
    );
    if (barriers.length && !ownsCamera()) {
      loaded.map.fitBounds(pointBounds(barriers.map((barrier) => barrier.location)), {
        padding: FIT_PADDING,
        maxZoom: MAX_FIT_ZOOM,
        animate: false,
      });
    }
    markersRef.current = markers;
    return () => markers.forEach((marker) => marker.remove());
  }, [loaded, barriers]);

  useEffect(() => {
    const byId = new Map(barriers.map((barrier) => [barrier.id, barrier]));
    markersRef.current.forEach((marker, id) => {
      const barrier = byId.get(id);
      if (barrier) styleMarker(marker.getElement(), barrier, id === selectedId);
    });
  }, [loaded, barriers, selectedId]);

  useEffect(() => {
    const selected = selectedId ? markersRef.current.get(selectedId) : undefined;
    if (!loaded || !selected) return;
    loaded.map.easeTo({
      center: selected.getLngLat(),
      zoom: Math.max(loaded.map.getZoom(), SELECT_ZOOM),
      animate: !prefersReducedMotion(),
    });
  }, [loaded, selectedId]);

  // Selecting a barrier lights up the footpaths around it; clearing the selection clears them.
  const showsReach = !isFlyover && onLocationSelect === undefined;
  const reachCenter = barriers.find((barrier) => barrier.id === selectedId)?.location;
  const reachLng = showsReach ? reachCenter?.lng : undefined;
  const reachLat = showsReach ? reachCenter?.lat : undefined;
  useEffect(() => {
    if (!loaded) return;
    const center =
      reachLng === undefined || reachLat === undefined ? null : { lng: reachLng, lat: reachLat };
    return showBarrierReach(loaded.map, center, prefersReducedMotion());
  }, [loaded, reachLng, reachLat]);

  // Places people travel to are coloured by type and counted for the key whenever the map settles.
  const [places, setPlaces] = useState<DestinationCounts>(emptyCounts);
  useEffect(() => {
    if (!loaded) return;
    const refresh = () => setPlaces(refreshDestinations(loaded.map));
    loaded.map.on("idle", refresh);
    return () => {
      loaded.map.off("idle", refresh);
    };
  }, [loaded]);

  // The key's buttons switch each place type on and off the map.
  const [hiddenTypes, setHiddenTypes] = useState<readonly DestinationTypeId[]>([]);
  useEffect(() => {
    if (loaded) setHiddenPlaceTypes(loaded.map, hiddenTypes);
  }, [loaded, hiddenTypes]);
  const toggleType = (id: DestinationTypeId) =>
    setHiddenTypes((hidden) =>
      hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id],
    );
  const showOnlyType = (id: DestinationTypeId) =>
    setHiddenTypes(DESTINATION_TYPES.map((type) => type.id).filter((item) => item !== id));

  // Pointing at a place names it and says how far the nearest reported barrier is.
  const [hover, setHover] = useState<DestinationHover | null>(null);
  useEffect(() => (loaded ? trackDestinationHover(loaded.map, setHover) : undefined), [loaded]);
  const nearestBarrierM = hover
    ? Math.min(...barriers.map((barrier) => metersBetween(hover, barrier.location)))
    : Infinity;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* A size container, so overlays can rearrange when the map itself is narrow. On a wide
          map a legend sits in the bottom-left corner, and attribution keeps to the space beside it. */}
      <div
        className={`@container relative overflow-hidden rounded-2xl border border-line bg-canvas shadow-card @xl:has-[.af-map-legend]:[&_.maplibregl-ctrl-bottom-right]:max-w-[calc(100%-15rem)] ${className}`}
      >
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
        {status === "ready" ? (
          children
        ) : (
          <MapOverlay status={status} canEnterCoordinates={!!onLocationSelect} />
        )}
        {hover ? <PlaceTag hover={hover} nearestBarrierM={nearestBarrierM} /> : null}
        {hasTileError ? (
          <p className="absolute top-16 right-3 left-16 max-w-[16rem] rounded-lg @xl:top-3 xl:right-[23.5rem] border border-warning bg-warning-soft px-3 py-2 text-sm text-warning shadow-card">
            Some map tiles failed to load. Markers and the list still work.
          </p>
        ) : null}
      </div>
      <MapKey
        showsReach={showsReach}
        provider={BASEMAP.provider}
        places={places}
        hiddenTypes={hiddenTypes}
        onToggleType={toggleType}
        onShowOnlyType={showOnlyType}
        onShowAllTypes={() => setHiddenTypes([])}
      />
    </div>
  );
}

// Pointer-only extra detail: the key names every colour, and nothing here is needed to use the map.
// The tag sits up and to the right of the pointer, flipping sides near an edge so it is never cut.
const TAG_GAP_PX = 14;
function PlaceTag({
  hover,
  nearestBarrierM,
}: {
  readonly hover: DestinationHover;
  readonly nearestBarrierM: number;
}) {
  const shiftX = hover.isNearRight ? `calc(-100% - ${TAG_GAP_PX}px)` : `${TAG_GAP_PX}px`;
  const shiftY = hover.isNearTop ? `${TAG_GAP_PX}px` : `calc(-100% - ${TAG_GAP_PX}px)`;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute z-10 flex max-w-[16rem] flex-col rounded-lg bg-ink px-3 py-2 text-xs text-surface shadow-card"
      style={{ left: hover.x, top: hover.y, transform: `translate(${shiftX}, ${shiftY})` }}
    >
      <span className="truncate text-sm font-semibold">{hover.name}</span>
      <span className="text-surface/75">
        {hover.typeLabel}
        {hover.otherCount > 0
          ? `, plus ${hover.otherCount} more ${hover.otherCount === 1 ? "place" : "places"} here`
          : null}
      </span>
      {Number.isFinite(nearestBarrierM) ? (
        <span className="mt-1 text-marker">
          Nearest reported barrier: {Math.round(nearestBarrierM)} m
        </span>
      ) : null}
    </span>
  );
}

function MapOverlay({
  status,
  canEnterCoordinates,
}: {
  readonly status: "loading" | "error";
  readonly canEnterCoordinates: boolean;
}) {
  if (status === "loading") {
    return (
      <div
        role="status"
        className="absolute inset-0 flex items-center justify-center bg-canvas text-muted"
      >
        <span className="rounded-full bg-surface px-4 py-2 text-sm font-semibold shadow-card">
          Loading map…
        </span>
      </div>
    );
  }
  return (
    <div
      role="alert"
      className="absolute inset-0 flex items-center justify-center bg-surface p-6 text-center text-ink"
    >
      {canEnterCoordinates
        ? "The map could not be loaded. Enter coordinates using the fields instead."
        : "The map could not be loaded. Every barrier is still available in the list."}
    </div>
  );
}
