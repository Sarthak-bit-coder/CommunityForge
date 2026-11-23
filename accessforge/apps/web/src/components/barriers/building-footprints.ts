import type { Position } from "geojson";
import type { GeoJSONFeature } from "maplibre-gl";

// Building footprints read back from the basemap's vector tiles, for colouring destinations.
// Tiles merge many buildings into one multipolygon feature, so a building here is one polygon
// part, not one feature. A building cut by a tile edge comes back as one piece per tile.

const METERS_PER_DEGREE_LAT = 111_320;
// At a sharp corner an offset vertex moves further than the offset; this caps how far.
const MITER_LIMIT = 3;
const EPSILON = 1e-9;

type Bbox = readonly [number, number, number, number];

export type Footprint = {
  /** Tile the piece came from, as "z/x/y". */
  readonly tile: string;
  readonly zoom: number;
  /** Outer ring, then holes. */
  readonly polygon: readonly (readonly Position[])[];
  readonly bbox: Bbox;
  readonly height: number;
  readonly base: number;
};

export function footprintsOf(features: readonly GeoJSONFeature[]): Footprint[] {
  return features.flatMap((feature) => {
    const { geometry } = feature.toJSON();
    const polygons =
      geometry.type === "Polygon"
        ? [geometry.coordinates]
        : geometry.type === "MultiPolygon"
          ? geometry.coordinates
          : [];
    const height = Number(feature.properties?.render_height ?? 0);
    const base = Number(feature.properties?.render_min_height ?? 0);
    const tile = `${feature._z}/${feature._x}/${feature._y}`;
    return polygons.map((polygon) => ({
      tile,
      zoom: feature._z,
      polygon,
      bbox: boundsOf(polygon[0] ?? []),
      height,
      base,
    }));
  });
}

export function boundsOf(ring: readonly Position[]): [number, number, number, number] {
  return ring.reduce<[number, number, number, number]>(
    ([w, s, e, n], [x = 0, y = 0]) => [
      Math.min(w, x),
      Math.min(s, y),
      Math.max(e, x),
      Math.max(n, y),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
}

// Even-odd ray cast against one ring.
export function contains(
  ring: readonly Position[],
  [lng = 0, lat = 0]: readonly number[],
): boolean {
  let isInside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi = 0, yi = 0] = ring[i] ?? [];
    const [xj = 0, yj = 0] = ring[j] ?? [];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      isInside = !isInside;
    }
  }
  return isInside;
}

function bboxesMeet([aw, as, ae, an]: Bbox, [bw, bs, be, bn]: Bbox): boolean {
  return aw <= be && bw <= ae && as <= bn && bs <= an;
}

function isInBbox([w, s, e, n]: Bbox, [lng, lat]: readonly [number, number]): boolean {
  return lng >= w && lng <= e && lat >= s && lat <= n;
}

// Two pieces of one building, cut apart by a tile edge: same zoom, different tiles, same height,
// and overlapping (tiles keep a margin past their edge, so the pieces share a strip).
function isOtherPieceOf(a: Footprint, b: Footprint): boolean {
  const [ringA = [], ringB = []] = [a.polygon[0], b.polygon[0]];
  return (
    a.zoom === b.zoom &&
    a.tile !== b.tile &&
    a.height === b.height &&
    a.base === b.base &&
    bboxesMeet(a.bbox, b.bbox) &&
    (ringB.some((point) => contains(ringA, point)) || ringA.some((point) => contains(ringB, point)))
  );
}

/** Every piece of the building at `point`, or none when no building is there. */
export function buildingAt(
  footprints: readonly Footprint[],
  point: readonly [number, number],
): readonly Footprint[] {
  // While tiles load, a parent tile can overlap its children; the most detailed piece wins.
  const first = footprints
    .filter((piece) => isInBbox(piece.bbox, point) && contains(piece.polygon[0] ?? [], point))
    .sort((a, b) => b.zoom - a.zoom)[0];
  if (!first) return [];
  const pieces = [first];
  for (let index = 0; index < pieces.length; index += 1) {
    const piece = pieces[index];
    if (!piece) continue;
    const others = footprints.filter(
      (other) => !pieces.includes(other) && isOtherPieceOf(piece, other),
    );
    pieces.push(...others);
  }
  return pieces;
}

/** A stable name for a building, the same whichever of its pieces was found first. */
export function buildingKey(pieces: readonly Footprint[]): string {
  return (
    pieces
      .map((piece) => `${piece.tile}:${piece.bbox.map((value) => value.toFixed(6)).join(",")}`)
      .sort()[0] ?? ""
  );
}

