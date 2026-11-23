"use client";

import { useReducedMotion } from "motion/react";

// MotionConfig reducedMotion="user" only drops transform and layout animation. Anything else
// (pathLength drawing, opacity sequences, anime.js) must check this and jump to its final state.
export function usePrefersReducedMotion(): boolean {
  return useReducedMotion() ?? false;
}
