"use client";

import {
  AnimatePresence,
  type MotionValue,
  animate,
  m,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  easeInOut,
  useTransform,
} from "motion/react";
import { type ReactNode, type Ref, useEffect, useId, useRef, useState } from "react";
import { MOTION_EXIT_TRANSITION, MOTION_SPRING } from "@/components/motion/motion-tokens";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";
import { Confetti } from "./Confetti";

// A plan drawing of one block: a sidewalk from home to the clinic, crossing two side streets.
// The curb on the near side of each street has no ramp. Units are SVG user units.
const VIEW = { width: 560, height: 196 } as const;
const SIDEWALK = { top: 92, bottom: 128 } as const;
const PATH_Y = (SIDEWALK.top + SIDEWALK.bottom) / 2;
const MAIN_STREET = { top: SIDEWALK.bottom, bottom: VIEW.height } as const;
const STREET_WIDTH = 48;
/** Left edge of each side street; the blocked curb sits on this edge. */
const SIDE_STREETS = [180, 350] as const;
const BLOCKS = [
  [16, 172],
  [236, 342],
  [406, 544],
] as const;
const BLOCK = { top: 18, bottom: 84 } as const;
const HOME_X = 80;
const CLINIC_X = 480;
const JOINT_SPACING = 24;
const CROSSWALK_BAR = { height: 3, gap: 3 } as const;

// The traveler rolls at a steady pace, so a longer trip takes longer.
const ROLL_UNITS_PER_S = 230;
// It stops just short of a blocked curb, then nudges against it twice.
const STOP_SHORT = 16;
const BUMP_UNITS = 5;
const BUMP_S = 0.5;
// New ramps finish pouring before the traveler sets off.
const REPAIR_S = 0.45;
const DOME_STAGGER_S = 0.03;
const DOMES = { columns: 2, rows: 5, spacing: 4, radius: 1.3 } as const;
// Scroll-driven trip: within each step's share of the story, the traveler waits while the new
// ramp pours, rolls to the next blocked curb (or the clinic), then nudges against it.
const SCRUB_PHASES = { wait: 0.15, roll: 0.75 } as const;
const ARRIVED_SLACK = 1;
// The confetti bursts from just above the traveler at the clinic door.
const CONFETTI_LIFT = 8;
// Scroll-driven camera: close in on the traveler while the story plays, then pull back to show
// the whole trip once it is open. Zoom stays low enough to keep the curb badges in frame.
const CAMERA = { progress: [0, 0.78, 0.95, 1], zoom: [1.5, 1.5, 1, 1] } as const;
const PERCENT = 100;

type RepairRouteFigureProps = {
  /** Corners repaired, in route order. */
  readonly fixed: number;
  /** Text alternative, also announced when it changes. */
  readonly summary: string;
  /** Story progress (0–1). When given, scroll drives the traveler instead of a timed run. */
  readonly progress?: MotionValue<number>;
};

export function RepairRouteFigure({ fixed, summary, progress }: RepairRouteFigureProps) {
  const summaryId = useId();
  const isOpen = fixed === SIDE_STREETS.length;
  const blockedCurb = SIDE_STREETS[fixed];
  const stopX = blockedCurb === undefined ? CLINIC_X : blockedCurb - STOP_SHORT;

  const scene = (
    <>
      <Streets />
      <Buildings isOpen={isOpen} />
      {SIDE_STREETS.map((x, index) => (
        <g key={x}>
          <Ramp x={x + STREET_WIDTH} direction={1} />
          <Curb x={x} isFixed={index < fixed} />
        </g>
      ))}
      {progress ? (
        <ScrubbedTrip progress={progress} isOpen={isOpen} />
      ) : (
        <Trip key={fixed} stopX={stopX} isOpen={isOpen} />
      )}
    </>
  );

  return (
    <figure className="af-panel overflow-hidden p-4 sm:p-6">
      {progress ? (
        <CameraSvg progress={progress} labelledBy={summaryId}>
          {scene}
        </CameraSvg>
      ) : (
        <svg
          role="img"
          aria-labelledby={summaryId}
          viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
          className="w-full rounded-xl bg-canvas"
        >
          {scene}
        </svg>
      )}
      <figcaption className="mt-3 border-t border-line pt-3">
        <p id={summaryId} aria-live="polite" className="text-sm font-semibold text-ink">
          {summary}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="font-bold text-warning">
              ×
            </span>
            Missing curb ramp
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="font-bold text-accent">
              ✓
            </span>
            Curb ramp with a yellow warning pad
          </span>
          <span className="ml-auto">Illustration, not a map or a real result.</span>
        </p>
      </figcaption>
    </figure>
  );
}

