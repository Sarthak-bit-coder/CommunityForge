import type {
  ExpressionSpecification,
  LightSpecification,
  Map as MapLibreMap,
  SkySpecification,
} from "maplibre-gl";
import { FREMONT_CENTER } from "@/lib/basemap";

// The home page's opening shot: from a high overview down to a tilted street-level view of
// Fremont at dawn, with buildings rising out of the haze. Everything here finishes within 5 s
// and any drag or zoom interrupts the camera (WCAG 2.2.2).
const CENTER: [number, number] = [FREMONT_CENTER.lng, FREMONT_CENTER.lat];
const START_VIEW = { center: CENTER, zoom: 11.5, pitch: 0, bearing: 0 } as const;
const END_VIEW = { center: CENTER, zoom: 15.6, pitch: 70, bearing: -28 } as const;
/** Past MapLibre's default 60° cap, so the horizon and its haze come into view. */
export const FLYOVER_MAX_PITCH = 72;
const CAMERA_MS = 4500;

export const BUILDINGS_LAYER = "af-buildings-3d";
export const BUILDING_SOURCE_LAYER = "building";
const BUILDINGS_MIN_ZOOM = 13;
// Buildings grow with the camera's descent: flat at the first zoom, full height by the second.
// Heights keyed on zoom are interpolated on the GPU. Animating them from JavaScript instead
// forces MapLibre to re-parse every basemap tile on every frame, which stalled loading.
const RISE_FROM_ZOOM = 13.6;
const RISE_TO_ZOOM = 15.2;
const BUILDING_OPACITY = 0.92;
/**
 * Vertical exaggeration. Fremont is mostly one and two storeys, which read as flat slabs from a
 * tilted camera; drawing them taller than mapped makes the 3D city legible. The map key says so.
 */
export const HEIGHT_SCALE = 1.7;

// Dawn survey palette. MapLibre paint cannot read CSS variables, so these mirror the theme:
// pale slate for low buildings, brand teal (--color-accent) for tall ones, so the yellow
// barrier markers (--color-marker) stay the warmest thing on the map.
// Fremont is mostly one and two storeys. Buildings stay soft so the walking network and the
// barrier markers carry the map; only the few towers reach deep teal.
export const BUILDING_RAMP = [
  [0, "#e3eaee"],
  [6, "#c4d9d6"],
  [14, "#8db8b2"],
  [30, "#3f8f86"],
] as const;

// OpenStreetMap footpaths glow in brand teal; stairs, which block wheelchairs, are dashed in
// the warning tone (--color-warning). Shape differs as well as colour (WCAG 1.4.1).
const WALKWAY_LAYER = "af-walkways";
const WALKWAY_GLOW_LAYER = "af-walkways-glow";
const STEPS_LAYER = "af-steps";
export const TRANSPORT_SOURCE_LAYER = "transportation";
const WALKWAY_COLOR = "#0a6b62";
const STEPS_COLOR = "#8a4a00";
const NETWORK_MIN_ZOOM = 13;
export const WALKWAY_SUBCLASSES = ["footway", "pedestrian", "path"] as const;
export const isPath = (subclasses: readonly string[]): ExpressionSpecification => [
  "all",
  ["==", ["get", "class"], "path"],
  ["in", ["get", "subclass"], ["literal", subclasses]],
];
const widthByZoom = (atLow: number, atHigh: number): ExpressionSpecification => [
  "interpolate",
  ["linear"],
  ["zoom"],
  NETWORK_MIN_ZOOM,
  atLow,
  17,
  atHigh,
];
// The horizon fades into the page canvas (--color-canvas), so the city sits in the panel.
const SKY: SkySpecification = {
  "sky-color": "#c9dbe8",
  "horizon-color": "#f6efe4",
  "fog-color": "#f2f4f7",
  "sky-horizon-blend": 0.6,
  "horizon-fog-blend": 0.7,
  "fog-ground-blend": 0.35,
};
// Low, warm morning sun from the south-east, so facades shade by direction.
const SUN: LightSpecification = {
  anchor: "map",
  color: "#fff4e0",
  // Soft enough that walls keep their colour: coloured places read the same on every side.
  intensity: 0.3,
  position: [1.3, 135, 40],
};

