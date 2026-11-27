import { afterEach, describe, expect, it, vi } from "vitest";
import { isWatched, setWatched, WATCHED_STORAGE_KEY } from "./watched-barriers";

describe("watched barriers", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("adds and removes a barrier without touching others", () => {
    expect(setWatched("a", true)).toBe(true);
    expect(setWatched("b", true)).toBe(true);
    expect(setWatched("a", false)).toBe(true);
    expect(isWatched("a")).toBe(false);
    expect(isWatched("b")).toBe(true);
  });

  it("treats corrupt or non-string stored data as an empty list", () => {
    localStorage.setItem(WATCHED_STORAGE_KEY, "{not json");
    expect(isWatched("a")).toBe(false);
    localStorage.setItem(WATCHED_STORAGE_KEY, JSON.stringify(["a", 4, null]));
    expect(isWatched("a")).toBe(true);
    expect(setWatched("b", true)).toBe(true);
    expect(JSON.parse(localStorage.getItem(WATCHED_STORAGE_KEY) ?? "")).toEqual(["a", "b"]);
  });

  it("reports failure when the browser refuses to save", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(setWatched("a", true)).toBe(false);
  });
});
