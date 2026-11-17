import { describe, expect, it } from "vitest";
import { MAX_PHOTO_BYTES, parseLocation, photoError, validateReport } from "./report";

const valid = {
  type: "obstruction",
  description: "Blocked passage",
  latitude: "37.5485",
  longitude: "-121.9886",
};

describe("demo report validation", () => {
  it("requires type, description and coordinates, without treating blanks as zero", () => {
    expect(
      Object.keys(validateReport({ type: "", description: " ", latitude: "", longitude: "" })),
    ).toEqual(["type", "description", "latitude", "longitude"]);
    expect(validateReport(valid)).toEqual({});
    expect(validateReport({ ...valid, type: "unknown" })).toHaveProperty("type");
    expect(validateReport({ ...valid, description: "x".repeat(2001) })).toHaveProperty(
      "description",
    );
  });
  it("accepts valid boundary and zero coordinates, rejects invalid ranges and syntax", () => {
    expect(parseLocation("0", "0")).toEqual({ lat: 0, lng: 0 });
    expect(parseLocation("-90", "180")).toEqual({ lat: -90, lng: 180 });
    for (const [lat, lng] of [
      ["91", "0"],
      ["0", "181"],
      ["NaN", "0"],
      ["", "0"],
      ["0", "Infinity"],
      ["0x10", "0"],
    ]) {
      expect(parseLocation(lat, lng)).toBeNull();
    }
  });
  it("allows optional JPEG, PNG and WebP files up to 5 MiB", () => {
    expect(photoError(undefined)).toBeUndefined();
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(photoError(new File(["photo"], "photo", { type }))).toBeUndefined();
    }
    expect(
      photoError(new File([new Uint8Array(MAX_PHOTO_BYTES)], "photo.png", { type: "image/png" })),
    ).toBeUndefined();
    expect(
      photoError(
        new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], "photo.png", { type: "image/png" }),
      ),
    ).toMatch(/5 MiB/);
    expect(photoError(new File(["<svg/>"], "photo.svg", { type: "image/svg+xml" }))).toMatch(
      /JPEG, PNG, or WebP/,
    );
    expect(photoError(new File([], "empty.png", { type: "image/png" }))).toMatch(/empty/);
  });
});
