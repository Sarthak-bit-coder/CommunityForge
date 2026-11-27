import type { Feature, Polygon } from "geojson";
import type {
  FilterSpecification,
  GeoJSONSource,
  MapMouseEvent,
  Map as MapLibreMap,
} from "maplibre-gl";
import {
  buildingKey,
  nearestWall,
  footprintsOf,
  indexFootprints,
  offsetRing,
  structureAt,
  type Footprint,
  type FootprintIndex,
} from "./building-footprints";
import {
  BUILDINGS_LAYER,
  BUILDING_SOURCE_LAYER,
  buildingSource,
  firstLabelLayer,
  risingHeight,
} from "./map-flyover";
import {
  DESTINATION_TYPES,
  HOVER_STATE,
  PLACE_COLOR,
  type DestinationType,
  type DestinationTypeId,
} from "./place-types";

// OpenStreetMap tags destinations as points (the `poi` layer). Each is matched to the building
// it sits in (or the building just beside it), and that whole structure is redrawn in the place
// colour. Transit stops, and places with no building nearby, are drawn as small raised discs
// on the ground: being 3D, buildings in front hide them, so a disc never shows through a wall.
export type DestinationCounts = Readonly<Record<DestinationTypeId, number>>;
export type DestinationHover = {
  readonly x: number;
  readonly y: number;
  readonly name: string;
  readonly typeLabel: string;
  /** Other listed places inside the same building. */
  readonly otherCount: number;
  /** Too close to the right or top edge for the tag to fit on its usual side. */
  readonly isNearRight: boolean;
  readonly isNearTop: boolean;
  readonly lng: number;
  readonly lat: number;
};

const POI_SOURCE_LAYER = "poi";
const POI_LOADER_LAYER = "af-poi-loader";
const PLACES_SOURCE = "af-places";
const PLACE_BUILDINGS_LAYER = "af-place-buildings";
const PLACE_DOTS_LAYER = "af-place-dots";
const PLACE_DOT_RINGS_LAYER = "af-place-dot-rings";
// A destination point this close to a wall belongs to that building (OSM often puts the point
// on the entrance or the pavement outside). Transit stops never snap: they are on the street.
const SNAP_METERS = 25;
// Two stops of one type closer than this (both sides of a road) are shown as one disc.
const MERGE_METERS = 40;
const DISC = { radius: 9, ringRadius: 12, height: 1.6, ringHeight: 0.8, sides: 24 } as const;
const DISC_GAP_METERS = 2;
const CLEAR_ATTEMPTS = 3;
const TRANSIT_TYPE_ID: DestinationTypeId = "transit";
// The coloured copy sits just outside and above the building it covers, so their walls and
// roofs never share a plane and never flicker. Too small to see as a change of shape.
const OUTLINE_OFFSET_M = 1.2;
const ROOF_LIFT_M = 0.6;
const BUILDING_FILTER: FilterSpecification = ["==", ["get", "kind"], "building"];
const DOT_FILTER: FilterSpecification = ["==", ["get", "kind"], "stop"];
const DOT_RING_FILTER: FilterSpecification = ["==", ["get", "kind"], "ring"];
const METERS_PER_DEGREE_LAT = 111_320;
// Room the hover tag needs beside and above the pointer before it flips to the other side.
const TAG_ROOM = { x: 280, y: 96 } as const;

type Place = { readonly type: DestinationType; readonly name: string };
type Building = { readonly pieces: readonly Footprint[]; readonly places: readonly Place[] };

const CLASS_TO_TYPE = new Map<string, DestinationType>(
  DESTINATION_TYPES.flatMap((type) => type.classes.map((name) => [name, type] as const)),
);
const ALL_CLASSES = [...CLASS_TO_TYPE.keys()];
const TYPE_RANK = new Map<DestinationTypeId, number>(
  DESTINATION_TYPES.map((type, index) => [type.id, index]),
);

// Last data sent to each map's place source. Re-sending unchanged data would trigger another
// render, another "idle", and so another refresh, forever.
const lastData = new WeakMap<MapLibreMap, string>();

export function emptyCounts(): DestinationCounts {
  return Object.fromEntries(DESTINATION_TYPES.map((type) => [type.id, 0])) as DestinationCounts;
}

