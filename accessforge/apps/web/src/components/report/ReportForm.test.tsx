import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { fakeMapControl, resetFakeMaplibre } from "@/test/fake-maplibre";
import { MAX_PHOTO_BYTES } from "@/lib/report";
import { ReportForm } from "./ReportForm";

vi.mock("maplibre-gl", () => import("@/test/fake-maplibre"));
// Street loading is covered in BarrierMap.test; keep fetch for the report request only.
vi.mock("@/lib/network-api", async (original) => ({
  ...(await original<typeof import("@/lib/network-api")>()),
  fetchStreets: () => Promise.resolve(null),
}));

const REPORT_ID = "9b647da6-eae7-47f5-9e14-e5331217cffa";

beforeEach(() => {
  resetFakeMaplibre();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: REPORT_ID, state: "unverified" }, meta: {} }), {
        status: 201,
      }),
    ),
  );
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:local-preview");
      static revokeObjectURL = vi.fn();
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

async function loadedForm() {
  const view = render(<ReportForm />);
  await waitFor(() => expect(fakeMapControl.instances).toHaveLength(1));
  const map = fakeMapControl.instances[0];
  act(() => map.emit("load"));
  return { ...view, map };
}

async function fillRequired() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Obstruction" }));
  await user.click(
    within(screen.getByRole("group", { name: "Severity (1–5)" })).getByRole("radio", {
      name: "3",
    }),
  );
  await user.type(screen.getByLabelText("Description"), "Fictional blocked walkway");
  await user.type(screen.getByLabelText("Latitude"), "37.5485");
  await user.type(screen.getByLabelText("Longitude"), "-121.9886");
  return user;
}