// The drawing inside a frame whose camera tracks the traveler: centred on it while zoomed in,
// clamped so the frame never shows past the drawing's edges. Transform only.
function CameraSvg({
  progress,
  labelledBy,
  children,
}: {
  readonly progress: MotionValue<number>;
  readonly labelledBy: string;
  readonly children: ReactNode;
}) {
  const travelerX = useTravelerX(progress);
  const zoom = useTransform(progress, [...CAMERA.progress], [...CAMERA.zoom]);
  const pan = useTransform(() => {
    const scale = zoom.get();
    const centred = -(travelerX.get() / VIEW.width - 0.5) * scale * PERCENT;
    const limit = ((scale - 1) / 2) * PERCENT;
    return `${Math.min(Math.max(centred, -limit), limit)}%`;
  });

  return (
    <div className="overflow-hidden rounded-xl bg-canvas">
      <m.svg
        role="img"
        aria-labelledby={labelledBy}
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        className="block w-full"
        style={{ scale: zoom, x: pan }}
      >
        {children}
      </m.svg>
    </div>
  );
}

// Asphalt, crosswalks, and concrete sidewalk panels. Static, so drawn once.
function Streets() {
  const barCount = Math.floor(
    (SIDEWALK.bottom - SIDEWALK.top) / (CROSSWALK_BAR.height + CROSSWALK_BAR.gap),
  );
  const joints = Array.from(
    { length: Math.floor(VIEW.width / JOINT_SPACING) },
    (_, index) => (index + 1) * JOINT_SPACING,
  ).filter((x) => !SIDE_STREETS.some((street) => x > street && x < street + STREET_WIDTH));

  return (
    <g aria-hidden="true">
      <rect
        y={MAIN_STREET.top}
        width={VIEW.width}
        height={MAIN_STREET.bottom - MAIN_STREET.top}
        className="fill-ink"
      />
      <line
        x1={0}
        x2={VIEW.width}
        y1={(MAIN_STREET.top + MAIN_STREET.bottom) / 2}
        y2={(MAIN_STREET.top + MAIN_STREET.bottom) / 2}
        strokeWidth={2}
        strokeDasharray="14 12"
        className="stroke-marker opacity-60"
      />
      <rect
        y={SIDEWALK.top}
        width={VIEW.width}
        height={SIDEWALK.bottom - SIDEWALK.top}
        className="fill-surface"
      />
      {joints.map((x) => (
        <line
          key={x}
          x1={x}
          x2={x}
          y1={SIDEWALK.top}
          y2={SIDEWALK.bottom}
          className="stroke-line"
        />
      ))}
      {SIDE_STREETS.map((x) => (
        <g key={x}>
          <rect x={x} width={STREET_WIDTH} height={MAIN_STREET.top} className="fill-ink" />
          {Array.from({ length: barCount }, (_, bar) => (
            <rect
              key={bar}
              x={x + 6}
              y={SIDEWALK.top + 2 + bar * (CROSSWALK_BAR.height + CROSSWALK_BAR.gap)}
              width={STREET_WIDTH - 12}
              height={CROSSWALK_BAR.height}
              className="fill-surface opacity-80"
            />
          ))}
        </g>
      ))}
    </g>
  );
}