/** Adds the empty place layers. Call on "style.load", after the cityscape. */
export function addDestinationLayers(map: MapLibreMap): void {
  const source = buildingSource(map);
  if (!source || !map.getLayer(BUILDINGS_LAYER)) return;
  // MapLibre parses only the tile layers some style layer uses, and light basemaps draw no
  // places. This invisible layer makes the worker keep them so they can be queried.
  map.addLayer({
    id: POI_LOADER_LAYER,
    type: "circle",
    source,
    "source-layer": POI_SOURCE_LAYER,
    filter: ["in", ["get", "class"], ["literal", ALL_CLASSES]],
    paint: { "circle-opacity": 0, "circle-radius": 1 },
  });
  map.addSource(PLACES_SOURCE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    promoteId: "key",
  });
  // Both go beneath the basemap labels, like the buildings, so no street name is hidden.
  const beforeLabels = firstLabelLayer(map);
  map.addLayer(
    {
      id: PLACE_BUILDINGS_LAYER,
      type: "fill-extrusion",
      source: PLACES_SOURCE,
      filter: BUILDING_FILTER,
      paint: {
        "fill-extrusion-color": PLACE_COLOR,
        // Rises with the camera exactly like the building beneath it.
        "fill-extrusion-height": risingHeight(["+", ["get", "height"], ROOF_LIFT_M]),
        "fill-extrusion-base": risingHeight(["get", "base"]),
        "fill-extrusion-opacity": 1,
        // No darkening toward the ground: walls keep the place colour from roof to street.
        "fill-extrusion-vertical-gradient": false,
      },
    },
    beforeLabels,
  );
  map.addLayer(
    {
      id: PLACE_DOT_RINGS_LAYER,
      type: "fill-extrusion",
      source: PLACES_SOURCE,
      filter: DOT_RING_FILTER,
      paint: {
        "fill-extrusion-color": "#ffffff",
        "fill-extrusion-height": DISC.ringHeight,
        "fill-extrusion-opacity": 1,
      },
    },
    beforeLabels,
  );
  map.addLayer(
    {
      id: PLACE_DOTS_LAYER,
      type: "fill-extrusion",
      source: PLACES_SOURCE,
      filter: DOT_FILTER,
      paint: {
        "fill-extrusion-color": PLACE_COLOR,
        "fill-extrusion-height": DISC.height,
        "fill-extrusion-opacity": 1,
      },
    },
    beforeLabels,
  );
}

function shownOnly(filter: FilterSpecification, hidden: readonly DestinationTypeId[]) {
  return hidden.length
    ? ([
        "all",
        filter,
        ["!", ["in", ["get", "type"], ["literal", [...hidden]]]],
      ] as FilterSpecification)
    : filter;
}

/**
 * Hides the places of the given types. Their buildings go back to the plain building colour,
 * and pointing at them no longer names them; the key still counts them.
 */
export function setHiddenPlaceTypes(map: MapLibreMap, hidden: readonly DestinationTypeId[]): void {
  if (!map.getLayer(PLACE_BUILDINGS_LAYER) || !map.getLayer(PLACE_DOTS_LAYER)) return;
  map.setFilter(PLACE_BUILDINGS_LAYER, shownOnly(BUILDING_FILTER, hidden));
  map.setFilter(PLACE_DOTS_LAYER, shownOnly(DOT_FILTER, hidden));
  map.setFilter(PLACE_DOT_RINGS_LAYER, shownOnly(DOT_RING_FILTER, hidden));
}

/** Adds a place to a building's list, keeping the highest-priority type first. */
export function withPlace(places: readonly Place[], place: Place): readonly Place[] {
  return [...places, place].sort(
    (a, b) => (TYPE_RANK.get(a.type.id) ?? 0) - (TYPE_RANK.get(b.type.id) ?? 0),
  );
}

type Collected = {
  readonly counts: DestinationCounts;
  readonly buildings: ReadonlyMap<string, Building>;
  readonly dots: readonly Dot[];
};

type Dot = { readonly point: readonly [number, number]; readonly places: readonly Place[] };

