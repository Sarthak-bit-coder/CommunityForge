"use client";

import {
  m,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionStyle,
} from "motion/react";
import type { PointerEvent, ReactNode } from "react";
import { MOTION_DURATION_S } from "./motion-tokens";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

const MAX_TILT_DEG = 6;
const PERSPECTIVE_PX = 800;
const SPOT_RADIUS_PX = 220;
const PERCENT = 100;
const CENTER = 0.5;
const TILT_SPRING = { visualDuration: MOTION_DURATION_S.interactive, bounce: 0 };

// The light is a ::before layer fed by --spot, so the card adds no elements of its own and
// can be a group inside a <dl> (dl > div > dt/dd stays valid).
const SPOT_CLASSES =
  "before:pointer-events-none before:absolute before:inset-0 before:bg-(image:--spot) before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-100";

type SpotlightCardProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

// A card that leans toward the pointer and lights up under it. Pointer-driven only: it never
// moves on its own, it settles flat when the pointer leaves, and under reduced motion it stays
// flat with no light. The content is unchanged for keyboard and assistive tech.
export function SpotlightCard({ children, className = "" }: SpotlightCardProps) {
  const reduceMotion = usePrefersReducedMotion();
  const pointerX = useMotionValue(CENTER);
  const pointerY = useMotionValue(CENTER);
  const rotateX = useSpring(
    useTransform(pointerY, [0, 1], [MAX_TILT_DEG, -MAX_TILT_DEG]),
    TILT_SPRING,
  );
  const rotateY = useSpring(
    useTransform(pointerX, [0, 1], [-MAX_TILT_DEG, MAX_TILT_DEG]),
    TILT_SPRING,
  );
  const spotX = useTransform(pointerX, (share) => share * PERCENT);
  const spotY = useTransform(pointerY, (share) => share * PERCENT);
  const spotlight = useMotionTemplate`radial-gradient(${SPOT_RADIUS_PX}px circle at ${spotX}% ${spotY}%, rgb(10 107 98 / 0.14), transparent 70%)`;

  function follow(event: PointerEvent<HTMLDivElement>) {
    if (reduceMotion) return;
    const box = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - box.left) / box.width);
    pointerY.set((event.clientY - box.top) / box.height);
  }

  function settle() {
    pointerX.set(CENTER);
    pointerY.set(CENTER);
  }

  return (
    <m.div
      onPointerMove={follow}
      onPointerLeave={settle}
      style={
        reduceMotion
          ? undefined
          : // Motion animates CSS variables; its style type just does not list custom properties.
            ({
              rotateX,
              rotateY,
              transformPerspective: PERSPECTIVE_PX,
              "--spot": spotlight,
            } as MotionStyle)
      }
      className={`relative overflow-hidden transition-shadow duration-300 hover:shadow-lift ${
        reduceMotion ? "" : SPOT_CLASSES
      } ${className}`}
    >
      {children}
    </m.div>
  );
}
