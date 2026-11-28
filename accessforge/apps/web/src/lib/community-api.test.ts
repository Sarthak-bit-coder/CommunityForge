import { afterEach, describe, expect, it, vi } from "vitest";
import { communityLink, communityRequest, timeAgo } from "./community-api";

afterEach(() => vi.unstubAllGlobals());

describe("communityRequest", () => {
  it("GETs through the proxy with the fetch header", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json([{ id: 1 }]));
    vi.stubGlobal("fetch", fetch);
    expect(await communityRequest("/updates")).toEqual([{ id: 1 }]);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/community/updates");
    expect(init).toMatchObject({ method: "GET", credentials: "same-origin", cache: "no-store" });
    expect(init.headers).toEqual({ "X-Requested-With": "fetch" });
  });

  it("POSTs JSON bodies and passes FormData through untouched", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetch);
    await communityRequest("/login", { body: { email: "a@b.co" } });
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: '{"email":"a@b.co"}',
      headers: { "Content-Type": "application/json", "X-Requested-With": "fetch" },
    });
    const form = new FormData();
    await communityRequest("/lost-found", { body: form, method: "PUT" });
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: "PUT", body: form });
    expect(fetch.mock.calls[1][1].headers).toEqual({ "X-Requested-With": "fetch" });
  });

  it("shows the service's error message, or a generic one", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ error: "Please sign in first." }, { status: 401 }))
        .mockResolvedValueOnce(new Response("<html>", { status: 502 })),
    );
    await expect(communityRequest("/notifications")).rejects.toThrow("Please sign in first.");
    await expect(communityRequest("/notifications")).rejects.toThrow("could not complete");
  });

  it("explains a network failure but rethrows an abort", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(communityRequest("/me")).rejects.toThrow("Cannot reach the neighborhood service");
    const controller = new AbortController();
    controller.abort();
    const abort = new DOMException("aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));
    await expect(communityRequest("/me", { signal: controller.signal })).rejects.toBe(abort);
  });
});

describe("communityLink", () => {
  it("maps the service's alert links to pages here", () => {
    expect(communityLink("/lost-found/12")).toBe("/lost-found/item?id=12");
    expect(communityLink("/reports?focus=report-3")).toBe("/incidents");
    expect(communityLink("/updates")).toBe("/updates");
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-11-26T12:00:00Z");
  it.each([
    [null, ""],
    ["2026-11-26T11:59:30Z", "just now"],
    ["2026-11-26T11:59:00Z", "1 minute ago"],
    ["2026-11-26T09:00:00Z", "3 hours ago"],
    ["2026-11-24T12:00:00Z", "2 days ago"],
  ])("%s -> %s", (iso, expected) => {
    expect(timeAgo(iso, now)).toBe(expected);
  });
});
