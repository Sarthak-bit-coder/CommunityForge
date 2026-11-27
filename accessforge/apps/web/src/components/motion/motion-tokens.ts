// One timing vocabulary for the whole app. Transform and opacity only in animations.
// Durations stay within 150–600ms. Anything that answers a click, key, or hover uses
// `interactive` or less, so nobody waits on motion and every animation can be interrupted.
export const MOTION_DURATION_S = { fast: 0.15, interactive: 0.3, slow: 0.6 } as const;
/** Entrances: quick start, long settle. */
export const MOTION_EASE_ENTER = [0.16, 1, 0.3, 1] as const;
/** Exits: accelerate away, so leaving content gets out of the way. */
export const MOTION_EASE_EXIT = [0.7, 0, 0.84, 0] as const;
/** Hover and press feedback: direct, no overshoot. */
export const MOTION_EASE_PRESS = [0.2, 0, 0, 1] as const;
export const MOTION_STAGGER_S = 0.08;
export const MOTION_OFFSET_PX = 16;
export const MOTION_VIEWPORT_AMOUNT = 0.2;
// Layout moves (sliding pills, resizing boxes): no bounce, settled within the interactive limit.
export const MOTION_SPRING = {
  type: "spring",
  visualDuration: MOTION_DURATION_S.interactive,
  bounce: 0,
} as const;
export const MOTION_PRESS_TRANSITION = {
  duration: MOTION_DURATION_S.fast,
  ease: MOTION_EASE_PRESS,
} as const;
export const MOTION_EXIT_TRANSITION = {
  duration: MOTION_DURATION_S.fast,
  ease: MOTION_EASE_EXIT,
} as const;
