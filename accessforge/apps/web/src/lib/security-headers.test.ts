import { describe, expect, it } from "vitest";

import { CONTENT_SECURITY_POLICY, contentSecurityPolicy } from "./security-headers";

function parseDirectives(policy: string): Map<string, string[]> {
  return new Map(
    policy
      .split(";")
      .map((part) => part.trim().split(/\s+/))
      .map(([name, ...values]) => [name, values]),
  );
}

describe("content security policy", () => {
  it("restricts the default source and blocks framing, plugins and foreign base URIs", () => {
    const directives = parseDirectives(CONTENT_SECURITY_POLICY);

    expect(directives.get("default-src")).toEqual(["'self'"]);
    expect(directives.get("frame-ancestors")).toEqual(["'none'"]);
    expect(directives.get("object-src")).toEqual(["'none'"]);
    expect(directives.get("base-uri")).toEqual(["'self'"]);
    expect(directives.get("form-action")).toEqual(["'self'"]);
  });

  it("allows external origins only for basemap requests, and no eval", () => {
    const directives = parseDirectives(CONTENT_SECURITY_POLICY);

    expect(directives.get("connect-src")).toEqual([
      "'self'",
      "https://tiles.openfreemap.org",
      "https://api.maptiler.com",
    ]);
    const others = [...directives].filter(([name]) => name !== "connect-src");
    expect(others.flatMap(([, values]) => values).join(" ")).not.toMatch(/https?:/);
    expect(CONTENT_SECURITY_POLICY).not.toContain("unsafe-eval");
  });

  it("allows eval only for the development server, where React's error overlay needs it", () => {
    expect(parseDirectives(contentSecurityPolicy(true)).get("script-src")).toContain(
      "'unsafe-eval'",
    );
    expect(CONTENT_SECURITY_POLICY).toBe(contentSecurityPolicy(false));
  });

  it("allows MapLibre workers from blob URLs and photo previews from object URLs", () => {
    const directives = parseDirectives(CONTENT_SECURITY_POLICY);

    expect(directives.get("worker-src")).toEqual(["'self'", "blob:"]);
    expect(directives.get("img-src")).toEqual(["'self'", "data:", "blob:"]);
  });
});