/** A height that rises with the camera like the buildings do, so overlays stay in step. */
export const risingHeight = (height: ExpressionSpecification): ExpressionSpecification => [
  "interpolate",
  ["linear"],
  ["zoom"],
  RISE_FROM_ZOOM,
  0,
  RISE_TO_ZOOM,
  ["*", height, HEIGHT_SCALE],
];
const heightProperty = (property: string): ExpressionSpecification =>
  risingHeight(["coalesce", ["get", property], 0]);

const buildingColor: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["coalesce", ["get", "render_height"], 0],
  ...BUILDING_RAMP.flat(),
];

// Basemaps name their vector source differently; use whichever source draws the buildings.
export function buildingSource(map: MapLibreMap): string | null {
  for (const layer of map.getStyle()?.layers ?? []) {
    if ("source-layer" in layer && layer["source-layer"] === BUILDING_SOURCE_LAYER) {
      return typeof layer.source === "string" ? layer.source : null;
    }
  }
  return null;
}

// Basemap labels are symbol layers; buildings go beneath the first one so they never hide text.
export function firstLabelLayer(map: MapLibreMap): string | undefined {
  return map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id;
}

/** Draws footpaths and stairs on the ground, beneath the buildings. */
function addWalkingNetwork(map: MapLibreMap, source: string): void {
  const common = {
    source,
    "source-layer": TRANSPORT_SOURCE_LAYER,
    minzoom: NETWORK_MIN_ZOOM,
    layout: { "line-cap": "round", "line-join": "round" },
  } as const;
  const walkways = isPath(WALKWAY_SUBCLASSES);
  map.addLayer(
    {
      ...common,
      id: WALKWAY_GLOW_LAYER,
      type: "line",
      filter: walkways,
      paint: {
        "line-color": WALKWAY_COLOR,
        "line-width": widthByZoom(2, 9),
        "line-blur": widthByZoom(2, 6),
        "line-opacity": 0.22,
      },
    },
    BUILDINGS_LAYER,
  );
  map.addLayer(
    {
      ...common,
      id: WALKWAY_LAYER,
      type: "line",
      filter: walkways,
      paint: { "line-color": WALKWAY_COLOR, "line-width": widthByZoom(0.6, 2.6) },
    },
    BUILDINGS_LAYER,
  );
  map.addLayer(
    {
      ...common,
      id: STEPS_LAYER,
      type: "line",
      filter: isPath(["steps"]),
      layout: { "line-join": "round" },
      paint: {
        "line-color": STEPS_COLOR,
        "line-width": widthByZoom(1.5, 4),
        "line-dasharray": [1, 0.8],
      },
    },
    BUILDINGS_LAYER,
  );
}

/** Adds extruded buildings and the walking network if the basemap has them. */
function addBuildings(map: MapLibreMap): void {
  const source = buildingSource(map);
  if (!source) return;
  map.addLayer(
    {
      id: BUILDINGS_LAYER,
      type: "fill-extrusion",
      source,
      "source-layer": BUILDING_SOURCE_LAYER,
      minzoom: BUILDINGS_MIN_ZOOM,
      paint: {
        "fill-extrusion-color": buildingColor,
        "fill-extrusion-height": heightProperty("render_height"),
        "fill-extrusion-base": heightProperty("render_min_height"),
        "fill-extrusion-opacity": BUILDING_OPACITY,
      },
    },
    firstLabelLayer(map),
  );
  addWalkingNetwork(map, source);
}

/** Where the map opens: the overview, or the final 3D view under reduced motion. */
export function flyoverStartView(reduceMotion: boolean): typeof START_VIEW | typeof END_VIEW {
  return reduceMotion ? END_VIEW : START_VIEW;
}

/**
 * Adds the sky, sunlight, and 3D buildings. Call on "style.load", before tiles are requested,
 * so the building layer is parsed with the first tiles instead of reloading them afterwards.
 */
export function addCityscape(map: MapLibreMap): void {
  map.setSky(SKY);
  map.setLight(SUN);
  addBuildings(map);
}

/** Plays the opening camera move once. Under reduced motion the map already opened there. */
export function playFlyover(map: MapLibreMap, reduceMotion: boolean): void {
  if (!reduceMotion) map.flyTo({ ...END_VIEW, duration: CAMERA_MS });
}
