"use client";

import Link from "next/link";
import { m } from "motion/react";
import type { ReactNode } from "react";
import { MOTION_PRESS_TRANSITION } from "./motion-tokens";

const HOVER_LIFT_PX = -2;
const PRESS_SCALE = 0.97;

type MotionLinkProps = {
  readonly href: string;
  readonly className: string;
  readonly children: ReactNode;
};

// The focus ring and link semantics stay on the real <a>; motion only wraps it.
export function MotionLink({ href, className, children }: MotionLinkProps) {
  return (
    <m.span
      // whileTap makes Motion give the wrapper tabindex=0, which would add a second, empty tab
      // stop before every link. An explicit -1 stops that; the link inside keeps keyboard focus.
      tabIndex={-1}
      className="inline-flex"
      whileHover={{ y: HOVER_LIFT_PX }}
      whileTap={{ scale: PRESS_SCALE }}
      transition={MOTION_PRESS_TRANSITION}
    >
      <Link href={href} className={className}>
        {children}
      </Link>
    </m.span>
  );
}
