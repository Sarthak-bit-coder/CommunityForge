"use client";

/**
 * Adapted from KokonutUI "Inline Alert" v1.0.0 (MIT), https://kokonutui.com.
 * Changes: checks are the report's real steps and pass only when the person fixes them (the
 * original passed them on a timer); no deploy phase, dismiss, or lucide icons; AccessForge
 * tokens; colour wipe, glyph swap, and tick drawing jump to their end state under reduced motion.
 */

import { AnimatePresence, m } from "motion/react";
import type { Ref } from "react";
import {
  MOTION_DURATION_S,
  MOTION_EASE_ENTER,
  MOTION_STAGGER_S,
} from "@/components/motion/motion-tokens";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";

export type StepCheck = {
  readonly name: string;
  /** The field focused when the existing error text is chosen. */
  readonly target: string;
  /** The error text shown when the report was submitted. */
  readonly detail: string;
  readonly isOk: boolean;
};

type Props = {
  readonly checks: readonly StepCheck[];
  readonly alertRef: Ref<HTMLDivElement>;
};

const HEADING_ID = "report-errors-heading";

export function ValidationAlert({ checks, alertRef }: Props) {
  const reduceMotion = usePrefersReducedMotion();
  const left = checks.filter((check) => !check.isOk);
  const fixedShare = (checks.length - left.length) / checks.length;
  const isAllFixed = left.length === 0;
  const message = isAllFixed
    ? "All steps fixed. Submit the report again."
    : `${left.length} of ${checks.length} ${checks.length === 1 ? "step needs" : "steps need"} attention.`;
  return (
    <div
      ref={alertRef}
      // A named group to receive focus; the assertive announcement is the sr-only alert inside,
      // so steps turning green while someone types are spoken politely instead.
      role="group"
      tabIndex={-1}
      aria-labelledby={HEADING_ID}
      className="relative overflow-hidden rounded-lg border-2 border-warning text-ink"
    >
      <div aria-hidden="true" className="absolute inset-0 bg-warning-soft" />
      {/* Green wipes in as steps are fixed. */}
      <m.div
        aria-hidden="true"
        className="absolute inset-0 bg-success-soft"
        initial={false}
        animate={{ clipPath: `inset(0% ${(1 - fixedShare) * 100}% 0% 0%)` }}
        transition={{
          duration: reduceMotion ? 0 : MOTION_DURATION_S.interactive,
          ease: MOTION_EASE_ENTER,
        }}
      />
      <div className="relative flex gap-3 p-4">
        <StatusDot isOk={isAllFixed} reduceMotion={reduceMotion} />
        <div className="min-w-0 flex-1">
          <h2 id={HEADING_ID} className="font-semibold">
            Please correct your report
          </h2>
          {/* Announced when the summary appears; later edits update the polite line below. */}
          <p role="alert" className="sr-only">
            {`Please correct your report. ${checks.map((check) => check.detail).join(" ")}`}
          </p>
          <p aria-live="polite" className="text-sm text-muted tabular-nums">
            {message}
          </p>
          <ul className="mt-2 space-y-2">
            {checks.map((check, index) => (
              <CheckRow
                key={check.target}
                check={check}
                delay={reduceMotion ? 0 : index * MOTION_STAGGER_S}
                reduceMotion={reduceMotion}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// Rows arrive one after another when the summary opens, then each turns green once fixed.
function CheckRow({
  check,
  delay,
  reduceMotion,
}: {
  readonly check: StepCheck;
  readonly delay: number;
  readonly reduceMotion: boolean;
}) {
  return (
    <m.li
      className="flex items-start gap-2.5"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: MOTION_DURATION_S.fast, delay }}
    >
      <StatusDot isOk={check.isOk} reduceMotion={reduceMotion} small />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="font-medium">{check.name}</span>
          <span className={`text-sm font-semibold ${check.isOk ? "text-success" : "text-warning"}`}>
            {check.isOk ? "Done" : "Not done yet"}
          </span>
        </span>
        {check.isOk ? null : (
          <a
            href={`#${check.target}`}
            className="block text-sm underline"
            onClick={(event) => {
              event.preventDefault();
              document.getElementById(check.target)?.focus();
            }}
          >
            {check.detail}
          </a>
        )}
      </span>
    </m.li>
  );
}

// Warning "!" or a tick that draws itself; the row's text carries the state, not the colour.
function StatusDot({
  isOk,
  reduceMotion,
  small = false,
}: {
  readonly isOk: boolean;
  readonly reduceMotion: boolean;
  readonly small?: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`${small ? "mt-0.5 size-4" : "size-6"} shrink-0`}
    >
      <circle
        cx="10"
        cy="10"
        r="10"
        className={`transition-colors duration-300 motion-reduce:transition-none ${isOk ? "fill-success" : "fill-warning"}`}
      />
      <AnimatePresence initial={false} mode="popLayout">
        {isOk ? (
          <m.path
            key="tick"
            d="M6 10.5 8.8 13 14 7.5"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-surface"
            initial={{ pathLength: reduceMotion ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            exit={{ opacity: 0, transition: { duration: 0 } }}
            transition={{
              duration: reduceMotion ? 0 : MOTION_DURATION_S.interactive,
              ease: "easeOut",
            }}
          />
        ) : (
          <path
            key="bang"
            d="M10 5.5v5.5M10 14.2v.1"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            className="stroke-surface"
          />
        )}
      </AnimatePresence>
    </svg>
  );
}
