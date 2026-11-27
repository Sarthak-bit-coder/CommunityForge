"use client";

import { m, useScroll, useSpring } from "motion/react";
import { MOTION_SPRING } from "./motion-tokens";

// A thin progress rule, not decorative movement: it shows where the reader is on the page.
// Scale only (compositor-friendly), smoothed with a spring. Hidden from assistive tech.
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, MOTION_SPRING);
  return (
    <m.div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-40 h-0.5 origin-left bg-accent"
      style={{ scaleX }}
    />
  );
}
