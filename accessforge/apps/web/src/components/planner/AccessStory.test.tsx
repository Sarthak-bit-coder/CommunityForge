import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock factories are hoisted above the imports, so their shared pieces are hoisted too.
const { goTo, dispose, startParticleScene, picture, blank } = vi.hoisted(() => {
  const goTo = vi.fn<(index: number) => Promise<void>>(() => Promise.resolve());
  const dispose = vi.fn();
  // A plain flag, not a vi.fn: vitest reports errors thrown by mocks even when code catches them.
  const picture = { shouldFail: false };
  const blank = () => {
    if (picture.shouldFail) throw new Error("No canvas");
    return document.createElement("canvas");
  };
  return {
    goTo,
    dispose,
    startParticleScene: vi.fn(() => Promise.resolve({ goTo, dispose })),
    picture,
    blank,
  };
});
vi.mock("./particle-scene", () => ({ startParticleScene }));
// The real map needs WebGL; a stand-in is enough to see when the story shows it.
vi.mock("@/components/home/HomeMapPreview", () => ({
  HomeMapPreview: () => <div data-testid="live-map" />,
}));
vi.mock("./story-pictures", () => ({
  drawTripScene: blank,
  drawBlockedScene: blank,
  drawRepairScene: blank,
  drawOpenScene: blank,
}));

import { AccessStory } from "./AccessStory";

const STREETS = {
  lines: [
    [
      [-121.98, 37.55],
      [-121.97, 37.56],
    ],
  ],
  attribution: ["ODbL 1.0, © OpenStreetMap contributors"],
};

// One key press is one gesture. The stage sits at the top of jsdom's view, so it is locked in.
const scrollOnce = () => fireEvent.keyDown(window, { key: "ArrowDown" });

const currentPart = () =>
  screen.getAllByRole("listitem").find((item) => item.getAttribute("aria-current") === "step");

async function renderReadyStory() {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: STREETS })));
  const view = render(<AccessStory />);
  await waitFor(() => expect(startParticleScene).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  return view;
}

describe("AccessStory", () => {
  beforeEach(() => {
    goTo.mockReset();
    goTo.mockImplementation(() => Promise.resolve());
    dispose.mockClear();
    startParticleScene.mockClear();
    picture.shouldFail = false;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("plays one part of the story for each scroll", async () => {
    // Arrange
    const { unmount } = await renderReadyStory();

    // Act
    scrollOnce();

    // Assert
    await waitFor(() => expect(goTo).toHaveBeenLastCalledWith(1));
    expect(goTo).toHaveBeenCalledTimes(1);
    expect(currentPart()).toHaveTextContent(/curb stops it/i);
    unmount();
    expect(dispose).toHaveBeenCalled();
  });

  it("ignores scrolls while a part is still playing, then moves on once it finishes", async () => {
    // Arrange: the first morph stays in progress until the test finishes it.
    let finishMorph: () => void = () => {};
    goTo.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishMorph = resolve;
        }),
    );
    await renderReadyStory();

    // Act: a second scroll arrives while the first part is still playing.
    scrollOnce();
    await waitFor(() => expect(goTo).toHaveBeenCalledWith(1));
    scrollOnce();

    // Assert: it was not skipped ahead.
    expect(goTo).toHaveBeenCalledTimes(1);
    expect(currentPart()).toHaveTextContent(/curb stops it/i);

    // Act: the first part finishes, and the visitor scrolls again.
    await act(async () => finishMorph());
    scrollOnce();

    // Assert
    await waitFor(() => expect(goTo).toHaveBeenLastCalledWith(2));
    expect(currentPart()).toHaveTextContent(/ranked first/i);
  });

  it("goes straight to the live map for the last part, with no picture shown first", async () => {
    // Arrange: play the four picture parts.
    await renderReadyStory();
    for (const part of [1, 2, 3]) {
      scrollOnce();
      await waitFor(() => expect(goTo).toHaveBeenLastCalledWith(part));
    }
    expect(screen.queryByTestId("live-map")).not.toBeInTheDocument();

    // Act
    scrollOnce();

    // Assert: the map shows at once, and the particles were not asked to form another picture.
    expect(await screen.findByTestId("live-map")).toBeInTheDocument();
    expect(goTo).toHaveBeenCalledTimes(3);
  });

  it("tells the whole story as text, so no part is hidden behind the animation", async () => {
    // Arrange
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 503 }));

    // Act
    render(<AccessStory />);

    // Assert
    expect(screen.getAllByText(/appointment at Washington Hospital/i)).not.toHaveLength(0);
    expect(screen.getByText(/ranks this ramp first/i)).toBeInTheDocument();
    expect(screen.getByText(/pilot area the planner works on/i)).toBeInTheDocument();
  });

  it("tells the story in text, rather than breaking, when the 3D scene cannot start", async () => {
    // Arrange
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: STREETS })),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    picture.shouldFail = true;

    // Act
    render(<AccessStory />);

    // Assert
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/cannot show the animated story/i),
    );
    expect(screen.getAllByText(/appointment at Washington Hospital/i)).not.toHaveLength(0);
  });
});
