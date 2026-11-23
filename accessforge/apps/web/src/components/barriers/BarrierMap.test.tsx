import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FREMONT_CENTER, OPENFREEMAP_STYLE_URL } from "@/lib/basemap";
import { SAMPLE_BARRIERS } from "@/lib/sample-barriers";
import { fakeMapControl, resetFakeMaplibre } from "@/test/fake-maplibre";
import { BarrierMap } from "./BarrierMap";

vi.mock("maplibre-gl", () => import("@/test/fake-maplibre"));

const [FIRST, SECOND] = SAMPLE_BARRIERS;

// Barrier markers, as opposed to the key's place-type switches.
function markerButtons(): HTMLElement[] {
  return screen.getAllByRole("button").filter((button) => button.hasAttribute("data-barrier-id"));
}

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

const PILOT_STREETS = {
  lines: [
    [
      [-121.98, 37.55],
      [-121.97, 37.56],
    ],
  ],
  attribution: ["ODbL 1.0, © OpenStreetMap contributors"],
  truncated: false,
};

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
    expect(markerButtons()).toHaveLength(SAMPLE_BARRIERS.length);
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
    // Styling must keep MapLibre's positioning class, or the pin drifts off its location.
    expect(marker).toHaveClass("maplibregl-marker");
    expect(map.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [FIRST.location.lng, FIRST.location.lat] }),
    );
  });

  it("shows a fallback message when the map cannot be created", async () => {
    fakeMapControl.throwOnCreate = true;

    render(<BarrierMap barriers={SAMPLE_BARRIERS} selectedId={null} onSelect={() => {}} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The map could not be loaded. Every barrier is still available in the list.",
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

  it("loads a real OpenStreetMap basemap centred on Fremont and says roads are not verified", async () => {
    render(<BarrierMap barriers={[]} selectedId={null} onSelect={() => {}} />);
    const map = await createdMap();

    expect(map.options.style).toBe(OPENFREEMAP_STYLE_URL);
    expect(map.options.center).toEqual([FREMONT_CENTER.lng, FREMONT_CENTER.lat]);
    expect(screen.getByText(/OpenStreetMap data via OpenFreeMap/)).toHaveTextContent(
      "mapped paths are not verified accessible routes.",
    );
  });

  it("keeps the map and markers usable when some tiles fail after loading", async () => {
    render(<BarrierMap barriers={SAMPLE_BARRIERS} selectedId={null} onSelect={() => {}} />);
    const map = await createdMap();
    act(() => map.emit("load"));

    act(() => map.emit("error", { error: new Error("tile 404") }));

    expect(screen.getByText(/Some map tiles failed to load/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(map.isRemoved).toBe(false);
    expect(markerButtons()).toHaveLength(SAMPLE_BARRIERS.length);
  });

  it("frames the markers when there are barriers", async () => {
    render(<BarrierMap barriers={[FIRST, SECOND]} selectedId={null} onSelect={() => {}} />);
    const map = await createdMap();

    act(() => map.emit("load"));

    expect(map.fitBounds).toHaveBeenCalledWith(
      [
        [
          Math.min(FIRST.location.lng, SECOND.location.lng),
          Math.min(FIRST.location.lat, SECOND.location.lat),
        ],
        [
          Math.max(FIRST.location.lng, SECOND.location.lng),
          Math.max(FIRST.location.lat, SECOND.location.lat),
        ],
      ],
      expect.objectContaining({ animate: false }),
    );
  });

  it("frames the map on the pilot network without drawing its lines", async () => {
    const streets = {
      lines: [
        [
          [-121.98, 37.55],
          [-121.97, 37.56],
        ],
      ],
      attribution: ["ODbL 1.0, © OpenStreetMap contributors"],
      truncated: false,
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: streets })),
    );
    render(<BarrierMap barriers={[]} selectedId={null} onSelect={() => {}} />);
    const map = await createdMap();
    act(() => map.emit("load"));

    await waitFor(() => expect(map.fitBounds).toHaveBeenCalled());
    expect(map.addLayer).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "line" }),
      expect.anything(),
    );
    expect(map.fitBounds).toHaveBeenCalledWith(
      [
        [-121.98, 37.55],
        [-121.97, 37.56],
      ],
      { animate: false },
    );
    // Panning stays on the pilot network, padded so edge streets are not on the border.
    const [[west, south], [east, north]] = map.setMaxBounds.mock.calls[0][0];
    expect(west).toBeLessThan(-121.98);
    expect(south).toBeLessThan(37.55);
    expect(east).toBeGreaterThan(-121.97);
    expect(north).toBeGreaterThan(37.56);
  });

  it("leaves the view alone when no pilot network is loaded", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { lines: [], attribution: [] } })),
    );
    render(<BarrierMap barriers={[]} selectedId={null} onSelect={() => {}} />);
    const map = await createdMap();
    act(() => map.emit("load"));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/network/streets", expect.anything()),
    );
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.setMaxBounds).not.toHaveBeenCalled();
  });

  it("keeps the report location picker on the pilot area, including the picked spot", async () => {
    // Arrange
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: PILOT_STREETS })),
    );
    const picked = { lng: -121.95, lat: 37.58 };
    render(
      <BarrierMap
        barriers={[]}
        selectedId={null}
        onSelect={() => {}}
        onLocationSelect={() => {}}
        location={picked}
      />,
    );
    const map = await createdMap();

    // Act
    act(() => map.emit("load"));

    // Assert
    await waitFor(() => expect(map.setMaxBounds).toHaveBeenCalled());
    const [[west, south], [east, north]] = map.setMaxBounds.mock.calls[0][0];
    expect(west).toBeLessThan(-121.98);
    expect(south).toBeLessThan(37.55);
    expect(east).toBeGreaterThan(picked.lng);
    expect(north).toBeGreaterThan(picked.lat);
  });

  it("locks the home flyover to the pilot area only once the camera lands", async () => {
    // Arrange
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: PILOT_STREETS })),
    );
    render(<BarrierMap barriers={[]} selectedId={null} onSelect={() => {}} isFlyover />);
    const map = await createdMap();
    map.isMoving.mockReturnValue(true);

    // Act
    act(() => map.emit("load"));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/network/streets", expect.anything()),
    );

    // Assert: no clamp mid-flight, a lock after it, and the flyover keeps its own framing.
    expect(map.setMaxBounds).not.toHaveBeenCalled();
    act(() => map.emit("moveend"));
    await waitFor(() => expect(map.setMaxBounds).toHaveBeenCalled());
    expect(map.fitBounds).not.toHaveBeenCalled();
  });
});

