"use client";

import { m } from "motion/react";
import { Box } from "./route-buildings";

// Street-level props for the RouteCompare city, modelled as real 3D boxes so they sort with the
// buildings. The barricade stays low and inside the street, so on screen it never reaches onto
// the park or a building behind it.

const ORANGE = "#f97316";
const ORANGE_SHADE = "#c2570c";
const STRIPES = `repeating-linear-gradient(45deg, ${ORANGE} 0 3px, #ffffff 3px 6px)`;
const BLINKS = 4;

// Board pixels. The barricade spans the street (14 px wide) across the direction of travel.
const BARRICADE = { w: 4, d: 14, h: 6 } as const;
// A generous invisible tap area on the street around the small barricade.
const HIT = { w: 30, d: 16 } as const;
const RAMP = { w: 12, d: 14 } as const;

type RoadBarricadeProps = {
  readonly x: number;
  readonly y: number;
  readonly isRepaired: boolean;
  /** The crew is at work: the barricade shakes once the truck has arrived. */
  readonly isWorking: boolean;
  readonly workDelay: number;
  readonly isStatic: boolean;
  readonly onToggle: () => void;
};

/** The barrier: a striped barricade across the street. Repaired, it sinks and a ramp is painted. */
export function RoadBarricade({
  x,
  y,
  isRepaired,
  isWorking,
  workDelay,
  isStatic,
  onToggle,
}: RoadBarricadeProps) {
  const isShaking = isWorking && !isStatic;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isRepaired ? "Undo the curb ramp repair" : "Repair the missing curb ramp"}
      className="absolute cursor-pointer rounded-md [transform-style:preserve-3d] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-marker"
      style={{ left: x - HIT.w / 2, top: y - HIT.d / 2, width: HIT.w, height: HIT.d }}
    >
      {/* Painted ramp marking, flat on the street. */}
      <m.span
        aria-hidden="true"
        className="absolute flex items-center justify-center rounded-[2px] bg-accent"
        style={{
          left: (HIT.w - RAMP.w) / 2,
          top: (HIT.d - RAMP.d) / 2,
          width: RAMP.w,
          height: RAMP.d,
        }}
        initial={false}
        animate={{ opacity: isRepaired ? 1 : 0, scale: isRepaired ? 1 : 0.4 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 16,
          delay: isRepaired && !isStatic ? 0.3 : 0,
        }}
      >
        <svg viewBox="-8 -8 16 16" className="size-2.5" aria-hidden="true">
          <path
            d="M-5 0 l3.5 4 l7 -8"
            fill="none"
            className="stroke-surface"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </m.span>
      {/* The barricade itself: sinks into the street when the ramp is fixed. */}
      <m.span
        aria-hidden="true"
        className="absolute [transform-style:preserve-3d]"
        style={{
          left: (HIT.w - BARRICADE.w) / 2,
          top: (HIT.d - BARRICADE.d) / 2,
          width: BARRICADE.w,
          height: BARRICADE.d,
        }}
        initial={false}
        animate={
          isShaking
            ? { rotateZ: [0, -10, 8, -6, 4, 0], scaleZ: 1, opacity: 1 }
            : { rotateZ: 0, scaleZ: isRepaired ? 0.001 : 1, opacity: isRepaired ? 0 : 1 }
        }
        transition={
          isShaking
            ? { duration: 0.5, delay: workDelay, repeat: 3, repeatDelay: 0.1 }
            : { duration: isStatic ? 0 : 0.45, ease: "easeIn" }
        }
      >
        <Box
          w={BARRICADE.w}
          d={BARRICADE.d}
          h={BARRICADE.h}
          faces={{
            south: { background: STRIPES },
            east: { background: STRIPES, filter: "brightness(0.92)" },
            north: { background: ORANGE_SHADE },
            west: { background: STRIPES },
            roof: { background: ORANGE },
          }}
          roof={
            <span
              className="size-[3px] rounded-full bg-marker shadow-[0_0_6px_2px_rgba(242,194,48,0.9)] motion-safe:animate-pulse"
              style={{ animationIterationCount: BLINKS }}
            />
          }
        />
      </m.span>
    </button>
  );
}

const TRUCK = {
  bed: { w: 22, d: 11, h: 6 },
  cab: { w: 9, d: 11, h: 10 },
  load: { w: 14, d: 7, h: 3 },
} as const;
const GLASS = "#9fd3f0";
const CONCRETE = "#c9d3da";
const VEST = { w: 3, d: 3, h: 7 } as const;
const HELMET = { w: 3, d: 3, h: 2 } as const;

type RepairTruckProps = { readonly isWorking: boolean; readonly isStatic: boolean };

/** The repair crew's truck, carrying a ramp section, with a worker beside it, parked on the grass. */
export function RepairTruck({ isWorking, isStatic }: RepairTruckProps) {
  const isFlashing = isWorking && !isStatic;
  const { bed, cab, load } = TRUCK;
  return (
    <div className="absolute [transform-style:preserve-3d]">
      <Box
        w={bed.w}
        d={bed.d}
        h={bed.h}
        faces={{
          south: { background: ORANGE },
          east: { background: ORANGE_SHADE },
          roof: { background: ORANGE_SHADE },
        }}
      />
      <Box
        at={{ x: (bed.w - load.w) / 2 - 2, y: (bed.d - load.d) / 2 }}
        w={load.w}
        d={load.d}
        h={bed.h + load.h}
        faces={{
          south: { background: CONCRETE },
          east: { background: "#a9b6c0" },
          roof: { background: CONCRETE },
        }}
      />
      <Box
        at={{ x: bed.w, y: 0 }}
        w={cab.w}
        d={cab.d}
        h={cab.h}
        faces={{
          south: { background: `linear-gradient(to bottom, ${GLASS} 0 40%, ${ORANGE} 40%)` },
          east: { background: `linear-gradient(to right, ${GLASS} 0 40%, ${ORANGE_SHADE} 40%)` },
          roof: { background: ORANGE },
        }}
        roof={
          <m.span
            className="size-[4px] rounded-full bg-marker"
            animate={isFlashing ? { opacity: [1, 0.15, 1] } : { opacity: 1 }}
            transition={isFlashing ? { duration: 0.45, repeat: 3 } : undefined}
            style={{ boxShadow: "0 0 6px 2px rgba(242,194,48,0.9)" }}
          />
        }
      />
      {/* Worker: high-visibility vest with a yellow hard hat. */}
      <m.div
        className="absolute [transform-style:preserve-3d]"
        style={{ left: bed.w + cab.w + 4, top: 3 }}
        animate={isFlashing ? { y: [0, 3, 0, 3, 0] } : { y: 0 }}
        transition={{ duration: 1.4 }}
      >
        <Box
          w={VEST.w}
          d={VEST.d}
          h={VEST.h}
          faces={{
            south: { background: ORANGE },
            east: { background: ORANGE_SHADE },
            roof: { background: "#e8b98f" },
          }}
        />
        <div
          className="absolute [transform-style:preserve-3d]"
          style={{ transform: `translateZ(${VEST.h}px)` }}
        >
          <Box
            w={HELMET.w}
            d={HELMET.d}
            h={HELMET.h}
            faces={{
              south: { background: "#f2c230" },
              east: { background: "#d4a514" },
              roof: { background: "#f2c230" },
            }}
          />
        </div>
      </m.div>
    </div>
  );
}
