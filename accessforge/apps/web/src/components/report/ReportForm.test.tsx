import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { fakeMapControl, resetFakeMaplibre } from "@/test/fake-maplibre";
import { MAX_PHOTO_BYTES } from "@/lib/report";
import { ReportForm } from "./ReportForm";

vi.mock("maplibre-gl", () => import("@/test/fake-maplibre"));

beforeEach(() => {
  resetFakeMaplibre();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { id: "report-1" }, meta: {} }), { status: 201 }),
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
  await user.selectOptions(screen.getByLabelText("Barrier type"), "obstruction");
  await user.selectOptions(screen.getByLabelText("Severity (1–5)"), "3");
  await user.type(screen.getByLabelText("Description"), "Fictional blocked walkway");
  await user.type(screen.getByLabelText("Latitude"), "37.5485");
  await user.type(screen.getByLabelText("Longitude"), "-121.9886");
  return user;
}

describe("ReportForm", () => {
  it("focuses an accessible error summary and links to required fields", async () => {
    await loadedForm();
    await userEvent.setup().click(screen.getByRole("button", { name: "Submit report" }));
    const summary = screen.getByRole("alert", { name: "Please correct your report" });
    expect(summary).toHaveFocus();
    expect(screen.getByLabelText("Barrier type")).toHaveAttribute("aria-invalid", "true");
    await userEvent.setup().click(screen.getByRole("link", { name: "Choose a barrier type." }));
    expect(screen.getByLabelText("Barrier type")).toHaveFocus();
  });
  it("submits the API payload once and prevents repeat submission", async () => {
    await loadedForm();
    const user = await fillRequired();
    await user.dblClick(screen.getByRole("button", { name: "Submit report" }));
    expect(await screen.findByRole("status", { name: "Report submitted" })).toHaveTextContent(
      "saved with status Pending",
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
    expect(screen.getByRole("status")).toHaveTextContent("Submitting report…");
    await act(async () =>
      resolve(
        new Response(JSON.stringify({ data: { id: "test-report" }, meta: {} }), { status: 201 }),
      ),
    );
    expect(await screen.findByRole("status", { name: "Report submitted" })).toBeInTheDocument();
  });
  it("preserves input after a failed submission and permits retry", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    await loadedForm();
    const user = await fillRequired();
    await user.click(screen.getByRole("button", { name: "Submit report" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check the reports list before retrying",
    );
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
});
