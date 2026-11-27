import { describe, expect, it } from "vitest";
import { NO_FILTER, filterBarriers } from "./barriers";
import { SAMPLE_BARRIERS } from "./sample-barriers";

describe("filterBarriers", () => {
  it("returns every barrier when no filter is set", () => {
    expect(filterBarriers(SAMPLE_BARRIERS, NO_FILTER)).toHaveLength(SAMPLE_BARRIERS.length);
  });

  it("keeps only barriers matching both type and verification status", () => {
    const result = filterBarriers(SAMPLE_BARRIERS, {
      type: "missing_curb_ramp",
      state: "confirmed",
    });

    expect(result.map((barrier) => barrier.id)).toEqual(["sample-01"]);
  });

  it("does not modify the input array", () => {
    const input = [...SAMPLE_BARRIERS];

    filterBarriers(input, { type: "obstruction", state: "all" });

    expect(input).toEqual(SAMPLE_BARRIERS);
  });
});

describe("sample data", () => {
  it("has unique ids and labels every barrier as fictional", () => {
    expect(new Set(SAMPLE_BARRIERS.map((barrier) => barrier.id)).size).toBe(SAMPLE_BARRIERS.length);
    for (const barrier of SAMPLE_BARRIERS) {
      expect(barrier.description).toMatch(/^Fictional example/);
      expect(barrier.locationDescription).toMatch(/\(fictional\)$/);
    }
  });
});