describe("ReportForm", () => {
  it("focuses an accessible error summary and links to required fields", async () => {
    await loadedForm();
    await userEvent.setup().click(screen.getByRole("button", { name: "Submit report" }));
    const summary = screen.getByRole("group", { name: "Please correct your report" });
    expect(summary).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a barrier type.");
    const firstType = screen.getByRole("radio", { name: "Missing curb ramp" });
    expect(screen.getByRole("group", { name: "Barrier type" })).toHaveAccessibleDescription(
      "Choose a barrier type.",
    );
    await userEvent.setup().click(screen.getByRole("link", { name: "Choose a barrier type." }));
    expect(firstType).toHaveFocus();
  });
  it("submits the API payload once and prevents repeat submission", async () => {
    await loadedForm();
    const user = await fillRequired();
    await user.dblClick(screen.getByRole("button", { name: "Submit report" }));
    expect(await screen.findByRole("status", { name: "Report submitted" })).toHaveTextContent(
      "saved with status Pending",
    );
    expect(screen.getByRole("link", { name: "Track this report" })).toHaveAttribute(
      "href",
      `/report/track?id=${REPORT_ID}`,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({
      type: "obstruction",
      description: "Fictional blocked walkway",
      severity: 3,
      location: { latitude: 37.5485, longitude: -121.9886 },
    });
  });
  it("locks controls and ignores repeated form events while a request is pending", async () => {
    let resolve!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise<Response>((done) => {
        resolve = done;
      }),
    );
    await loadedForm();
    await fillRequired();
    const form = screen.getByRole("form", { name: "Barrier report" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Submitting…" })).toBeDisabled();
    expect(screen.getByRole("region", { name: "Notifications" })).toHaveTextContent(
      "Submitting report",
    );
    await act(async () =>
      resolve(new Response(JSON.stringify({ data: { id: REPORT_ID }, meta: {} }), { status: 201 })),
    );
    expect(await screen.findByRole("status", { name: "Report submitted" })).toHaveTextContent(
      "Status unavailable",
    );
  });
  it("preserves input after a failed submission and permits retry", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    await loadedForm();
    const user = await fillRequired();
    await user.click(screen.getByRole("button", { name: "Submit report" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check the reports list before retrying",
    );
    expect(
      screen.getByRole("link", { name: "Check the reports list before retrying" }),
    ).toHaveAttribute("href", "/barriers");
    expect(screen.getByLabelText("Description")).toHaveValue("Fictional blocked walkway");
    await user.click(screen.getByRole("button", { name: "Submit report" }));
    expect(await screen.findByRole("status", { name: "Report submitted" })).toBeInTheDocument();
  });
  it("selects coordinates on map click or with the keyboard center control", async () => {
    const { map } = await loadedForm();
    act(() => map.emit("click", { lngLat: { lat: 37.5, lng: -122 } }));
    expect(screen.getByLabelText("Latitude")).toHaveValue("37.500000");
    expect(screen.getByLabelText("Longitude")).toHaveValue("-122.000000");
    const user = userEvent.setup();
    screen.getByRole("button", { name: "Use map center" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("Latitude")).toHaveValue("37.548500");
    expect(screen.getByRole("img", { name: "Selected report location" })).toBeInTheDocument();
  });
  it("keeps coordinates usable when WebGL fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fakeMapControl.throwOnCreate = true;
    render(<ReportForm />);
    expect(await screen.findByText(/Enter coordinates using the fields/)).toBeInTheDocument();
    const user = await fillRequired();
    await user.click(screen.getByRole("button", { name: "Submit report" }));
    expect(screen.getByRole("status", { name: "Report submitted" })).toBeInTheDocument();
    vi.restoreAllMocks();
  });
  it("previews and removes a valid local photo and revokes its URL", async () => {
    const { unmount } = await loadedForm();
    const user = userEvent.setup();
    await user.upload(
      screen.getByLabelText("Photo (optional)"),
      new File(["photo"], "walkway.png", { type: "image/png" }),
    );
    expect(screen.getByAltText("Preview of selected photo")).toHaveAttribute(
      "src",
      "blob:local-preview",
    );
    await user.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(screen.queryByAltText("Preview of selected photo")).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local-preview");
    await user.upload(
      screen.getByLabelText("Photo (optional)"),
      new File(["another"], "another.png", { type: "image/png" }),
    );
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
  it("lists the photo as an optional checklist item outside the ready count", async () => {
    await loadedForm();
    const user = userEvent.setup();
    const checklist = screen.getByRole("navigation", { name: "Report checklist" });
    const photoItem = within(checklist).getByRole("button", { name: /Photo \(optional\)/ });
    expect(checklist).toHaveTextContent("0 of 4 ready");
    expect(photoItem).toHaveAccessibleName("Photo (optional), not added");
    await user.upload(
      screen.getByLabelText("Photo (optional)"),
      new File(["photo"], "walkway.png", { type: "image/png" }),
    );
    expect(photoItem).toHaveAccessibleName("Photo (optional), added");
    expect(checklist).toHaveTextContent("0 of 4 ready");
    await user.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(photoItem).toHaveAccessibleName("Photo (optional), not added");
  });
  it("blocks invalid photos and allows correction without losing other fields", async () => {
    await loadedForm();
    const user = await fillRequired();
    const photo = screen.getByLabelText("Photo (optional)");
    fireEvent.change(photo, {
      target: { files: [new File(["bad"], "bad.svg", { type: "image/svg+xml" })] },
    });
    expect(photo).toHaveAttribute("aria-invalid", "true");
    await user.click(screen.getByRole("button", { name: "Submit report" }));
    expect(screen.queryByRole("status", { name: "Report submitted" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toHaveValue("Fictional blocked walkway");
    await user.click(screen.getByRole("button", { name: "Remove photo" }));
    await user.click(screen.getByRole("button", { name: "Submit report" }));
    expect(screen.getByRole("status", { name: "Report submitted" })).toBeInTheDocument();
  });
  it("rejects oversized files and image decode failures", async () => {
    await loadedForm();
    const photo = screen.getByLabelText("Photo (optional)");
    fireEvent.change(photo, {
      target: {
        files: [
          new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], "large.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    expect(screen.getByText(/Choose a photo no larger than 5 MiB/)).toBeInTheDocument();
    fireEvent.change(photo, {
      target: { files: [new File(["not an image"], "broken.jpg", { type: "image/jpeg" })] },
    });
    fireEvent.error(screen.getByAltText("Preview of selected photo"));
    expect(screen.getByText(/could not be opened as a photo/)).toBeInTheDocument();
  });
  it("has no detectable axe violations before or after validation", async () => {
    const { container } = await loadedForm();
    expect(await axeViolations(container)).toEqual([]);
    await userEvent.setup().click(screen.getByRole("button", { name: "Submit report" }));
    expect(await axeViolations(container)).toEqual([]);
  });
  it("has no detectable axe violations with the success state and toast visible", async () => {
    const { container } = await loadedForm();
    const user = await fillRequired();
    await user.click(screen.getByRole("button", { name: "Submit report" }));
    await screen.findByRole("status", { name: "Report submitted" });
    expect(await axeViolations(container)).toEqual([]);
  });
  it("names checklist steps in one phrase and points to the next unfinished step", async () => {
    await loadedForm();
    const user = userEvent.setup();
    const checklist = screen.getByRole("navigation", { name: "Report checklist" });
    expect(
      within(checklist).getByRole("button", { name: "Barrier type, not done yet" }),
    ).toBeInTheDocument();
    expect(screen.getByText("0 of 4 ready.")).toHaveAttribute("aria-live", "polite");
    await user.click(screen.getByRole("radio", { name: "Obstruction" }));
    const typeItem = within(checklist).getByRole("button", { name: "Barrier type, done" });
    expect(typeItem).toHaveTextContent("Done");
    expect(screen.getByText("1 of 4 ready.")).toBeInTheDocument();
    const next = screen.getByRole("link", { name: "Next: Description" });
    expect(screen.getByLabelText("Description")).not.toHaveFocus();
    await user.click(next);
    expect(screen.getByLabelText("Description")).toHaveFocus();
  });
  it("says Ready to submit once all four steps are done, in reverse order", async () => {
    await loadedForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Latitude"), "37.5485");
    await user.type(screen.getByLabelText("Longitude"), "-121.9886");
    await user.click(
      within(screen.getByRole("group", { name: "Severity (1–5)" })).getByRole("radio", {
        name: "3",
      }),
    );
    await user.type(screen.getByLabelText("Description"), "Fictional blocked walkway");
    await user.click(screen.getByRole("radio", { name: "Obstruction" }));
    expect(screen.getByText("4 of 4 ready. Ready to submit.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Next:/ })).not.toBeInTheDocument();
  });
  it("lists two missing steps and turns each green once it is fixed", async () => {
    await loadedForm();
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "Obstruction" }));
    await user.type(screen.getByLabelText("Description"), "Fictional blocked walkway");
    await user.click(screen.getByRole("button", { name: "Submit report" }));
    const summary = screen.getByRole("group", { name: "Please correct your report" });
    expect(summary).toHaveTextContent("2 of 2 steps need attention.");
    expect(within(summary).getAllByText("Not done yet")).toHaveLength(2);
    await user.type(screen.getByLabelText("Latitude"), "37.5485");
    await user.type(screen.getByLabelText("Longitude"), "-121.9886");
    expect(summary).toHaveTextContent("1 of 2 steps need attention.");
    expect(within(summary).getByText("Done")).toBeInTheDocument();
    await user.click(
      within(screen.getByRole("group", { name: "Severity (1–5)" })).getByRole("radio", {
        name: "2",
      }),
    );
    expect(summary).toHaveTextContent("All steps fixed. Submit the report again.");
  });
  it("shows pending-verification success copy without claiming a fix", async () => {
    await loadedForm();
    const user = await fillRequired();
    await user.click(screen.getByRole("button", { name: "Submit report" }));
    const notifications = screen.getByRole("region", { name: "Notifications" });
    await waitFor(() => expect(notifications).toHaveTextContent("Report submitted"));
    expect(notifications).toHaveTextContent("It is pending verification by a reviewer.");
    expect(notifications).not.toHaveTextContent(/fixed|verified|safe/i);
    expect(screen.getByRole("heading", { name: "Report submitted" })).toHaveFocus();
    expect(within(notifications).queryByRole("button", { name: /undo/i })).toBeNull();
  });
  it("offers Retry in the toast after a failure and submits again", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    await loadedForm();
    const user = await fillRequired();
    await user.click(screen.getByRole("button", { name: "Submit report" }));
    const notifications = screen.getByRole("region", { name: "Notifications" });
    await waitFor(() => expect(notifications).toHaveTextContent("Report not submitted"));
    await user.click(within(notifications).getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("status", { name: "Report submitted" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
