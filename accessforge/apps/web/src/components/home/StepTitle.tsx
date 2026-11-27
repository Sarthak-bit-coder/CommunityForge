"use client";

import { m, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";

// Each step title starts as letters scattered off a dotted path, and lines up along it as the
// step scrolls to the middle of the screen. Scroll-linked, so it plays at the reader's pace.
const SCROLL_OFFSET: ["start end", "center center"] = ["start end", "center center"];
const SETTLE_AT = 0.85;
const SCATTER_X_EM = 0.6;
const SCATTER_Y_EM = 0.55;
const SCATTER_ROTATE_DEG = 18;

// Fixed, alternating offsets: the scatter is the same on every visit and every render.
function scatterFor(index: number) {
  const side = index % 2 === 0 ? 1 : -1;
  const wave = ((index * 7) % 5) / 4 - 0.5;
  return {
    x: wave * SCATTER_X_EM,
    y: side * SCATTER_Y_EM * (0.6 + Math.abs(wave)),
    rotate: side * SCATTER_ROTATE_DEG * (0.5 + Math.abs(wave)),
  };
}

export function StepTitle({
  text,
  className,
}: {
  readonly text: string;
  readonly className?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const prefersReduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: SCROLL_OFFSET });
  // clip-path, not scaleX, so the dots are revealed rather than stretched.
  const pathClip = useTransform(
    scrollYProgress,
    [0, SETTLE_AT],
    ["inset(0 100% 0 0)", "inset(0 0% 0 0)"],
  );

  return (
    <h3 ref={ref} className={`relative self-start pb-2 ${className ?? ""}`}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {Array.from(text).map((letter, index) => (
          <Letter
            key={index}
            letter={letter}
            index={index}
            progress={scrollYProgress}
            isStatic={prefersReduced}
          />
        ))}
      </span>
      <m.span
        aria-hidden="true"
        className="absolute bottom-0 left-0 h-[3px] w-full bg-[radial-gradient(circle,var(--color-accent)_1.5px,transparent_1.6px)] bg-[length:8px_3px]"
        style={prefersReduced ? undefined : { clipPath: pathClip }}
      />
    </h3>
  );
}

type LetterProps = {
  readonly letter: string;
  readonly index: number;
  readonly progress: MotionValue<number>;
  readonly isStatic: boolean;
};

function Letter({ letter, index, progress, isStatic }: LetterProps) {
  const scatter = scatterFor(index);
  const range = [0, SETTLE_AT];
  const x = useTransform(progress, range, [`${scatter.x}em`, "0em"]);
  const y = useTransform(progress, range, [`${scatter.y}em`, "0em"]);
  const rotate = useTransform(progress, range, [scatter.rotate, 0]);
  return (
    <m.span className="inline-block" style={isStatic ? undefined : { x, y, rotate }}>
      {letter}
    </m.span>
  );
}
