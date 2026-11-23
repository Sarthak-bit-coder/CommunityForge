"use client";

import { animate, press } from "motion";
import { m } from "motion/react";
import { useEffect, useRef } from "react";
import { MOTION_PRESS_TRANSITION, MOTION_SPRING } from "@/components/motion/motion-tokens";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";
import { MAX_SEVERITY, MIN_SEVERITY, severityLabel, type Severity } from "@/lib/barriers";
import { FieldError } from "./ReportField";

type SeverityScaleProps = {
  readonly value: string;
  readonly error?: string;
  readonly onChange: (value: string) => void;
};

const LEVELS = Array.from(
  { length: MAX_SEVERITY - MIN_SEVERITY + 1 },
  (_, index) => MIN_SEVERITY + index,
);
const ERROR_ID = "report-severity-error";
const HELP_ID = "report-severity-help";
const PRESSED_SCALE = 0.94;

// A 1–5 scale of native radios: arrow keys step through it. One highlight slides to the choice.
export function SeverityScale({ value, error, onChange }: SeverityScaleProps) {
  const scaleRef = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();
  // Press and release on a chip: it dips while held and springs back. The chip is the label, so
  // its focus outline scales with it. Skipped under reduced motion; the highlight still moves.
  useEffect(() => {
    const scale = scaleRef.current;
    if (reduceMotion || !scale) return;
    return press(scale.querySelectorAll("input"), (input) => {
      const chip = input.parentElement;
      if (!chip) return;
      animate(chip, { scale: PRESSED_SCALE }, MOTION_PRESS_TRANSITION);
      return () => {
        animate(chip, { scale: 1 }, MOTION_SPRING);
      };
    });
  }, [reduceMotion]);
  return (
    <fieldset aria-describedby={`${HELP_ID}${error ? ` ${ERROR_ID}` : ""}`} className="min-w-0">
      <legend className="font-medium text-ink">Severity (1–5)</legend>
      <div
        ref={scaleRef}
        className={`mt-2 grid grid-cols-5 gap-1 rounded-xl border bg-surface p-1 ${error ? "border-warning" : "border-control"}`}
      >
        {LEVELS.map((level, index) => {
          const isChecked = String(level) === value;
          return (
            <label
              key={level}
              className={`relative flex min-h-12 cursor-pointer items-center justify-center rounded-lg text-lg font-bold tabular-nums transition-colors duration-150 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                isChecked ? "text-surface" : "text-ink hover:bg-canvas"
              }`}
            >
              <input
                type="radio"
                name="report-severity"
                id={index === 0 ? "report-severity" : undefined}
                value={level}
                checked={isChecked}
                onChange={() => onChange(String(level))}
                // Invisible but full-size, so the click lands on the radio itself.
                className="absolute inset-0 z-10 m-0 cursor-pointer appearance-none opacity-0"
              />
              {isChecked ? (
                <m.span
                  layoutId="report-severity-selected"
                  transition={MOTION_SPRING}
                  aria-hidden="true"
                  className="absolute inset-0 rounded-lg bg-ink"
                />
              ) : null}
              <span className="relative">{level}</span>
            </label>
          );
        })}
      </div>
      <div id={HELP_ID} className="mt-2 flex items-center justify-between text-sm text-muted">
        <span>1 is least severe</span>
        <span aria-live="polite" className="font-semibold text-ink">
          {value ? severityLabel(Number(value) as Severity) : "Not chosen yet"}
        </span>
        <span>5 is most severe</span>
      </div>
      <FieldError id={ERROR_ID} error={error} />
    </fieldset>
  );
}
