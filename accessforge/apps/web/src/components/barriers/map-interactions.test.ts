import { describe, expect, it } from "vitest";
import { comesWithin } from "./map-interactions";

// At the equator one degree of latitude is 111 320 m, so 0.001° ≈ 111 m and 0.002° ≈ 223 m.
describe("comesWithin", () => {
  const center = { lng: 0, lat: 0 };
  const lineAt = (lat: number) => ({
    type: "LineString" as const,
    coordinates: [
      [-0.01, lat],
      [0.01, lat],
    ],
  });

  it("counts a path whose nearest point is about 111 m away", () => {
    expect(comesWithin(lineAt(0.001), center, 200)).toBe(true);
  });

  it("leaves out a path about 223 m away", () => {
    expect(comesWithin(lineAt(0.002), center, 200)).toBe(false);
  });

  it("measures to the segment, not just its end points", () => {
    // Both ends are over 1 km away, but the middle passes 111 m from the barrier.
    expect(comesWithin(lineAt(0.001), center, 120)).toBe(true);
  });
});
