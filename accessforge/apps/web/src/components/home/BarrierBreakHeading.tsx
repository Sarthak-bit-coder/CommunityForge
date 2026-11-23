"use client";

import { m, useInView } from "motion/react";
import { useRef } from "react";
import { MOTION_DURATION_S, MOTION_EASE_ENTER } from "@/components/motion/motion-tokens";

// A heading split by a missing curb ramp: once in view, a ramp tile fills the gap, the × turns
// into a ✓, and the gap narrows so the two halves of the sentence close together.
const WORD_STAGGER_S = 0.05;
const FIX_DELAY_S = 0.55;
const CLOSE_DELAY_S = FIX_DELAY_S + MOTION_DURATION_S.interactive;
const GAP_OPEN = "1.5em";
const GAP_CLOSED = "0.9em";
const VIEW_AMOUNT = 0.6;

type BarrierBreakHeadingProps = {
  readonly id: string;
  readonly before: string;
  readonly after: string;
  readonly className?: string;
};

export function BarrierBreakHeading({ id, before, after, className }: BarrierBreakHeadingProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const isInView = useInView(ref, { once: true, amount: VIEW_AMOUNT });
  const beforeWords = before.split(" ");
  const afterWords = after.split(" ");
  const state = isInView ? "shown" : "hidden";

  return (
    <h2 ref={ref} id={id} className={className}>
      <span className="sr-only">{`${before} ${after}`}</span>
      <span aria-hidden="true">
        {beforeWords.map((word, index) => (
          <Word key={`b${index}`} word={word} index={index} state={state} />
        ))}
        <RampTile state={state} />
        {afterWords.map((word, index) => (
          <Word key={`a${index}`} word={word} index={beforeWords.length + index} state={state} />
        ))}
      </span>
    </h2>
  );
}

type Shown = "hidden" | "shown";

function Word({ word, index, state }: { word: string; index: number; state: Shown }) {
  return (
    <span className="inline-block overflow-hidden pb-[0.12em] -mb-[0.12em] align-bottom">
      <m.span
        data-reveal=""
        className="inline-block"
        initial={{ y: "110%" }}
        animate={state === "shown" ? { y: "0%" } : { y: "110%" }}
        transition={{
          duration: MOTION_DURATION_S.slow,
          ease: MOTION_EASE_ENTER,
          delay: index * WORD_STAGGER_S,
        }}
      >
        {word}
      </m.span>
      {" "}
    </span>
  );
}

function RampTile({ state }: { state: Shown }) {
  const isShown = state === "shown";
  const swap = { duration: MOTION_DURATION_S.interactive, ease: MOTION_EASE_ENTER };
  return (
    <m.span
      data-reveal=""
      className="relative mr-[0.3em] inline-flex h-[0.8em] items-center justify-center rounded-[0.18em] align-baseline"
      initial={{ width: GAP_OPEN, backgroundColor: "var(--color-warning-soft)" }}
      animate={
        isShown
          ? { width: GAP_CLOSED, backgroundColor: "var(--color-marker)" }
          : { width: GAP_OPEN, backgroundColor: "var(--color-warning-soft)" }
      }
      transition={{
        width: { ...swap, delay: CLOSE_DELAY_S },
        backgroundColor: { ...swap, delay: FIX_DELAY_S },
      }}
    >
      <m.span
        className="absolute text-[0.55em] leading-none font-bold text-warning"
        initial={{ opacity: 1, rotate: 0, scale: 1 }}
        animate={
          isShown ? { opacity: 0, rotate: 90, scale: 0.4 } : { opacity: 1, rotate: 0, scale: 1 }
        }
        transition={{ ...swap, delay: FIX_DELAY_S }}
      >
        ×
      </m.span>
      <m.span
        className="absolute text-[0.5em] leading-none font-bold text-ink"
        initial={{ opacity: 0, rotate: -90, scale: 0.4 }}
        animate={
          isShown ? { opacity: 1, rotate: 0, scale: 1 } : { opacity: 0, rotate: -90, scale: 0.4 }
        }
        transition={{ ...swap, delay: FIX_DELAY_S + MOTION_DURATION_S.fast }}
      >
        ✓
      </m.span>
    </m.span>
  );
}