function collectPlaces(map: MapLibreMap, source: string): Collected {
  // Every loaded building piece, on screen or not. Rendered-only pieces left a building cut by a
  // tile or screen edge half coloured until a later refresh. The grid keeps lookups local.
  const footprints = indexFootprints(
    footprintsOf(map.querySourceFeatures(source, { sourceLayer: BUILDING_SOURCE_LAYER })),
  );
  const seen = new Set<string>();
  const counts: Record<DestinationTypeId, number> = { ...emptyCounts() };
  const buildings = new Map<string, Building>();
  const dots: Dot[] = [];
  const owner = new Map<Footprint, string>();
  const pois = map.querySourceFeatures(source, {
    sourceLayer: POI_SOURCE_LAYER,
    filter: ["in", ["get", "class"], ["literal", ALL_CLASSES]],
  });
  for (const feature of pois) {
    const { geometry } = feature.toJSON();
    const type = CLASS_TO_TYPE.get(String(feature.properties?.class ?? ""));
    if (!type || geometry.type !== "Point") continue;
    const point: [number, number] = [geometry.coordinates[0] ?? 0, geometry.coordinates[1] ?? 0];
    const name = String(feature.properties?.name ?? "");
    // The same place repeats in every tile it touches.
    const placeKey = `${type.id}:${name}:${point[0].toFixed(5)}:${point[1].toFixed(5)}`;
    if (seen.has(placeKey)) continue;
    seen.add(placeKey);
    counts[type.id] += 1;
    const isTransit = type.id === TRANSIT_TYPE_ID;
    const pieces = structureAt(footprints, point, isTransit ? 0 : SNAP_METERS);
    if (pieces.length) {
      // One entry per structure: any structure sharing a piece is merged in, so two places in
      // joined buildings never draw two colours over the same walls.
      const owners = new Set(pieces.flatMap((piece) => owner.get(piece) ?? []));
      const merged = [...owners].flatMap((key) => buildings.get(key) ?? []);
      const allPieces = [...new Set([...pieces, ...merged.flatMap((b) => b.pieces)])];
      const places = merged
        .flatMap((b) => b.places)
        .reduce<readonly Place[]>((list, place) => withPlace(list, place), [{ type, name }]);
      owners.forEach((key) => buildings.delete(key));
      const key = buildingKey(allPieces);
      buildings.set(key, { pieces: allPieces, places });
      allPieces.forEach((piece) => owner.set(piece, key));
    } else {
      const near = dots.findIndex(
        (dot) =>
          dot.places[0]?.type.id === type.id &&
          metersBetween(lngLat(dot.point), lngLat(point)) < MERGE_METERS,
      );
      const dot = dots[near];
      if (dot) dots[near] = { ...dot, places: withPlace(dot.places, { type, name }) };
      else dots.push({ point, places: [{ type, name }] });
    }
  }
  return {
    counts,
    buildings,
    dots: spacedDots(dots.map((dot) => clearOfBuildings(dot, footprints))),
  };
}

// A stop's disc must stand on open ground: one too near a wall is pushed straight away from it.
function clearOfBuildings(dot: Dot, footprints: FootprintIndex): Dot {
  const need = DISC.ringRadius + DISC_GAP_METERS;
  let point = dot.point;
  for (let attempt = 0; attempt < CLEAR_ATTEMPTS; attempt += 1) {
    const wall = footprints
      .near([point[0], point[1], point[0], point[1]], need)
      .map((piece) => nearestWall(piece.polygon[0] ?? [], point))
      .filter((found) => found.isInside || found.meters < need)
      .sort((a, b) => Number(b.isInside) - Number(a.isInside) || a.meters - b.meters)[0];
    if (!wall) break;
    const push = wall.isInside ? wall.meters + need : need - wall.meters;
    const [ux, uy] = wall.isInside ? wall.toward : [-wall.toward[0], -wall.toward[1]];
    point = moved(point, ux * push, uy * push);
  }
  return { ...dot, point };
}

// Discs closer than one disc width are shown as one, whatever their type.
function spacedDots(dots: readonly Dot[]): readonly Dot[] {
  return dots.reduce<readonly Dot[]>((kept, dot) => {
    const index = kept.findIndex(
      (other) =>
        metersBetween(lngLat(other.point), lngLat(dot.point)) <
        DISC.ringRadius * 2 + DISC_GAP_METERS,
    );
    const other = kept[index];
    if (!other) return [...kept, dot];
    const places = dot.places.reduce<readonly Place[]>(
      (list, place) => withPlace(list, place),
      other.places,
    );
    return kept.map((item, at) => (at === index ? { ...other, places } : item));
  }, []);
}

function moved(
  [lng, lat]: readonly [number, number],
  east: number,
  north: number,
): [number, number] {
  const metersPerLng = METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
  return [lng + east / metersPerLng, lat + north / METERS_PER_DEGREE_LAT];
}

const lngLat = ([lng, lat]: readonly [number, number]) => ({ lng, lat });

function discRing([lng, lat]: readonly [number, number], radius: number): number[][] {
  const metersPerLng = METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
  const ring = Array.from({ length: DISC.sides }, (_, index) => {
    const angle = (index / DISC.sides) * 2 * Math.PI;
    return [
      lng + (Math.cos(angle) * radius) / metersPerLng,
      lat + (Math.sin(angle) * radius) / METERS_PER_DEGREE_LAT,
    ];
  });
  return [...ring, ring[0] ?? [lng, lat]];
}

function dotFeatures({ point, places }: Dot): Feature[] {
  const key = `dot:${point[0].toFixed(5)}:${point[1].toFixed(5)}`;
  const disc = (radius: number): Polygon => ({
    type: "Polygon",
    coordinates: [discRing(point, radius)],
  });
  return [
    placeFeature(`${key}:ring`, disc(DISC.ringRadius), places, "ring"),
    placeFeature(key, disc(DISC.radius), places, "stop"),
  ];
}

