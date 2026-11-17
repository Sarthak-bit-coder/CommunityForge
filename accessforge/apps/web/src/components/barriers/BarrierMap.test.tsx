import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_BARRIERS } from "@/lib/sample-barriers";
import { fakeMapControl, resetFakeMaplibre } from "@/test/fake-maplibre";
import { BarrierMap } from "./BarrierMap";

vi.mock("maplibre-gl", () => import("@/test/fake-maplibre"));

const [FIRST, SECOND] = SAMPLE_BARRIERS;

async function createdMap() {
  await waitFor(() => expect(fakeMapControl.instances).toHaveLength(1));
  return fakeMapControl.instances[0];
}

beforeEach(() => {
  resetFakeMaplibre();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BarrierMap", () => {
  it("announces loading until the map loads, then shows one labelled button per barrier", async () => {
    render(<BarrierMap barriers={SAMPLE_BARRIERS} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading map");

    const map = await createdMap();
    act(() => map.emit("load"));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /^Sample barrier 1\. Missing curb ramp\. Status: Verified/,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(SAMPLE_BARRIERS.length);
  });

  it("selects a barrier when its marker is activated with the keyboard", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<BarrierMap barriers={SAMPLE_BARRIERS} selectedId={null} onSelect={onSelect} />);
    const map = await createdMap();
    act(() => map.emit("load"));

    screen.getByRole("button", { name: new RegExp(`^${SECOND.name}\\.`) }).focus();
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith(SECOND.id);
  });

  it("marks the selected marker as pressed and centres the map on it", async () => {
    const { rerender } = render(
      <BarrierMap barriers={SAMPLE_BARRIERS} selectedId={null} onSelect={() => {}} />,
    );
    const map = await createdMap();
    act(() => map.emit("load"));

    rerender(<BarrierMap barriers={SAMPLE_BARRIERS} selectedId={FIRST.id} onSelect={() => {}} />);

    const marker = screen.getByRole("button", { name: new RegExp(`^${FIRST.name}\\.`) });
    expect(marker).toHaveAttribute("aria-pressed", "true");
    expect(map.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [FIRST.location.lng, FIRST.location.lat] }),
    );
  });

  it("shows a fallback message when the map cannot be created", async () => {
    fakeMapControl.throwOnCreate = true;

    render(<BarrierMap barriers={SAMPLE_BARRIERS} selectedId={null} onSelect={() => {}} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The map could not be loaded. Every barrier is still available in the list below.",
    );
    expect(console.error).toHaveBeenCalled();
  });

  it("shows a fallback message and removes the map when it errors before loading", async () => {
    render(<BarrierMap barriers={SAMPLE_BARRIERS} selectedId={null} onSelect={() => {}} />);
    const map = await createdMap();

    act(() => map.emit("error", { error: new Error("style failed") }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(map.isRemoved).toBe(true);
  });

  it("removes the map when unmounted", async () => {
    const { unmount } = render(
      <BarrierMap barriers={SAMPLE_BARRIERS} selectedId={null} onSelect={() => {}} />,
    );
    const map = await createdMap();

    unmount();

    expect(map.isRemoved).toBe(true);
  });
});
