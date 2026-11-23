"use client";

import { m } from "motion/react";
import type { ReactNode } from "react";
import { MOTION_DURATION_S, MOTION_VIEWPORT_AMOUNT } from "@/components/motion/motion-tokens";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";

// Status badges land like a rubber stamp; each item's mark then draws itself.
// The "modeled" ≈ keeps a slow drift at rest so it reads as an estimate, never a measurement.
const STAMP_S = 0.45;
const DRAW_DELAY_S = 0.25;
const DRAW_STAGGER_S = 0.08;

export type StatusTone = "success" | "modeled" | "neutral";

export function StatusStamp({ children }: { readonly children: ReactNode }) {
  return (
    <m.span
      data-reveal=""
      className="inline-block"
      initial={{ opacity: 0, scale: 1.6, rotate: -8 }}
      whileInView={{ opacity: 1, scale: [1.6, 0.92, 1], rotate: [-8, 1, 0] }}
      viewport={{ once: true, amount: MOTION_VIEWPORT_AMOUNT }}
      transition={{
        duration: STAMP_S,
        ease: "easeOut",
        opacity: { duration: MOTION_DURATION_S.fast },
      }}
    >
      {children}
    </m.span>
  );
}

const MARK_PATHS: Record<StatusTone, readonly string[]> = {
  success: ["M3 8.5 L6.5 12 L13 4.5"],
  modeled: ["M2 6 Q5 3.5 8 6 T14 6", "M2 11 Q5 8.5 8 11 T14 11"],
  neutral: ["M8 2.5 A5.5 5.5 0 1 1 7.99 2.5"],
};

const MARK_CLASS: Record<StatusTone, string> = {
  success: "stroke-success",
  modeled: "stroke-modeled af-drift",
  neutral: "stroke-muted",
};

export function StatusMark({ tone, index }: { readonly tone: StatusTone; readonly index: number }) {
  const prefersReduced = usePrefersReducedMotion();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      className={`mt-[0.3em] size-4 shrink-0 ${MARK_CLASS[tone]}`}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {MARK_PATHS[tone].map((d) => (
        <m.path
          key={d}
          d={d}
          data-reveal=""
          initial={prefersReduced ? false : { pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{
            duration: MOTION_DURATION_S.slow,
            ease: "easeOut",
            delay: DRAW_DELAY_S + index * DRAW_STAGGER_S,
          }}
        />
      ))}
    </svg>
  );
}
