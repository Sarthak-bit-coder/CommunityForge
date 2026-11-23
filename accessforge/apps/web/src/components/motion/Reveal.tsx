"use client";

import { m } from "motion/react";
import type { ReactNode } from "react";
import {
  MOTION_DURATION_S,
  MOTION_EASE_ENTER,
  MOTION_OFFSET_PX,
  MOTION_VIEWPORT_AMOUNT,
} from "./motion-tokens";

type RevealProps = {
  readonly children: ReactNode;
  readonly delay?: number;
  readonly className?: string;
};

// Fades in once when scrolled into view. The transform is dropped under reduced motion.
export function Reveal({ children, delay = 0, className }: RevealProps) {
  return (
    <m.div
      // The no-JavaScript fallback in app/layout.tsx shows anything carrying this attribute.
      data-reveal=""
      className={className}
      initial={{ opacity: 0, y: MOTION_OFFSET_PX }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: MOTION_VIEWPORT_AMOUNT }}
      transition={{ duration: MOTION_DURATION_S.slow, ease: MOTION_EASE_ENTER, delay }}
    >
      {children}
    </m.div>
  );
}
