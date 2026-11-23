import { expect, it } from "vitest";
import { HIDDEN_DESCRIPTION, reportBarrier, type Report } from "./reports-api";

const report: Report = {
  id: "9b647da6-eae7-47f5-9e14-e5331217cffa",
  type: "obstruction",
  description: null,
  severity: 3,
  state: "unverified",
  location: { longitude: -121.9886, latitude: 37.5485 },
  created_at: "2026-11-16T12:00:00Z",
  evidence: [],
};

it("explains a description the API hides until a reviewer confirms the report", () => {
  expect(reportBarrier(report).description).toBe(HIDDEN_DESCRIPTION);
  expect(reportBarrier({ ...report, description: "Cracked ramp" }).description).toBe(
    "Cracked ramp",
  );
});
