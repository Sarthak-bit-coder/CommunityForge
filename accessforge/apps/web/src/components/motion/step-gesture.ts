// Decides what one scroll input does to the pinned repair story. Pure, so it can be tested
// without a browser. The story locks when its stage reaches the top of the view; then each
// separate gesture plays one step, and a gesture past either end lets the page scroll on.

/** Scroll positions within this many pixels of the stage top count as locked in. */
export const ALIGN_PX = 2;

export type GestureInput = {
  /** Current page scroll offset. */
  readonly y: number;
  /** Page offset at which the stage fills the view. */
  readonly stageTop: number;
  readonly direction: 1 | -1;
  /** How far this input would scroll the page, in pixels. */
  readonly distance: number;
  readonly index: number;
  readonly count: number;
  /** This gesture (a wheel burst with its momentum, or one key press) already acted. */
  readonly isGestureSpent: boolean;
  /** A step is still settling, so new gestures wait. */
  readonly isLocked: boolean;
};

export type GestureAction =
  | { readonly kind: "pass" } // let the page scroll
  | { readonly kind: "engage" } // snap the stage into place; the input itself plays nothing
  | { readonly kind: "swallow" } // hold the page still, change nothing
  | { readonly kind: "step"; readonly index: number };

export function decideGesture(input: GestureInput): GestureAction {
  const { y, stageTop, direction, distance, index, count } = input;
  // Crossing the stage from either side always locks it in, so the story is never skipped.
  if (Math.abs(y - stageTop) > ALIGN_PX) {
    const crosses =
      direction === 1
        ? y < stageTop && y + distance >= stageTop
        : y > stageTop && y - distance <= stageTop;
    return crosses ? { kind: "engage" } : { kind: "pass" };
  }
  const next = index + direction;
  // Past either end, a fresh gesture lets the page scroll on, once the last step has settled.
  const isHeld = input.isGestureSpent || input.isLocked;
  if (next < 0 || next >= count) return isHeld ? { kind: "swallow" } : { kind: "pass" };
  if (isHeld) return { kind: "swallow" };
  return { kind: "step", index: next };
}

/**
 * Whether a scroll movement (from `previousY` to `y`) carried the page across the stage top in a
 * direction that should lock the story. Catches scrolls the wheel prediction missed, such as a
 * browser's animated wheel scrolling, where the page position lags behind the input.
 */
export function crossedStage(previousY: number, y: number, stageTop: number): boolean {
  const wentDown = previousY < stageTop - ALIGN_PX && y >= stageTop - ALIGN_PX;
  const wentUp = previousY > stageTop + ALIGN_PX && y <= stageTop + ALIGN_PX;
  return wentDown || wentUp;
}
