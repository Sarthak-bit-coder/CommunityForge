import { afterEach, describe, expect, it, vi } from "vitest";
import corridor from "@/test/corridor-plan.json";
import {
  EXPORT_NOTICE,
  dataUri,
  fetchPlan,
  parseBudget,
  planCsv,
  recommended,
  repairTarget,
  type Plan,
} from "./planning-api";

// Captured from the real engine: GET /planning/plans?dataset=corridor&budget=20.
const plan = corridor as Plan;
const signal = () => new AbortController().signal;

afterEach(() => vi.unstubAllGlobals());

describe("parseBudget", () => {
  it.each([
    ["20", 20],
    [" 12.5 ", 12.5],
    ["0", 0],
  ])("accepts %s", (text, expected) => expect(parseBudget(text)).toBe(expected));

  it.each(["", "  ", "abc", "-1", "Infinity", "NaN", "1000001"])("rejects %j", (text) =>
    expect(parseBudget(text)).toBeNull(),
  );
});

describe("plan helpers", () => {
  it("picks the exhaustive plan as the recommendation", () => {
    expect(recommended(plan).selected_repair_ids).toEqual(["r0", "r1"]);
    expect(() => recommended({ ...plan, plans: [] })).toThrow("missing the recommended method");
  });

  it("describes what a repair fixes in plain words", () => {
    expect(repairTarget(plan.network, "r0")).toBe("step on segment e0");
    expect(repairTarget(plan.network, "missing")).toBe("");
  });

  it("exports every method with provenance and escapes commas", () => {
    const csv = planCsv(plan);
    const lines = csv.split("\n");
    expect(lines[0]).toBe(`notice,"${EXPORT_NOTICE}"`);
    expect(lines).toContain("dataset,corridor");
    expect(lines).toContain("exhaustive,r0,step on segment e0,10,20,10,20");
    expect(lines).toContain("B3,,no repair selected,0,0,0,10");
    expect(decodeURIComponent(dataUri("text/csv", csv))).toBe(`data:text/csv;charset=utf-8,${csv}`);
  });
});

describe("fetchPlan", () => {
  it("requests the dataset and budget and returns the plan", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: plan })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchPlan("corridor", 20, signal())).resolves.toEqual(plan);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/planning/plans?dataset=corridor&budget=20");
  });

  it.each([
    [new Response("", { status: 429 }), "Too many planning runs"],
    [new Response("", { status: 503 }), "could not complete this run"],
    [new Response("not json"), "unreadable response"],
  ])("explains a failed response", async (response, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(fetchPlan("corridor", 20, signal())).rejects.toThrow(message);
  });

  it("explains an unreachable service but passes through a caller's abort", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(fetchPlan("corridor", 20, signal())).rejects.toThrow("Cannot reach");
    const controller = new AbortController();
    controller.abort();
    await expect(fetchPlan("corridor", 20, controller.signal)).rejects.toThrow("offline");
  });
});
