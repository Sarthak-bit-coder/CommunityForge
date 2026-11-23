"use client";

import { m } from "motion/react";

// The repair crew that asks the reader which barrier to fix, then drives over and fixes it.
// It lives beside the 3D city, not inside it, so it never overlaps a building.

export type CrewPhase = "waiting" | "working" | "done";

const message = (phase: CrewPhase, destination: string, savedMeters: number): string => {
  if (phase === "waiting")
    return `We can fix one barrier today. Which one opens the trip to ${destination}? Tap the barricade on the map.`;
  if (phase === "working") return "On our way. Installing a curb ramp…";
  return `Ramp installed. The modeled trip to ${destination} is now ${savedMeters} m shorter.`;
};

type RepairCrewProps = {
  readonly phase: CrewPhase;
  readonly workSeconds: number;
  readonly destination: string;
  readonly savedMeters: number;
  readonly isStatic: boolean;
};

export function RepairCrew({
  phase,
  workSeconds,
  destination,
  savedMeters,
  isStatic,
}: RepairCrewProps) {
  const isWorking = phase === "working";
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface/[0.06] p-3">
      <m.div
        className="shrink-0"
        initial={false}
        animate={
          isWorking && !isStatic ? { x: [-18, 0], y: [0, -1.5, 0, -1.5, 0] } : { x: 0, y: 0 }
        }
        transition={{ duration: 0.9, ease: "easeOut" }}
      >
        <CrewTruck isWorking={isWorking} isStatic={isStatic} />
      </m.div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-marker">Repair crew</p>
        <m.p
          key={phase}
          aria-live="polite"
          initial={isStatic ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-0.5 text-sm leading-snug text-surface"
        >
          {message(phase, destination, savedMeters)}
        </m.p>
        {isWorking && (
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface/15"
            role="progressbar"
            aria-label="Repair progress"
          >
            <m.div
              className="h-full rounded-full bg-marker"
              initial={{ width: isStatic ? "100%" : "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: isStatic ? 0 : workSeconds, ease: "easeInOut" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// An orange work truck with a ramp section in its bed, a flashing beacon, and a worker beside it.
function CrewTruck({
  isWorking,
  isStatic,
}: {
  readonly isWorking: boolean;
  readonly isStatic: boolean;
}) {
  const isFlashing = isWorking && !isStatic;
  return (
    <svg viewBox="0 0 96 52" className="h-12 w-[5.5rem]" aria-hidden="true">
      {/* Bed with a concrete ramp section */}
      <rect x={4} y={22} width={44} height={16} rx={2} fill="#f97316" />
      <path d="M10 22 L40 22 L40 12 Z" fill="#c9d3da" stroke="#8a97a3" strokeWidth={1} />
      {/* Cab */}
      <path d="M48 38 V18 a3 3 0 0 1 3 -3 H62 l8 10 V38 Z" fill="#f97316" />
      <path d="M53 18 H61 l5.5 7 H53 Z" fill="#9fd3f0" />
      <rect x={4} y={31} width={66} height={3} fill="#ffffff" opacity={0.85} />
      {/* Beacon */}
      <m.circle
        cx={56}
        cy={12}
        r={3}
        fill="#f2c230"
        animate={isFlashing ? { opacity: [1, 0.2, 1] } : { opacity: 1 }}
        transition={isFlashing ? { duration: 0.5, repeat: 3 } : undefined}
      />
      {/* Wheels */}
      {[16, 58].map((cx) => (
        <m.g
          key={cx}
          style={{ originX: `${cx}px`, originY: "40px" }}
          animate={isFlashing ? { rotate: 360 } : { rotate: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        >
          <circle cx={cx} cy={40} r={6} fill="#0d1b2e" stroke="#f4f7f9" strokeWidth={1.5} />
          <line x1={cx} y1={36} x2={cx} y2={44} stroke="#f4f7f9" strokeWidth={1.2} />
        </m.g>
      ))}
      {/* Worker in a hard hat and high-visibility vest */}
      <m.g
        animate={isFlashing ? { rotate: [0, -8, 0, -8, 0] } : { rotate: 0 }}
        style={{ originX: "84px", originY: "46px" }}
        transition={{ duration: 1.2 }}
      >
        <circle cx={84} cy={20} r={4} fill="#e8b98f" />
        <path d="M79 19 a5 5 0 0 1 10 0 Z" fill="#f2c230" />
        <rect x={80} y={25} width={8} height={12} rx={2} fill="#f97316" />
        <rect x={80} y={29} width={8} height={1.6} fill="#ffffff" />
        <rect x={81} y={37} width={2.5} height={9} fill="#0d1b2e" />
        <rect x={84.5} y={37} width={2.5} height={9} fill="#0d1b2e" />
      </m.g>
    </svg>
  );
}
