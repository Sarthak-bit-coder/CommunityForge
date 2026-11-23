import { describe, expect, test } from "vitest";
import { type GestureInput, crossedStage, decideGesture } from "./step-gesture";

const LOCKED_IN: GestureInput = {
  y: 1000,
  stageTop: 1000,
  direction: 1,
  distance: 100,
  index: 0,
  count: 3,
  isGestureSpent: false,
  isLocked: false,
};

describe("decideGesture", () => {
  test("lets the page scroll while the stage is still far below", () => {
    // Arrange
    const input = { ...LOCKED_IN, y: 500 };

    // Act
    const action = decideGesture(input);

    // Assert
    expect(action).toEqual({ kind: "pass" });
  });

  test("locks the stage in when a scroll would carry the page past it", () => {
    // Arrange
    const input = { ...LOCKED_IN, y: 950, distance: 400 };

    // Act
    const action = decideGesture(input);

    // Assert
    expect(action).toEqual({ kind: "engage" });
  });

  test("plays exactly one step for a small scroll and for a huge one", () => {
    // Arrange
    const small = { ...LOCKED_IN, distance: 4 };
    const huge = { ...LOCKED_IN, distance: 5000 };

    // Act & Assert
    expect(decideGesture(small)).toEqual({ kind: "step", index: 1 });
    expect(decideGesture(huge)).toEqual({ kind: "step", index: 1 });
  });

  test("ignores the momentum of a gesture that already played a step", () => {
    // Arrange
    const input = { ...LOCKED_IN, index: 1, isGestureSpent: true };

    // Act
    const action = decideGesture(input);

    // Assert
    expect(action).toEqual({ kind: "swallow" });
  });

  test("holds new gestures while a step is still settling", () => {
    // Arrange
    const input = { ...LOCKED_IN, isLocked: true };

    // Act
    const action = decideGesture(input);

    // Assert
    expect(action).toEqual({ kind: "swallow" });
  });

  test("rewinds one step when scrolling up", () => {
    // Arrange
    const input = { ...LOCKED_IN, index: 2, direction: -1 as const };

    // Act
    const action = decideGesture(input);

    // Assert
    expect(action).toEqual({ kind: "step", index: 1 });
  });

  test("releases the page after the last step, but only on a fresh gesture", () => {
    // Arrange
    const fresh = { ...LOCKED_IN, index: 2 };
    const momentum = { ...fresh, isGestureSpent: true };

    // Act & Assert
    expect(decideGesture(fresh)).toEqual({ kind: "pass" });
    expect(decideGesture(momentum)).toEqual({ kind: "swallow" });
  });

  test("releases the page above the first step when scrolling up", () => {
    // Arrange
    const input = { ...LOCKED_IN, direction: -1 as const };

    // Act
    const action = decideGesture(input);

    // Assert
    expect(action).toEqual({ kind: "pass" });
  });

  test("locks in from below even when the story never started, so it is never skipped", () => {
    // Arrange: e.g. the browser restored the scroll position below the story on reload.
    const input = { ...LOCKED_IN, y: 1050, direction: -1 as const, index: 0 };

    // Act
    const action = decideGesture(input);

    // Assert
    expect(action).toEqual({ kind: "engage" });
  });

  test("does not release the page while the last step is still playing", () => {
    // Arrange
    const input = { ...LOCKED_IN, index: 2, isLocked: true };

    // Act
    const action = decideGesture(input);

    // Assert
    expect(action).toEqual({ kind: "swallow" });
  });
});

describe("decideGesture coming back up into a story in progress", () => {
  // A story already played through never gets here: useStepScroll stops asking once it is left.
  test("locks back in when scrolling up across the story", () => {
    // Arrange
    const input = { ...LOCKED_IN, y: 1300, direction: -1 as const, distance: 500, index: 2 };

    // Act
    const action = decideGesture(input);

    // Assert
    expect(action).toEqual({ kind: "engage" });
  });

  test("steps back through the story once locked in again", () => {
    // Arrange
    const input = { ...LOCKED_IN, index: 2, direction: -1 as const };

    // Act
    const action = decideGesture(input);

    // Assert
    expect(action).toEqual({ kind: "step", index: 1 });
  });
});

describe("crossedStage", () => {
  test("locks when a scroll overshoots the stage on the way down", () => {
    // Arrange, Act & Assert
    expect(crossedStage(1400, 1900, 1550)).toBe(true);
  });

  test("ignores scrolling that stays above the stage", () => {
    // Arrange, Act & Assert
    expect(crossedStage(1200, 1500, 1550)).toBe(false);
  });

  test("does not re-lock when leaving downward from the locked position", () => {
    // Arrange, Act & Assert
    expect(crossedStage(1550, 1700, 1550)).toBe(false);
  });

  test("locks when a scroll crosses the stage on the way back up", () => {
    // Arrange, Act & Assert
    expect(crossedStage(1800, 1400, 1550)).toBe(true);
  });
});
