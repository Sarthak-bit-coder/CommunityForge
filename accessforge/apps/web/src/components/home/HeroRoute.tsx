"use client";

import { useEffect, useRef } from "react";
import { MOTION_DURATION_S } from "@/components/motion/motion-tokens";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";

// A route line under the headline word "reconnect": it draws itself once, then a marker travels it.
// Anime.js owns only this SVG; Motion never animates these elements, so the two never conflict.
const ROUTE_PATH = "M4 16 C60 6 110 22 160 12 S260 6 296 14";
const ROUTE_END_TRANSFORM = "translate(296px, 14px)";
const MS_PER_S = 1000;
const START_DELAY_MS = 500;
const FADE_MS = MOTION_DURATION_S.fast * MS_PER_S;
const DRAW_MS = MOTION_DURATION_S.slow * MS_PER_S;
const ARRIVE_MS = MOTION_DURATION_S.interactive * MS_PER_S;

export function HeroRoute() {
  const svgRef = useRef<SVGSVGElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const prefersReduced = usePrefersReducedMotion();

  useEffect(() => {
    const svgEl = svgRef.current;
    const line = lineRef.current;
    const dot = dotRef.current;
    if (!svgEl || !line || !dot) return;
    const showFinished = () => {
      svgEl.style.opacity = "1";
    };
    const canMeasurePaths = typeof line.getTotalLength === "function";
    if (prefersReduced || !canMeasurePaths) {
      showFinished();
      return;
    }

    let isCancelled = false;
    let timeline: { revert: () => unknown } | null = null;
    // Loaded on demand so the animation library stays off the critical rendering path.
    import("animejs")
      .then(({ createTimeline, createDrawable, createMotionPath }) => {
        if (isCancelled) return;
        const [drawable] = createDrawable(line);
        timeline = createTimeline()
          .add(svgEl, { opacity: [0, 1], duration: FADE_MS, delay: START_DELAY_MS })
          .add(drawable, { draw: ["0 0", "0 1"], duration: DRAW_MS, ease: "inOutQuad" })
          .add(dot, { ...createMotionPath(line), duration: DRAW_MS, ease: "inOutQuad" }, "<<")
          .add(dot, { scale: [1, 1.7, 1], duration: ARRIVE_MS, ease: "outQuad" });
      })
      // Decorative only: if the library fails to load, show the finished line instead.
      .catch(showFinished);

    return () => {
      isCancelled = true;
      timeline?.revert();
    };
  }, [prefersReduced]);

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      viewBox="0 0 300 24"
      fill="none"
      className="pointer-events-none absolute -bottom-[0.32em] left-0 w-full overflow-visible opacity-0"
    >
      <path
        ref={lineRef}
        d={ROUTE_PATH}
        strokeWidth="5"
        strokeLinecap="round"
        className="stroke-marker"
      />
      <circle
        ref={dotRef}
        r="6"
        className="fill-accent stroke-surface"
        strokeWidth="2.5"
        style={{ transform: ROUTE_END_TRANSFORM }}
      />
    </svg>
  );
}