describe("BarrierMap cityscape", () => {
  it("tilts browsing maps and gives them sky, light, and buildings", async () => {
    // Arrange
    render(<BarrierMap barriers={[]} selectedId={null} onSelect={() => {}} />);
    const map = await createdMap();

    // Act
    act(() => map.emit("style.load"));

    // Assert
    expect(map.options).toEqual(expect.objectContaining({ pitch: 50 }));
    expect(map.setSky).toHaveBeenCalledOnce();
    expect(map.setLight).toHaveBeenCalledOnce();
  });

  it("keeps the location picker top-down so a tap lands where it looks", async () => {
    // Arrange
    render(
      <BarrierMap
        barriers={[]}
        selectedId={null}
        onSelect={() => {}}
        onLocationSelect={() => {}}
      />,
    );
    const map = await createdMap();

    // Act
    act(() => map.emit("style.load"));

    // Assert
    expect(map.options).not.toHaveProperty("pitch");
    expect(map.setSky).toHaveBeenCalledOnce();
  });

  it("keys every map layer, and the barrier reach only where barriers can be selected", async () => {
    // Arrange & Act
    const { rerender } = render(<BarrierMap barriers={[]} selectedId={null} onSelect={() => {}} />);
    await createdMap();
    const key = () => screen.getByRole("list", { name: "Map key" });

    // Assert
    expect(key()).toHaveTextContent("Footpath");
    expect(key()).toHaveTextContent("Stairs, not step-free");
    expect(key()).toHaveTextContent("Other buildings");
    expect(screen.getByRole("list", { name: "Place types on the map" })).toHaveTextContent(
      "Healthcare",
    );
    expect(key()).toHaveTextContent("Footpaths within 200 m of the selected barrier");

    rerender(
      <BarrierMap
        barriers={[]}
        selectedId={null}
        onSelect={() => {}}
        onLocationSelect={() => {}}
      />,
    );
    expect(key()).not.toHaveTextContent("within 200 m");
  });
});