function withoutRepeats(ring: readonly Position[]): Position[] {
  const points = ring.filter((point, index) => {
    const previous = ring[index - 1];
    return !previous || previous[0] !== point[0] || previous[1] !== point[1];
  });
  const [first] = points;
  const last = points[points.length - 1];
  return first && last && first[0] === last[0] && first[1] === last[1]
    ? points.slice(0, -1)
    : points;
}

type Vector = readonly [number, number];

function unitNormal([ax, ay]: Vector, [bx, by]: Vector, sign: number): Vector {
  const length = Math.hypot(bx - ax, by - ay) || 1;
  return [(sign * (by - ay)) / length, (sign * -(bx - ax)) / length];
}

/**
 * Moves a ring's edges `meters` away from its inside (negative: towards it), keeping corners
 * mitred. A colour overlay built from the offset ring encloses the building beneath it, so the
 * two never share a wall and never flicker against each other.
 */
export function offsetRing(ring: readonly Position[], meters: number): Position[] {
  const points = withoutRepeats(ring);
  const [origin] = points;
  if (!origin || points.length < 3) return ring.map((point) => [...point]);
  const [lng0 = 0, lat0 = 0] = origin;
  const metersPerLng = METERS_PER_DEGREE_LAT * Math.cos((lat0 * Math.PI) / 180);
  const local: Vector[] = points.map(([lng = 0, lat = 0]) => [
    (lng - lng0) * metersPerLng,
    (lat - lat0) * METERS_PER_DEGREE_LAT,
  ]);
  const twiceArea = local.reduce((sum, [x, y], index) => {
    const [nx, ny] = local[(index + 1) % local.length] ?? [0, 0];
    return sum + x * ny - nx * y;
  }, 0);
  // Counter-clockwise rings have their outside on the right of each edge.
  const sign = twiceArea > 0 ? 1 : -1;
  const moved = local.map((point, index) => {
    const previous = local[(index - 1 + local.length) % local.length] ?? point;
    const next = local[(index + 1) % local.length] ?? point;
    const [n1x, n1y] = unitNormal(previous, point, sign);
    const [n2x, n2y] = unitNormal(point, next, sign);
    const length = Math.hypot(n1x + n2x, n1y + n2y);
    const [bx, by] = length < EPSILON ? [n1x, n1y] : [(n1x + n2x) / length, (n1y + n2y) / length];
    const reach = meters / Math.max(bx * n1x + by * n1y, 1 / MITER_LIMIT);
    return [point[0] + bx * reach, point[1] + by * reach] as const;
  });
  const lngLat = moved.map(([x, y]): Position => [
    lng0 + x / metersPerLng,
    lat0 + y / METERS_PER_DEGREE_LAT,
  ]);
  return [...lngLat, [...(lngLat[0] ?? [lng0, lat0])]];
}

export type Wall = {
  readonly meters: number;
  /** Unit vector (east, north) from the point toward the nearest wall. */
  readonly toward: Vector;
  readonly isInside: boolean;
};

/** The nearest wall of `ring` to `point`, how far it is, and which way. */
export function nearestWall(ring: readonly Position[], point: readonly [number, number]): Wall {
  const [lng, lat] = point;
  const metersPerLng = METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
  let best: { meters: number; toward: Vector } = { meters: Infinity, toward: [0, 0] };
  for (let index = 0; index + 1 < ring.length; index += 1) {
    const [ax = 0, ay = 0] = ring[index] ?? [];
    const [bx = 0, by = 0] = ring[index + 1] ?? [];
    const a: Vector = [(ax - lng) * metersPerLng, (ay - lat) * METERS_PER_DEGREE_LAT];
    const b: Vector = [(bx - lng) * metersPerLng, (by - lat) * METERS_PER_DEGREE_LAT];
    const lengthSq = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 || EPSILON;
    const t = Math.max(0, Math.min(1, -(a[0] * (b[0] - a[0]) + a[1] * (b[1] - a[1])) / lengthSq));
    const x = a[0] + t * (b[0] - a[0]);
    const y = a[1] + t * (b[1] - a[1]);
    const meters = Math.hypot(x, y);
    if (meters < best.meters) best = { meters, toward: [x / (meters || 1), y / (meters || 1)] };
  }
  return { ...best, isInside: ring.length > 2 && contains(ring, point) };
}

