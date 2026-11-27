"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";

const PERCENT = 100;

// Decorative light behind the hero that follows the pointer across its section.
// It moves only when the visitor moves, so it never animates on its own (WCAG 2.2.2).
// Under reduced motion it stays where it starts. The parent must be positioned.
export function HeroGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    const glow = ref.current;
    const area = glow?.parentElement;
    if (!glow || !area || reduceMotion) return;
    let frame = 0;
    function follow(event: PointerEvent) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = area!.getBoundingClientRect();
        glow!.style.setProperty(
          "--glow-x",
          `${((event.clientX - box.left) / box.width) * PERCENT}%`,
        );
        glow!.style.setProperty(
          "--glow-y",
          `${((event.clientY - box.top) / box.height) * PERCENT}%`,
        );
      });
    }
    area.addEventListener("pointermove", follow);
    return () => {
      cancelAnimationFrame(frame);
      area.removeEventListener("pointermove", follow);
    };
  }, [reduceMotion]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="af-glow pointer-events-none absolute inset-0 -z-10 rounded-[2rem]"
    />
  );
}
