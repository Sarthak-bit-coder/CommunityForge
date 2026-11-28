import { describe, expect, it } from "vitest";
import { findNavItem, isCurrentPath, sectionFor } from "./navigation";

describe("isCurrentPath", () => {
  it("matches the overview only on the root path", () => {
    expect(isCurrentPath("/", "/")).toBe(true);
    expect(isCurrentPath("/barriers", "/")).toBe(false);
  });

  it("matches a section and its nested pages but not a lookalike prefix", () => {
    expect(isCurrentPath("/barriers", "/barriers")).toBe(true);
    expect(isCurrentPath("/barriers/42", "/barriers")).toBe(true);
    expect(isCurrentPath("/barriersx", "/barriers")).toBe(false);
  });
});

describe("sectionFor", () => {
  it("puts neighborhood pages under Community and the pilot pages under Routes", () => {
    expect(sectionFor("/community")).toBe("community");
    expect(sectionFor("/lost-found/item")).toBe("community");
    expect(sectionFor("/account")).toBe("community");
    expect(sectionFor("/routes")).toBe("routes");
    expect(sectionFor("/routes/analysis")).toBe("routes");
    expect(sectionFor("/report/track")).toBe("routes");
    expect(sectionFor("/")).toBe("routes");
  });
});

describe("findNavItem", () => {
  it("throws for an unknown route", () => {
    expect(() => findNavItem("/nope")).toThrow("No navigation item for /nope");
  });
});
