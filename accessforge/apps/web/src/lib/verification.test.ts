import { describe, expect, it } from "vitest";
import { verificationDisplay, verificationState } from "./barriers";

describe("verification status presentation", () => {
  it.each([
    ["unverified", "Pending", "?"],
    ["confirmed", "Verified", "V"],
    ["rejected", "Rejected", "×"],
  ])("presents %s consistently", (state, label, symbol) => {
    expect(verificationDisplay(state)).toMatchObject({ label, symbol });
    expect(verificationState(state)).toBe(state);
  });
  it.each([undefined, null, "", "verified", "future_status", "__proto__", {}, 1])(
    "fails safely for unsupported status %j",
    (state) => {
      expect(verificationState(state)).toBe("unknown");
      expect(verificationDisplay(state).label).toBe("Unknown status");
      expect(verificationDisplay(state).explanation).toContain(
        "Do not treat this report as verified",
      );
    },
  );
});
