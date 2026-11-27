"use client";

import { LazyMotion, MotionConfig, domAnimation, domMax } from "motion/react";
import type { ReactNode } from "react";

// domAnimation is the lightweight default. domMax adds layout projection (layoutId),
// so only components that share layout between elements should opt in.
type MotionFeatures = typeof domAnimation | typeof domMax;

// Transform motion is switched off for visitors who ask for reduced motion.
export function MotionRoot({
  children,
  features = domAnimation,
}: {
  readonly children: ReactNode;
  readonly features?: MotionFeatures;
}) {
  return (
    <LazyMotion features={features} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
