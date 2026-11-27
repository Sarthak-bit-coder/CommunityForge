import type { Position } from "geojson";
import { describe, expect, it } from "vitest";
import {
  boundsOf,
  indexFootprints,
  buildingAt,
  buildingKey,
  contains,
  metersToRing,
  nearestWall,
  offsetRing,
  structureAt,
  type Footprint,
} from "./building-footprints";

const METERS_PER_DEGREE_LAT = 111_320;
// A 0.001° square near the equator (about 111 m a side), counter-clockwise and closed.
const SQUARE: Position[] = [
  [0, 0],
  [0.001, 0],
  [0.001, 0.001],
  [0, 0.001],
  [0, 0],
];

function piece(ring: Position[], tile: string, overrides: Partial<Footprint> = {}): Footprint {
  return {
    tile,
    zoom: Number(tile.split("/")[0]),
    polygon: [ring],
    bbox: boundsOf(ring),
    height: 8,
    base: 0,
    ...overrides,
  };
}

function shifted(ring: Position[], dLng: number): Position[] {
  return ring.map(([lng = 0, lat = 0]) => [lng + dLng, lat]);
}

describe("offsetRing", () => {
  it("moves every edge of a square outwards by the given distance", () => {
    // Arrange
    const meters = 1;
    const expectedShift = meters / METERS_PER_DEGREE_LAT;

    // Act
    const grown = offsetRing(SQUARE, meters);

    // Assert
    const [w, s, e, n] = boundsOf(grown);
    expect(w).toBeCloseTo(-expectedShift, 9);
    expect(s).toBeCloseTo(-expectedShift, 9);
    expect(e).toBeCloseTo(0.001 + expectedShift, 9);
    expect(n).toBeCloseTo(0.001 + expectedShift, 9);
    expect(grown[0]).toEqual(grown[grown.length - 1]);
  });

  it("grows outwards whichever way the ring winds", () => {
    // Arrange
    const clockwise = [...SQUARE].reverse();

    // Act
    const grown = offsetRing(clockwise, 1);

    // Assert
    expect(boundsOf(grown)[0]).toBeLessThan(0);
    expect(boundsOf(grown)[2]).toBeGreaterThan(0.001);
  });

  it("encloses every original corner, so the overlay never shares a wall", () => {
    // Arrange: an L-shape, with an inward-facing corner.
    const lShape: Position[] = [
      [0, 0],
      [0.002, 0],
      [0.002, 0.001],
      [0.001, 0.001],
      [0.001, 0.002],
      [0, 0.002],
      [0, 0],
    ];

    // Act
    const grown = offsetRing(lShape, 0.25);

    // Assert
    lShape.forEach((corner) => expect(contains(grown, corner)).toBe(true));
  });
});

describe("buildingAt", () => {
  it("returns nothing when no building holds the point", () => {
    expect(buildingAt([piece(SQUARE, "14/0/0")], [0.5, 0.5])).toEqual([]);
  });

  it("joins the piece of a building cut into a neighbouring tile", () => {
    // Arrange: two pieces overlapping in the tile margin.
    const left = piece(SQUARE, "14/0/0");
    const right = piece(shifted(SQUARE, 0.0009), "14/1/0");

    // Act
    const pieces = buildingAt([left, right], [0.0002, 0.0005]);

    // Assert
    expect(pieces).toEqual([left, right]);
    expect(buildingKey(pieces)).toBe(buildingKey([right, left]));
  });

  it("keeps a touching building of a different height separate", () => {
    // Arrange
    const left = piece(SQUARE, "14/0/0");
    const neighbour = piece(shifted(SQUARE, 0.0009), "14/1/0", { height: 20 });

    // Act
    const pieces = buildingAt([left, neighbour], [0.0002, 0.0005]);

    // Assert
    expect(pieces).toEqual([left]);
  });

  it("keeps separate buildings from the same tile separate", () => {
    // Arrange
    const left = piece(SQUARE, "14/0/0");
    const sameTile = piece(shifted(SQUARE, 0.0009), "14/0/0");

    // Act
    const pieces = buildingAt([left, sameTile], [0.0002, 0.0005]);

    // Assert
    expect(pieces).toEqual([left]);
  });

  it("prefers the most detailed tile while a parent tile is still loaded", () => {
    // Arrange
    const parent = piece(SQUARE, "13/0/0");
    const child = piece(SQUARE, "14/0/0");

    // Act
    const [first] = buildingAt([parent, child], [0.0005, 0.0005]);

    // Assert
    expect(first).toBe(child);
  });
});

describe("structureAt", () => {
  it("colours every touching part of a building, even at another height", () => {
    // Arrange
    const main = piece(SQUARE, "16/1/1");
    const wing = piece(shifted(SQUARE, 0.001), "16/1/1", { height: 14 });
    const apart = piece(shifted(SQUARE, 0.003), "16/1/1");

    // Act
    const pieces = structureAt([main, wing, apart], [0.0005, 0.0005]);

    // Assert
    expect(pieces).toEqual([main, wing]);
  });

  it("picks the building just outside a point within the snap distance, and none beyond it", () => {
    // Arrange
    const building = piece(SQUARE, "16/1/1");
    const tenMetresOut: [number, number] = [0.0005, -10 / METERS_PER_DEGREE_LAT];

    // Act
    const near = structureAt([building], tenMetresOut, 25);
    const tooFar = structureAt([building], tenMetresOut, 5);

    // Assert
    expect(near).toEqual([building]);
    expect(tooFar).toEqual([]);
  });
});

describe("metersToRing", () => {
  it("measures the distance from a point to the nearest wall", () => {
    // Arrange
    const point: [number, number] = [0.0005, -20 / METERS_PER_DEGREE_LAT];

    // Act
    const meters = metersToRing(SQUARE, point);

    // Assert
    expect(meters).toBeCloseTo(20, 1);
  });
});

describe("nearestWall", () => {
  it("points from a stop toward the closest wall and knows when the stop is inside", () => {
    // Arrange
    const outside: [number, number] = [0.0005, -5 / METERS_PER_DEGREE_LAT];
    const inside: [number, number] = [0.0005, 0.0005];

    // Act
    const fromOutside = nearestWall(SQUARE, outside);
    const fromInside = nearestWall(SQUARE, inside);

    // Assert
    expect(fromOutside.meters).toBeCloseTo(5, 1);
    expect(fromOutside.toward[1]).toBeCloseTo(1, 5);
    expect(fromOutside.isInside).toBe(false);
    expect(fromInside.isInside).toBe(true);
  });
});

describe("indexFootprints", () => {
  it("finds only the buildings near a box", () => {
    // Arrange
    const here = piece(SQUARE, "16/1/1");
    const farAway = piece(shifted(SQUARE, 0.05), "16/1/1");
    const index = indexFootprints([here, farAway]);

    // Act
    const found = index.near([0.0005, 0.0005, 0.0005, 0.0005]);

    // Assert
    expect(found).toEqual([here]);
  });
});
