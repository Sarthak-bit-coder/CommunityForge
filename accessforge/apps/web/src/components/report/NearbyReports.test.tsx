import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { NearbyReports } from "./NearbyReports";

const id = "9b647da6-eae7-47f5-9e14-e5331217cffa";
const point = { lat: 37.5485, lng: -121.9886 };
const report = {
  id,
  type: "obstruction",
  state: "unverified",
  location: { latitude: point.lat, longitude: point.lng },
  description: "Private text",
};
afterEach(() => vi.unstubAllGlobals());

it("checks pages on request, showing only nearby same-type matches and no descriptions", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        data: [{ ...report, location: { latitude: 37.8, longitude: point.lng } }],
        meta: { page: 1, limit: 1, total: 2 },
      }),
    )
    .mockResolvedValueOnce(
      Response.json({ data: [report], meta: { page: 2, limit: 1, total: 2 } }),
    );
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(<NearbyReports type="obstruction" point={point} />);
  expect(fetch).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Check nearby reports" }));
  expect(await screen.findByText("Checked 1 of 2 reports. 0 nearby.")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Check older reports" }));
  expect(await screen.findByRole("link", { name: /about 0 m · Pending/ })).toHaveAttribute(
    "href",
    `/report/track?id=${id}`,
  );
  expect(screen.queryByText("Private text")).toBeNull();
  expect(fetch.mock.calls.every(([, options]) => options.credentials === "omit")).toBe(true);
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    "/api/reports?page=1&limit=20&type=obstruction",
    "/api/reports?page=2&limit=20&type=obstruction",
  ]);
});

it("leaves a failed page available to retry without claiming zero matches", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(Response.json({ data: [], meta: { page: 1, limit: 20, total: 0 } })),
  );
  const user = userEvent.setup();
  render(<NearbyReports type="obstruction" point={point} />);
  const check = screen.getByRole("button", { name: "Check nearby reports" });
  await user.click(check);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not check nearby reports.");
  expect(screen.queryByText(/0 nearby/)).toBeNull();
  await user.click(check);
  expect(await screen.findByText("Checked 0 of 0 reports. 0 nearby.")).toBeVisible();
  expect(screen.queryByRole("alert")).toBeNull();
});
