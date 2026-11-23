"use client";

import { m, useMotionTemplate, useTransform, type MotionValue } from "motion/react";
import { useEffect, useState, type ReactNode, type RefObject } from "react";

// Shared pieces of the model city in RouteCompare. The plane is a fixed 320×240 px board, scaled
// to fit its column and tilted with CSS 3D, so buildings can be modelled in plain pixels.

export const PLANE = { width: 320, height: 240 } as const;
const RISE_S = 0.9;
const RISE_STAGGER_S = 0.08;
const RISE_EASE = [0.2, 0.9, 0.3, 1.2] as const;

/** Scale that fits the fixed board into the element's width. */
export function useFitScale(ref: RefObject<HTMLElement | null>): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // No ResizeObserver (old browsers, jsdom): measure once and keep that size.
    if (typeof ResizeObserver === "undefined") {
      if (element.clientWidth) setScale(element.clientWidth / PLANE.width);
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / PLANE.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return scale;
}

type RiseProps = {
  readonly x: number;
  readonly y: number;
  readonly index: number;
  readonly isRisen: boolean;
  readonly children: ReactNode;
};

/** Places a building on the board and grows it up out of the ground, one after another. */
export function Rise({ x, y, index, isRisen, children }: RiseProps) {
  return (
    <m.div
      className="absolute [transform-style:preserve-3d]"
      style={{ left: x, top: y }}
      initial={false}
      animate={{ scaleZ: isRisen ? 1 : 0.001 }}
      transition={{
        duration: RISE_S,
        delay: isRisen ? index * RISE_STAGGER_S : 0,
        ease: RISE_EASE,
      }}
    >
      {children}
    </m.div>
  );
}

type BillboardProps = {
  readonly x: number;
  readonly y: number;
  readonly lift?: number;
  readonly tiltX: MotionValue<number>;
  readonly tiltZ: MotionValue<number>;
  readonly children: ReactNode;
};

// Stands a pin upright at a board point, facing the viewer. With `lift`, it rides on a stem that
// tall so it clears the rooftops instead of hiding behind them.
export function Billboard({ x, y, lift = 0, tiltX, tiltZ, children }: BillboardProps) {
  const unX = useTransform(tiltX, (value) => -value);
  const unZ = useTransform(tiltZ, (value) => -value);
  const transform = useMotionTemplate`translate(-50%, -100%) rotateZ(${unZ}deg) rotateX(${unX}deg)`;
  return (
    <m.div
      className="absolute flex origin-bottom flex-col items-center"
      style={{ left: x, top: y, transform }}
    >
      {children}
      {lift > 0 && (
        <>
          <span aria-hidden="true" className="w-0.5 bg-surface/70" style={{ height: lift }} />
          <span aria-hidden="true" className="size-2 rounded-full bg-surface/70" />
        </>
      )}
    </m.div>
  );
}