function placeFeature(
  key: string,
  geometry: Feature["geometry"],
  places: readonly Place[],
  kind: "building" | "stop" | "ring",
  heights: { readonly height: number; readonly base: number } = { height: 0, base: 0 },
): Feature {
  const [first] = places;
  return {
    type: "Feature",
    geometry,
    properties: {
      key,
      kind,
      type: first?.type.id ?? "",
      label: first?.type.label ?? "Place",
      name: first?.name ?? "",
      otherCount: places.length - 1,
      ...heights,
    },
  };
}

function buildingFeatures(key: string, { pieces, places }: Building): Feature[] {
  return pieces.map((piece) => {
    const [outer = [], ...holes] = piece.polygon;
    const polygon: Polygon = {
      type: "Polygon",
      coordinates: [
        offsetRing(outer, OUTLINE_OFFSET_M),
        ...holes.map((hole) => offsetRing(hole, -OUTLINE_OFFSET_M)),
      ],
    };
    return placeFeature(key, polygon, places, "building", {
      height: piece.height,
      base: piece.base,
    });
  });
}

/**
 * Colours the destination buildings in the loaded tiles and returns how many of each type are
 * on the map. Cheap enough to run whenever the map settles.
 */
export function refreshDestinations(map: MapLibreMap): DestinationCounts {
  const source = buildingSource(map);
  const places = map.getSource<GeoJSONSource>(PLACES_SOURCE);
  if (!source || !places) return emptyCounts();
  const { counts, buildings, dots } = collectPlaces(map, source);
  const features = [
    ...[...buildings].flatMap(([key, building]) => buildingFeatures(key, building)),
    ...dots.flatMap(dotFeatures),
  ];
  const json = JSON.stringify(features);
  if (json !== lastData.get(map)) {
    lastData.set(map, json);
    places.setData({ type: "FeatureCollection", features: structuredClone(features) });
  }
  return counts;
}

/** Deepens the destination under the pointer and reports what it is. Returns a cleanup. */
export function trackDestinationHover(
  map: MapLibreMap,
  onChange: (hover: DestinationHover | null) => void,
): () => void {
  if (!map.getLayer(PLACE_BUILDINGS_LAYER)) return () => {};
  let hoveredKey: string | null = null;
  const setHovered = (key: string | null) => {
    if (key === hoveredKey) return;
    if (hoveredKey !== null) {
      map.setFeatureState({ source: PLACES_SOURCE, id: hoveredKey }, { [HOVER_STATE]: false });
    }
    if (key !== null)
      map.setFeatureState({ source: PLACES_SOURCE, id: key }, { [HOVER_STATE]: true });
    hoveredKey = key;
  };
  // Mice fire far more often than frames paint; hit-test at most once per frame.
  let pending: MapMouseEvent | null = null;
  let frame = 0;
  const move = (event: MapMouseEvent) => {
    pending = event;
    if (!frame) frame = requestAnimationFrame(flush);
  };
  const flush = () => {
    frame = 0;
    if (pending) hover(pending);
    pending = null;
  };
  const hover = (event: MapMouseEvent) => {
    const [top] = map.queryRenderedFeatures(event.point, {
      layers: [PLACE_DOTS_LAYER, PLACE_BUILDINGS_LAYER],
    });
    const properties = top?.properties;
    setHovered(properties ? String(properties.key) : null);
    map.getCanvas().style.cursor = properties ? "pointer" : "";
    if (!properties) {
      onChange(null);
      return;
    }
    const label = String(properties.label ?? "Place");
    onChange({
      x: event.point.x,
      y: event.point.y,
      name: String(properties.name || label),
      typeLabel: label,
      otherCount: Number(properties.otherCount ?? 0),
      isNearRight: event.point.x > map.getContainer().clientWidth - TAG_ROOM.x,
      isNearTop: event.point.y < TAG_ROOM.y,
      lng: event.lngLat.lng,
      lat: event.lngLat.lat,
    });
  };
  const leave = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    pending = null;
    setHovered(null);
    map.getCanvas().style.cursor = "";
    onChange(null);
  };
  map.on("mousemove", move);
  map.on("mouseout", leave);
  // The map may already be removed here, so cleanup only detaches the handlers.
  return () => {
    cancelAnimationFrame(frame);
    map.off("mousemove", move);
    map.off("mouseout", leave);
  };
}

/** Straight-line distance in metres; accurate to well under 1% across a city. */
export function metersBetween(
  a: { readonly lng: number; readonly lat: number },
  b: { readonly lng: number; readonly lat: number },
): number {
  const metersPerLng = METERS_PER_DEGREE_LAT * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot((a.lng - b.lng) * metersPerLng, (a.lat - b.lat) * METERS_PER_DEGREE_LAT);
}