/** Distance in metres from `point` to the nearest edge of `ring`. */
export function metersToRing(
  ring: readonly Position[],
  [lng, lat]: readonly [number, number],
): number {
  const metersPerLng = METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
  const local = ring.map(([x = 0, y = 0]): Vector => [
    (x - lng) * metersPerLng,
    (y - lat) * METERS_PER_DEGREE_LAT,
  ]);
  let best = Infinity;
  for (let index = 0; index + 1 < local.length; index += 1) {
    const [ax, ay] = local[index] ?? [0, 0];
    const [bx, by] = local[index + 1] ?? [0, 0];
    const lengthSq = (bx - ax) ** 2 + (by - ay) ** 2 || EPSILON;
    const t = Math.max(0, Math.min(1, -(ax * (bx - ax) + ay * (by - ay)) / lengthSq));
    best = Math.min(best, Math.hypot(ax + t * (bx - ax), ay + t * (by - ay)));
  }
  return best;
}

// Parts of one structure: their outlines touch or overlap. That covers walls shared by parts of
// different heights, and the same building read from tiles of different zooms (each copy is
// clipped to its own tile, so only together do they cover the whole footprint).
const TOUCH_METERS = 0.75;
function touches(a: Footprint, b: Footprint): boolean {
  if (!bboxesMeet(a.bbox, b.bbox)) return false;
  const [ringA = [], ringB = []] = [a.polygon[0], b.polygon[0]];
  return ringB.some(
    ([lng = 0, lat = 0]) =>
      contains(ringA, [lng, lat]) || metersToRing(ringA, [lng, lat]) <= TOUCH_METERS,
  );
}

/**
 * The whole structure at `point`: every tile piece and every touching part, so the colour
 * covers all of it. Within `nearMeters`, a point just outside a wall picks that building.
 */
export function structureAt(
  footprints: readonly Footprint[] | FootprintIndex,
  point: readonly [number, number],
  nearMeters = 0,
): readonly Footprint[] {
  const index = "near" in footprints ? footprints : indexFootprints(footprints);
  const around = index.near([point[0], point[1], point[0], point[1]], nearMeters);
  let seed = buildingAt(around, point);
  if (!seed.length && nearMeters > 0) {
    const nearest = around
      .map((piece) => ({ piece, meters: metersToRing(piece.polygon[0] ?? [], point) }))
      .filter(({ meters }) => meters <= nearMeters)
      .sort((a, b) => a.meters - b.meters || b.piece.zoom - a.piece.zoom)[0];
    if (nearest) seed = [nearest.piece];
  }
  if (!seed.length) return [];
  const pieces = [...seed];
  const found = new Set(pieces);
  for (let at = 0; at < pieces.length; at += 1) {
    const piece = pieces[at];
    if (!piece) continue;
    for (const other of index.near(piece.bbox, TOUCH_METERS)) {
      if (!found.has(other) && (isOtherPieceOf(piece, other) || touches(piece, other))) {
        found.add(other);
        pieces.push(other);
      }
    }
  }
  return pieces;
}

// A coarse grid over the footprints, so a lookup only checks buildings in nearby cells
// instead of every building on the map.
const CELL_DEGREES = 0.001;
// Generous metres-to-degrees for padding a search box (longitude degrees are shorter).
const PAD_METERS_PER_DEGREE = 80_000;

export type FootprintIndex = {
  readonly all: readonly Footprint[];
  readonly near: (bbox: Bbox, padMeters?: number) => readonly Footprint[];
};

const cellOf = (value: number) => Math.floor(value / CELL_DEGREES);

export function indexFootprints(footprints: readonly Footprint[]): FootprintIndex {
  const cells = new Map<string, Footprint[]>();
  for (const piece of footprints) {
    const [w, s, e, n] = piece.bbox;
    for (let x = cellOf(w); x <= cellOf(e); x += 1) {
      for (let y = cellOf(s); y <= cellOf(n); y += 1) {
        const key = `${x}:${y}`;
        const cell = cells.get(key);
        if (cell) cell.push(piece);
        else cells.set(key, [piece]);
      }
    }
  }
  const near = ([w, s, e, n]: Bbox, padMeters = 0): readonly Footprint[] => {
    const pad = padMeters / PAD_METERS_PER_DEGREE;
    const found = new Set<Footprint>();
    for (let x = cellOf(w - pad); x <= cellOf(e + pad); x += 1) {
      for (let y = cellOf(s - pad); y <= cellOf(n + pad); y += 1) {
        cells.get(`${x}:${y}`)?.forEach((piece) => found.add(piece));
      }
    }
    return [...found];
  };
  return { all: footprints, near };
}