describe("BarrierMap flyover", () => {
  const BUILDINGS = { id: "building", source: "openmaptiles", "source-layer": "building" };

  it("opens on the overview and flies to a tilted street view", async () => {
    // Arrange
    render(
      <BarrierMap barriers={SAMPLE_BARRIERS} selectedId={null} onSelect={() => {}} isFlyover />,
    );
    const map = await createdMap();

    // Act
    act(() => map.emit("load"));

    // Assert
    // The map is created at the camera's start, so no tiles load for a view it leaves at once.
    expect(map.options).toEqual(expect.objectContaining({ pitch: 0, zoom: 11.5 }));
    expect(map.jumpTo).not.toHaveBeenCalled();
    expect(map.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [FREMONT_CENTER.lng, FREMONT_CENTER.lat], pitch: 70 }),
    );
    expect(map.fitBounds).not.toHaveBeenCalled();
  });

  it("adds sky, light, and rising buildings as soon as the style loads", async () => {
    // Arrange
    render(<BarrierMap barriers={[]} selectedId={null} onSelect={() => {}} isFlyover />);
    const map = await createdMap();
    map.styleLayers = [BUILDINGS, { id: "place_label", type: "symbol" }];

    // Act
    act(() => map.emit("style.load"));

    // Assert
    expect(map.setSky).toHaveBeenCalledOnce();
    expect(map.setLight).toHaveBeenCalledOnce();
    // Stairs block wheelchairs, so they are drawn apart from footpaths, dashed.
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "af-steps",
        paint: expect.objectContaining({ "line-dasharray": [1, 0.8] }),
      }),
      "af-buildings-3d",
    );
    // Buildings sit beneath the basemap labels, so a place name is never hidden.
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ type: "fill-extrusion", source: "openmaptiles" }),
      "place_label",
    );
    // Height rises with zoom on the GPU; per-frame paint updates would reload every tile.
    const [layer] = map.addLayer.mock.calls[0];
    expect(layer.paint["fill-extrusion-height"].slice(0, 3)).toEqual([
      "interpolate",
      ["linear"],
      ["zoom"],
    ]);
    expect(map.setPaintProperty).not.toHaveBeenCalled();
  });

  it("skips 3D buildings when the basemap has no building footprints", async () => {
    // Arrange
    render(<BarrierMap barriers={[]} selectedId={null} onSelect={() => {}} isFlyover />);
    const map = await createdMap();

    // Act
    act(() => {
      map.emit("style.load");
      map.emit("load");
    });

    // Assert
    expect(map.addLayer).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "fill-extrusion" }),
    );
    expect(map.flyTo).toHaveBeenCalled();
  });

  it("opens straight on the final 3D view under reduced motion", async () => {
    // Arrange
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") }));
    render(<BarrierMap barriers={[]} selectedId={null} onSelect={() => {}} isFlyover />);
    const map = await createdMap();

    // Act
    act(() => map.emit("load"));

    // Assert
    expect(map.flyTo).not.toHaveBeenCalled();
    expect(map.options).toEqual(expect.objectContaining({ pitch: 70, zoom: 15.6 }));
    vi.unstubAllGlobals();
  });
});
