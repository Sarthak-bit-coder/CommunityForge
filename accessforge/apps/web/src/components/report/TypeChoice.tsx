"use client";

import { m } from "motion/react";
import { MOTION_SPRING } from "@/components/motion/motion-tokens";
import { BARRIER_TYPES, BARRIER_TYPE_LABELS, type BarrierType } from "@/lib/barriers";
import { FieldError } from "./ReportField";

type TypeChoiceProps = {
  readonly value: string;
  readonly error?: string;
  readonly onChange: (type: BarrierType) => void;
};

const ERROR_ID = "report-type-error";

// Native radios styled as cards: arrow keys move between them, Space selects. The error summary
// links to #report-type, which is the first radio.
export function TypeChoice({ value, error, onChange }: TypeChoiceProps) {
  return (
    <fieldset aria-describedby={error ? ERROR_ID : undefined} className="min-w-0">
      <legend className="font-medium text-ink">Barrier type</legend>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {BARRIER_TYPES.map((type, index) => {
          const isChecked = type === value;
          return (
            <label
              key={type}
              className={`relative flex min-h-28 cursor-pointer flex-col justify-between gap-3 rounded-xl border bg-surface p-3.5 text-sm leading-snug font-semibold text-ink shadow-card transition-[transform,border-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-ink hover:shadow-lift active:translate-y-0 active:scale-[0.98] has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                isChecked ? "border-ink" : error ? "border-warning" : "border-control"
              }`}
            >
              <input
                type="radio"
                name="report-type"
                id={index === 0 ? "report-type" : undefined}
                value={type}
                checked={isChecked}
                onChange={() => onChange(type)}
                // Invisible but full-size, so the click lands on the radio itself.
                className="absolute inset-0 z-10 m-0 cursor-pointer appearance-none opacity-0"
              />
              {isChecked ? (
                // One outline glides between cards instead of each card flashing on and off.
                <m.span
                  layoutId="report-type-selected"
                  transition={MOTION_SPRING}
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-px rounded-xl ring-2 ring-ink"
                />
              ) : null}
              <span
                aria-hidden="true"
                className={`flex size-9 items-center justify-center rounded-lg transition-colors duration-150 ${
                  isChecked ? "bg-ink text-marker" : "bg-canvas text-ink"
                }`}
              >
                <TypeIcon type={type} />
              </span>
              <span className="flex items-end justify-between gap-2">
                {BARRIER_TYPE_LABELS[type]}
                <span
                  aria-hidden="true"
                  className={`text-base text-accent transition-opacity duration-150 ${isChecked ? "opacity-100" : "opacity-0"}`}
                >
                  ✓
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <FieldError id={ERROR_ID} error={error} />
    </fieldset>
  );
}

// Simple line pictograms, decorative: the label text names each type.
const ICON_PATHS: Record<BarrierType, string> = {
  missing_curb_ramp: "M3 17h7v-6h11M14 4l4 4m0-4-4 4",
  surface_problem: "M3 18h18M7 18l2.5-5 2.5 3 2.5-6 2.5 8",
  obstruction: "M12 4 17 18H7ZM5 18h14M9.5 12h5",
  no_sidewalk: "M3 12h3m4 0h4m4 0h3M5 20 19 4",
  steep_slope: "M3 19 21 7v12ZM16 15h2",
};

function TypeIcon({ type }: { readonly type: BarrierType }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <path d={ICON_PATHS[type]} />
    </svg>
  );
}