// Roof plans: a hip roof for the home, a flat roof with a cross for the clinic.
function Buildings({ isOpen }: { readonly isOpen: boolean }) {
  const homeLeft = HOME_X - 34;
  const homeRight = HOME_X + 34;
  const ridge = (BLOCK.top + BLOCK.bottom) / 2 + 4;

  return (
    <g aria-hidden="true">
      {BLOCKS.map(([left, right]) => (
        <rect
          key={left}
          x={left}
          y={BLOCK.top}
          width={right - left}
          height={BLOCK.bottom - BLOCK.top}
          rx={4}
          className="fill-line/50"
        />
      ))}
      <g className="fill-surface stroke-ink" strokeWidth={1.5} strokeLinejoin="round">
        <rect x={homeLeft} y={BLOCK.top + 12} width={68} height={BLOCK.bottom - BLOCK.top - 12} />
        <path
          d={`M${homeLeft} ${BLOCK.top + 12} L${HOME_X - 12} ${ridge} L${homeLeft} ${BLOCK.bottom}
              M${homeRight} ${BLOCK.top + 12} L${HOME_X + 12} ${ridge} L${homeRight} ${BLOCK.bottom}
              M${HOME_X - 12} ${ridge} H${HOME_X + 12}`}
          fill="none"
        />
        <rect
          x={CLINIC_X - 40}
          y={BLOCK.top + 6}
          width={80}
          height={BLOCK.bottom - BLOCK.top - 6}
        />
      </g>
      <path
        d={`M${CLINIC_X - 4} ${BLOCK.top + 22} h8 v8 h8 v8 h-8 v8 h-8 v-8 h-8 v-8 h8 z`}
        className="fill-accent"
      />
      <text
        x={HOME_X}
        y={BLOCK.top + 4}
        textAnchor="middle"
        className="fill-ink text-[13px] font-bold"
      >
        Home
      </text>
      <text
        x={CLINIC_X}
        y={BLOCK.top - 2}
        textAnchor="middle"
        className="fill-ink text-[13px] font-bold"
      >
        Clinic
      </text>
      {/* The clinic door lights up when the traveler can reach it. */}
      <rect
        x={CLINIC_X - 9}
        y={BLOCK.bottom - 3}
        width={18}
        height={6}
        rx={2}
        className={`transition-colors duration-500 ${isOpen ? "fill-accent" : "fill-control"}`}
      />
    </g>
  );
}

// A blocked curb (hard edge, ×) or a new ramp poured into the sidewalk (✓).
// Shape and symbol change with the state, never colour alone (WCAG 1.4.1).
function Curb({ x, isFixed }: { readonly x: number; readonly isFixed: boolean }) {
  return (
    <g aria-hidden="true">
      <AnimatePresence initial={false} mode="popLayout">
        {isFixed ? (
          <Ramp key="ramp" x={x} direction={-1} isNew />
        ) : (
          <m.rect
            key="curb"
            x={x - 3}
            y={SIDEWALK.top}
            width={6}
            height={SIDEWALK.bottom - SIDEWALK.top}
            className="fill-warning"
            style={{ originY: 1 }}
            exit={{ scaleY: 0, transition: MOTION_EXIT_TRANSITION }}
          />
        )}
      </AnimatePresence>
      <g transform={`translate(${x} ${MAIN_STREET.top + 20})`}>
        <AnimatePresence initial={false} mode="popLayout">
          <m.g
            key={isFixed ? "fixed" : "blocked"}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0, transition: MOTION_EXIT_TRANSITION }}
            transition={MOTION_SPRING}
          >
            <circle
              r={11}
              strokeWidth={2.5}
              className={
                isFixed ? "fill-accent stroke-surface" : "fill-warning-soft stroke-warning"
              }
            />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              className={`text-[13px] font-bold ${isFixed ? "fill-surface" : "fill-warning"}`}
            >
              {isFixed ? "✓" : "×"}
            </text>
          </m.g>
        </AnimatePresence>
      </g>
    </g>
  );
}

