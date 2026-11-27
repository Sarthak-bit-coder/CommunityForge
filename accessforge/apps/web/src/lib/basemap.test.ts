import { describe, expect, it } from "vitest";
import { BASEMAP_ORIGINS, OPENFREEMAP_STYLE_URL, basemap } from "./basemap";

describe("basemap", () => {
  it("uses keyless OpenFreeMap when no MapTiler key is configured", () => {
    expect(basemap(undefined)).toEqual({
      styleUrl: OPENFREEMAP_STYLE_URL,
      provider: "OpenFreeMap",
    });
    expect(basemap("   ").provider).toBe("OpenFreeMap");
  });

  it("uses MapTiler with an encoded key when one is configured", () => {
    const { styleUrl, provider } = basemap(" a b&c ");

    expect(provider).toBe("MapTiler");
    expect(styleUrl).toBe("https://api.maptiler.com/maps/streets-v2/style.json?key=a%20b%26c");
  });

  it("only uses style URLs from the origins the CSP allows", () => {
    for (const key of [undefined, "key"]) {
      expect(BASEMAP_ORIGINS).toContain(new URL(basemap(key).styleUrl).origin);
    }
  });
});
