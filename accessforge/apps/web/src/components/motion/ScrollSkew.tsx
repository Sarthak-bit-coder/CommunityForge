"use client";

import { m, useScroll, useSpring, useTransform, useVelocity } from "motion/react";
import type { ReactNode } from "react";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

// Large headings lean a little with scroll speed and settle when the page stops.
const MAX_SPEED_PX_S = 3000;
const MAX_SKEW_DEG = 3;
const SETTLE_SPRING = { stiffness: 260, damping: 40, mass: 0.6 } as const;

export function ScrollSkew({ children }: { readonly children: ReactNode }) {
  const prefersReduced = usePrefersReducedMotion();
  const { scrollY } = useScroll();
  const speed = useVelocity(scrollY);
  const skew = useTransform(
    speed,
    [-MAX_SPEED_PX_S, MAX_SPEED_PX_S],
    [MAX_SKEW_DEG, -MAX_SKEW_DEG],
    { clamp: true },
  );
  const skewY = useSpring(skew, SETTLE_SPRING);

  if (prefersReduced) return <div>{children}</div>;
  return (
    <m.div className="origin-left" style={{ skewY }}>
      {children}
    </m.div>
  );
}