// A perpendicular curb ramp in plan: the run widens into side flares at the curb, with a yellow
// pad of raised domes at the edge. `direction` is +1 when the ramp lies right of the curb.
function Ramp({
  x,
  direction,
  isNew = false,
}: {
  readonly x: number;
  readonly direction: 1 | -1;
  readonly isNew?: boolean;
}) {
  const run = 24 * direction;
  const pad = 8 * direction;
  const inset = 9;
  const domes = Array.from({ length: DOMES.columns * DOMES.rows }, (_, index) => ({
    dx: (index % DOMES.columns) * DOMES.spacing + 2,
    dy: Math.floor(index / DOMES.columns) * DOMES.spacing,
  }));
  const padLeft = direction === 1 ? x : x + pad;

  return (
    <m.g
      initial={isNew ? { scaleX: 0, opacity: 0 } : false}
      animate={{ scaleX: 1, opacity: 1 }}
      transition={{ duration: REPAIR_S, ease: "easeOut" }}
      style={{ originX: direction === 1 ? 0 : 1 }}
      aria-hidden="true"
    >
      <path
        d={`M${x + run} ${SIDEWALK.top + inset} L${x} ${SIDEWALK.top + 3}
            L${x} ${SIDEWALK.bottom - 3} L${x + run} ${SIDEWALK.bottom - inset} Z`}
        strokeWidth={1.5}
        strokeLinejoin="round"
        className="fill-accent-soft stroke-accent"
      />
      <rect
        x={padLeft}
        y={SIDEWALK.top + inset}
        width={Math.abs(pad)}
        height={SIDEWALK.bottom - SIDEWALK.top - inset * 2}
        className="fill-marker"
      />
      {domes.map(({ dx, dy }, index) => (
        <m.circle
          key={`${dx}:${dy}`}
          cx={padLeft + dx}
          cy={SIDEWALK.top + inset + 2 + dy}
          r={DOMES.radius}
          className="fill-ink/35"
          initial={isNew ? { scale: 0 } : false}
          animate={{ scale: 1 }}
          transition={{ delay: REPAIR_S / 2 + index * DOME_STAGGER_S, ...MOTION_SPRING }}
        />
      ))}
    </m.g>
  );
}

// The traveler rolls from home along the sidewalk, leaving the trip drawn behind it. At a blocked
// curb it stops and nudges against it; with the trip open it reaches the clinic door.
function Trip({ stopX, isOpen }: { readonly stopX: number; readonly isOpen: boolean }) {
  const reduceMotion = usePrefersReducedMotion();
  const ref = useRef<SVGGElement>(null);
  const isInView = useInView(ref, { amount: 0.5 });
  const x = useMotionValue(reduceMotion ? stopX : HOME_X);
  const drawn = useTransform(x, (value) => (value - HOME_X) / (CLINIC_X - HOME_X));
  // The arrival ring is motion, so under reduced motion it never plays.
  const [hasArrived, setHasArrived] = useState(false);

  useEffect(() => {
    if (reduceMotion) {
      x.set(stopX);
      return;
    }
    if (!isInView) return;
    let isCancelled = false;
    let bump: ReturnType<typeof animate> | undefined;
    const roll = animate(x, stopX, {
      delay: REPAIR_S,
      duration: (stopX - x.get()) / ROLL_UNITS_PER_S,
      ease: "easeInOut",
    });
    roll.then(() => {
      if (isCancelled) return;
      if (isOpen) setHasArrived(true);
      else {
        bump = animate(x, [stopX, stopX + BUMP_UNITS, stopX, stopX + BUMP_UNITS * 0.6, stopX], {
          duration: BUMP_S,
        });
      }
    });
    return () => {
      isCancelled = true;
      roll.stop();
      bump?.stop();
    };
  }, [isInView, isOpen, reduceMotion, stopX, x]);

  return <TripGraphic ref={ref} x={x} drawn={drawn} isOpen={isOpen} hasArrived={hasArrived} />;
}

/** Stops along the trip, in route order: each blocked curb, then the clinic door. */
const TRIP_STOPS = [...SIDE_STREETS.map((x) => x - STOP_SHORT), CLINIC_X];

