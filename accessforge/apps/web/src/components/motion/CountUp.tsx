"use client";

import { animate, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { MOTION_DURATION_S, MOTION_EASE_ENTER } from "./motion-tokens";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

type CountUpProps = {
  readonly value: number;
  readonly format?: (value: number) => string;
};

const defaultFormat = (value: number) => Math.round(value).toLocaleString("en-US");

// Counts up from zero the first time the number scrolls into view. Assistive tech reads only the
// final value; the moving digits are hidden from it. Reduced motion shows the final value at once.
export function CountUp({ value, format = defaultFormat }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const reduceMotion = usePrefersReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (reduceMotion || !isInView) return;
    const controls = animate(0, value, {
      duration: MOTION_DURATION_S.slow,
      ease: MOTION_EASE_ENTER,
      onUpdate: setShown,
    });
    return () => controls.stop();
  }, [isInView, reduceMotion, value]);

  return (
    <span ref={ref}>
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden="true">{format(reduceMotion ? value : shown)}</span>
    </span>
  );
}
