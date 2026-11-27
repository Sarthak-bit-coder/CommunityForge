import type { Feature, FeatureCollection, Geometry, Polygon, Position } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import {
  BUILDINGS_LAYER,
  TRANSPORT_SOURCE_LAYER,
  WALKWAY_SUBCLASSES,
  buildingSource,
  isPath,
} from "./map-flyover";

// Selecting a barrier sends a ring across the ground and lights the footpaths it reaches.

/** How far from a barrier the map highlights footpaths: a few minutes' roll. */
export const REACH_M = 200;
const REACH_AREA_SOURCE = "af-reach-area";
const REACH_RING_SOURCE = "af-reach-ring";
const REACH_AREA_LAYER = "af-reach-area";
const REACH_RING_LAYER = "af-reach-ring";
const REACH_WALKWAY_LAYER = "af-reach-walkways";
const REACH_WALKWAY_SOURCE = "af-reach-walkways";
// Marker yellow (--color-marker) ties the ring and paths to the selected barrier pin.
const REACH_COLOR = "#f2c230";
const REACH_EDGE_COLOR = "#8a4a00";
const PULSE_MS = 1400;
const PULSES = 2;
const RING_VERTICES = 72;
const METERS_PER_DEGREE_LAT = 111_320;

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

/** Adds the empty reach layers. Call on "style.load", after the cityscape. */
export function addInteractionLayers(map: MapLibreMap): void {
  const source = buildingSource(map);
  if (!source || !map.getLayer(BUILDINGS_LAYER)) return;
  // Real ground polygons, measured in metres, so the ring sits true on a tilted map.
  map.addSource(REACH_AREA_SOURCE, { type: "geojson", data: EMPTY });
  map.addSource(REACH_RING_SOURCE, { type: "geojson", data: EMPTY });
  map.addLayer(
    {
      id: REACH_AREA_LAYER,
      type: "fill",
      source: REACH_AREA_SOURCE,
      paint: { "fill-color": REACH_COLOR, "fill-opacity": 0.14 },
    },
    BUILDINGS_LAYER,
  );
  map.addLayer(
    {
      id: REACH_RING_LAYER,
      type: "line",
      source: REACH_RING_SOURCE,
      paint: { "line-color": REACH_EDGE_COLOR, "line-width": 2.5 },
    },
    BUILDINGS_LAYER,
  );
  // Nearby footpaths are copied into their own small source. Filtering the basemap layer
  // instead would make MapLibre re-parse every tile on each selection.
  map.addSource(REACH_WALKWAY_SOURCE, { type: "geojson", data: EMPTY });
  map.addLayer(
    {
      id: REACH_WALKWAY_LAYER,
      type: "line",
      source: REACH_WALKWAY_SOURCE,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": REACH_COLOR, "line-width": 4 },
    },
    BUILDINGS_LAYER,
  );
}

type Center = { readonly lng: number; readonly lat: number };

// A circle of `meters` around `center` as a ground polygon. Accurate to well under a metre at
// this size, which is all a 200 m highlight needs.
function groundCircle(center: Center, meters: number): Feature<Polygon> {
  const latStep = meters / METERS_PER_DEGREE_LAT;
  const lngStep = latStep / Math.cos((center.lat * Math.PI) / 180);
  const ring = Array.from({ length: RING_VERTICES + 1 }, (_, index) => {
    const angle = (index / RING_VERTICES) * 2 * Math.PI;
    return [center.lng + lngStep * Math.cos(angle), center.lat + latStep * Math.sin(angle)];
  });
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: {} };
}

// Distance in metres from a point to a segment, on a local flat projection around `center`.
function segmentDistance(center: Center, a: Position, b: Position): number {
  const metersPerLng = METERS_PER_DEGREE_LAT * Math.cos((center.lat * Math.PI) / 180);
  const toLocal = ([lng = 0, lat = 0]: Position) => [
    (lng - center.lng) * metersPerLng,
    (lat - center.lat) * METERS_PER_DEGREE_LAT,
  ];
  const [ax = 0, ay = 0] = toLocal(a);
  const [bx = 0, by = 0] = toLocal(b);
  const length = (bx - ax) ** 2 + (by - ay) ** 2;
  const t =
    length === 0 ? 0 : Math.min(Math.max(-(ax * (bx - ax) + ay * (by - ay)) / length, 0), 1);
  return Math.hypot(ax + t * (bx - ax), ay + t * (by - ay));
}

export function comesWithin(geometry: Geometry, center: Center, meters: number): boolean {
  const lines =
    geometry.type === "LineString"
      ? [geometry.coordinates]
      : geometry.type === "MultiLineString"
        ? geometry.coordinates
        : [];
  return lines.some((line) =>
    line.some((point, index) => {
      const next = line[index + 1];
      return next !== undefined && segmentDistance(center, point, next) <= meters;
    }),
  );
}

// Copies the loaded footpaths that come within REACH_M of `center` into the highlight source.
function nearbyWalkways(map: MapLibreMap, center: Center): FeatureCollection {
  const source = buildingSource(map);
  if (!source) return EMPTY;
  const features = map
    .querySourceFeatures(source, {
      sourceLayer: TRANSPORT_SOURCE_LAYER,
      filter: isPath(WALKWAY_SUBCLASSES),
    })
    .map((feature) => feature.toJSON())
    .filter((feature) => comesWithin(feature.geometry, center, REACH_M))
    .map((feature): Feature => ({ type: "Feature", geometry: feature.geometry, properties: {} }));
  return { type: "FeatureCollection", features: structuredClone(features) };
}

/**
 * Shows the footpaths within REACH_M of a selected barrier. A ring pulses outward twice, then
 * rests at the edge. Pass null to clear. Returns a cleanup for the animation.
 */
export function showBarrierReach(
  map: MapLibreMap,
  center: Center | null,
  reduceMotion: boolean,
): () => void {
  const area = map.getSource<GeoJSONSource>(REACH_AREA_SOURCE);
  const ring = map.getSource<GeoJSONSource>(REACH_RING_SOURCE);
  const walkways = map.getSource<GeoJSONSource>(REACH_WALKWAY_SOURCE);
  if (!area || !ring || !walkways) return () => {};
  if (!center) {
    [area, ring, walkways].forEach((source) => source.setData(EMPTY));
    return () => {};
  }
  // Tiles for the zoomed-in view arrive after the camera settles; collect paths again then.
  const collect = () => walkways.setData(nearbyWalkways(map, center));
  collect();
  map.once("idle", collect);
  area.setData(groundCircle(center, REACH_M));
  const setRing = (share: number) => ring.setData(groundCircle(center, REACH_M * share));
  if (reduceMotion) {
    setRing(1);
    return () => map.off("idle", collect);
  }
  let frame = 0;
  const start = performance.now();
  const step = (now: number) => {
    if (!map.getLayer(REACH_RING_LAYER)) return;
    // A frame can be stamped slightly before `start`; clamp so the ring never runs backwards.
    const elapsed = Math.max(now - start, 0) / PULSE_MS;
    const isDone = elapsed >= PULSES;
    // Ease out: the ring leaves the barrier quickly and slows as it reaches the edge.
    setRing(isDone ? 1 : 1 - (1 - (elapsed % 1)) ** 3);
    if (!isDone) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => {
    cancelAnimationFrame(frame);
    map.off("idle", collect);
  };
}