// Keyframes mapping story progress to the traveler's position. Step k of n owns [k/n, (k+1)/n):
// wait at the previous stop, roll to stop k, then nudge against the curb if it is still blocked.
export function scrubKeyframes(): { readonly input: number[]; readonly output: number[] } {
  const share = 1 / TRIP_STOPS.length;
  const input: number[] = [];
  const output: number[] = [];
  TRIP_STOPS.forEach((stop, index) => {
    const start = index * share;
    const from = index === 0 ? HOME_X : TRIP_STOPS[index - 1];
    const rolled = start + share * SCRUB_PHASES.roll;
    input.push(start, start + share * SCRUB_PHASES.wait, rolled);
    output.push(from, from, stop);
    if (stop === CLINIC_X) return;
    const nudge = (1 - SCRUB_PHASES.roll) * share;
    input.push(rolled + nudge * 0.25, rolled + nudge * 0.5, rolled + nudge * 0.75);
    output.push(stop + BUMP_UNITS, stop, stop + BUMP_UNITS * 0.6);
  });
  input.push(1);
  output.push(CLINIC_X);
  return { input, output };
}

const SCRUB = scrubKeyframes();

// The traveler's position for a story progress, eased within each move so every roll and nudge
// starts and settles gently.
function useTravelerX(progress: MotionValue<number>): MotionValue<number> {
  return useTransform(progress, SCRUB.input, SCRUB.output, { ease: easeInOut });
}

// Scroll-driven trip: the traveler's position is a pure function of story progress, so scrolling
// back rewinds it. The arrival ring plays each time it reaches the clinic.
function ScrubbedTrip({
  progress,
  isOpen,
}: {
  readonly progress: MotionValue<number>;
  readonly isOpen: boolean;
}) {
  const x = useTravelerX(progress);
  const drawn = useTransform(x, (value) => (value - HOME_X) / (CLINIC_X - HOME_X));
  const [hasArrived, setHasArrived] = useState(false);

  useMotionValueEvent(x, "change", (value) => {
    setHasArrived(value >= CLINIC_X - ARRIVED_SLACK);
  });

  return <TripGraphic x={x} drawn={drawn} isOpen={isOpen} hasArrived={hasArrived} />;
}

function TripGraphic({
  ref,
  x,
  drawn,
  isOpen,
  hasArrived,
}: {
  readonly ref?: Ref<SVGGElement>;
  readonly x: MotionValue<number>;
  readonly drawn: MotionValue<number>;
  readonly isOpen: boolean;
  readonly hasArrived: boolean;
}) {
  const tripClass = isOpen ? "stroke-accent" : "stroke-ink";

  return (
    <g ref={ref} aria-hidden="true">
      <line
        x1={HOME_X}
        x2={CLINIC_X}
        y1={PATH_Y}
        y2={PATH_Y}
        strokeWidth={2}
        strokeDasharray="2 6"
        strokeLinecap="round"
        className="stroke-control"
      />
      <m.line
        x1={HOME_X}
        x2={CLINIC_X}
        y1={PATH_Y}
        y2={PATH_Y}
        strokeWidth={4}
        strokeLinecap="round"
        className={`transition-colors duration-500 ${tripClass}`}
        style={{ scaleX: drawn, originX: 0 }}
      />
      {hasArrived ? <Confetti x={CLINIC_X} y={PATH_Y - CONFETTI_LIFT} /> : null}
      {hasArrived ? (
        <m.circle
          cx={CLINIC_X}
          cy={PATH_Y}
          r={12}
          fill="none"
          strokeWidth={2}
          className="stroke-accent"
          initial={{ scale: 1, opacity: 0.9 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      ) : null}
      <m.g style={{ x }}>
        <g transform={`translate(0 ${PATH_Y})`}>
          <circle r={10} strokeWidth={2.5} className="fill-marker stroke-ink" />
          {/* A seated figure on a wheel, readable at this size. */}
          <g className="fill-none stroke-ink" strokeWidth={1.6} strokeLinecap="round">
            <circle cx={-0.5} cy={2.5} r={3.6} />
            <path d="M-2 -3.5 V0.5 H2.5 L4 4" />
          </g>
          <circle cx={-2} cy={-6} r={1.6} className="fill-ink" />
        </g>
      </m.g>
    </g>
  );
}
