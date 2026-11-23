"use client";

import { animate, m, useInView, useSpring } from "motion/react";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";
import { RepairCrew } from "./RepairCrew";
import { Hospital, House, Office, Park } from "./route-buildings";
import { Billboard, PLANE, Rise, useFitScale } from "./route-city";
import { RepairTruck, RoadBarricade } from "./route-props";

// A small model city: a wheelchair user's route from home to Washington Hospital today, around a
// missing curb ramp, then the modeled route once that ramp is repaired. Solid = mapped today,
// dashed = modeled. The hospital is real; the streets, barrier, and distances are illustrative.

type View = "current" | "working" | "repaired";

const STREETS_X = [40, 120, 200, 280] as const;
const STREETS_Y = [40, 120, 200] as const;
const START = { x: 40, y: 120 } as const;
const END = { x: 280, y: 120 } as const;
// Mid-block, in front of the park, so nothing tall stands behind the barrier on screen.
const BARRIER = { x: 160, y: 120 } as const;
const CURRENT_PATH = "M40 120 H120 V200 H280 V120";
const MODELED_PATH = "M40 120 H280";
// One grid unit stands for 1.5 m, so the two routes read as a believable block-scale trip.
const METERS_PER_UNIT = 1.5;
const CURRENT_METERS = (80 + 80 + 160 + 80) * METERS_PER_UNIT;
const MODELED_METERS = 240 * METERS_PER_UNIT;
const DESTINATION = "Washington Hospital";
const DRAW_S = 1.4;
const WALK_S = 1.8;
const COUNT_S = 1.2;
// How long the crew works before the repaired route appears.
const WORK_S = 3.2;
// The truck drives to the barrier first; the crew works for the rest of WORK_S.
const DRIVE_S = 1;
const RETURN_DELAY_S = 0.8;
const EASE_DRAW = [0.65, 0, 0.35, 1] as const;

// The city opens flat, as a plain diagram, then tilts up into 3D when it scrolls into view.
const TILT = { x: 46, z: -24 } as const;
// How far the pointer can lean the city, in degrees.
const LEAN = { x: 8, z: 14 } as const;
const TILT_SPRING = { stiffness: 90, damping: 18 } as const;
// The crew parks on the park path, facing the street with the barrier.
const TRUCK_AT = { x: 140, y: 62 } as const;
// Where it stops to work: in the street, just short of the barrier, with the worker beside it.
const TRUCK_WORK_AT = { x: 126, y: 114.5 } as const;
const HOME_LIFT_PX = 34;
const HOSPITAL_LIFT_PX = 66;

type Placed = { readonly x: number; readonly y: number; readonly model: ReactNode };

// The front row stays low so the route along the middle street is never hidden.
const BUILDINGS: readonly Placed[] = [
  { x: 50, y: 50, model: <Office w={60} d={60} h={18} /> },
  // Shallower than the other blocks, so the barricade in the street in front never reaches it.
  { x: 130, y: 50, model: <Park w={60} d={54} /> },
  { x: 209, y: 50, model: <Hospital /> },
  { x: 63, y: 146, model: <House /> },
  { x: 130, y: 130, model: <Office w={60} d={60} h={6} /> },
  { x: 210, y: 130, model: <Office w={60} d={60} h={8} /> },
];

const VIEWS: readonly { readonly id: View; readonly label: string }[] = [
  { id: "current", label: "As it is" },
  { id: "repaired", label: "With the repair" },
];

export function RouteCompare() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.4 });
  const isStatic = usePrefersReducedMotion();
  const [view, setView] = useState<View>("current");
  const isRepaired = view === "repaired";
  const meters = useCountedMeters(isRepaired ? MODELED_METERS : CURRENT_METERS, isStatic);
  const isShown = isInView || isStatic;
  const { tiltX, tiltZ, lean, settle } = useCityTilt(isShown, isStatic);
  const draw = (isVisible: boolean) => ({
    pathLength: isVisible && isShown ? 1 : 0,
    transition: { duration: isStatic ? 0 : DRAW_S, ease: EASE_DRAW, delay: isStatic ? 0 : 0.3 },
  });
  const requestRepair = () => {
    if (view === "current") setView(isStatic ? "repaired" : "working");
  };
  const undoRepair = () => setView("current");
  const toggleRepair = () => (isRepaired ? undoRepair() : requestRepair());
  useEffect(() => {
    if (view !== "working") return;
    const timer = window.setTimeout(() => setView("repaired"), WORK_S * 1000);
    return () => window.clearTimeout(timer);
  }, [view]);
  const stageRef = useRef<HTMLDivElement>(null);
  const scale = useFitScale(stageRef);

  return (
    <figure ref={ref} className="flex flex-col gap-5">
      <div
        role="group"
        aria-label="Route view"
        className="flex gap-1 self-start rounded-full bg-surface/10 p-1"
      >
        {VIEWS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={option.id === "current" ? view === "current" : view !== "current"}
            onClick={option.id === "current" ? undoRepair : requestRepair}
            className="rounded-full px-4 py-2 text-sm font-semibold text-surface/80 transition-colors hover:text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marker aria-pressed:bg-surface aria-pressed:text-ink"
          >
            {option.label}
          </button>
        ))}
      </div>

      <RepairCrew
        phase={view === "current" ? "waiting" : view === "working" ? "working" : "done"}
        workSeconds={WORK_S}
        destination={DESTINATION}
        savedMeters={CURRENT_METERS - MODELED_METERS}
        isStatic={isStatic}
      />

      {/* Pointer lean is decoration; every state is reachable with the buttons. */}
      <div
        ref={stageRef}
        className="relative mt-6 mb-4 [perspective:1100px]"
        style={{ height: PLANE.height * scale }}
        onPointerMove={lean}
        onPointerLeave={settle}
      >
        <m.div
          className="absolute top-1/2 left-1/2 [transform-style:preserve-3d]"
          style={{
            width: PLANE.width,
            height: PLANE.height,
            marginLeft: -PLANE.width / 2,
            marginTop: -PLANE.height / 2,
            scale,
            rotateX: tiltX,
            rotateZ: tiltZ,
          }}
        >
          <svg
            viewBox={`0 0 ${PLANE.width} ${PLANE.height}`}
            className="absolute inset-0 size-full overflow-visible"
            aria-hidden="true"
          >
            <rect
              x={10}
              y={10}
              width={300}
              height={220}
              rx={16}
              className="fill-surface/[0.04] stroke-surface/10"
            />
            {STREETS_X.map((x) => (
              <line
                key={`x${x}`}
                x1={x}
                y1={20}
                x2={x}
                y2={220}
                className="stroke-surface/15"
                strokeWidth={14}
                strokeLinecap="round"
              />
            ))}
            {STREETS_Y.map((y) => (
              <line
                key={`y${y}`}
                x1={20}
                y1={y}
                x2={300}
                y2={y}
                className="stroke-surface/15"
                strokeWidth={14}
                strokeLinecap="round"
              />
            ))}
            <m.path
              d={CURRENT_PATH}
              fill="none"
              className="stroke-surface"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ ...draw(true), opacity: isRepaired ? 0.25 : 1 }}
            />
            {/* pathLength drawing replaces stroke-dasharray, so the dashes are revealed through a mask. */}
            <mask id="af-modeled-reveal" maskUnits="userSpaceOnUse">
              <m.path
                d={MODELED_PATH}
                fill="none"
                stroke="white"
                strokeWidth={12}
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={draw(isRepaired)}
              />
            </mask>
            <path
              d={MODELED_PATH}
              fill="none"
              className="stroke-marker"
              strokeWidth={4}
              strokeDasharray="8 8"
              strokeLinecap="round"
              mask="url(#af-modeled-reveal)"
            />
            {!isStatic && isShown && (
              <m.circle
                key={view}
                r={6}
                className={isRepaired ? "fill-marker" : "fill-surface"}
                style={{
                  offsetPath: `path("${isRepaired ? MODELED_PATH : CURRENT_PATH}")`,
                  offsetRotate: "0deg",
                }}
                initial={{ offsetDistance: "0%", opacity: 0 }}
                animate={{ offsetDistance: "100%", opacity: [0, 1, 1, 0] }}
                transition={{ duration: WALK_S, delay: DRAW_S * 0.8, ease: "easeInOut" }}
              />
            )}
          </svg>

          {BUILDINGS.map((building, index) => (
            <Rise
              key={`${building.x}-${building.y}`}
              x={building.x}
              y={building.y}
              index={index}
              isRisen={isShown}
            >
              {building.model}
            </Rise>
          ))}

          <Billboard x={START.x} y={START.y} lift={HOME_LIFT_PX} tiltX={tiltX} tiltZ={tiltZ}>
            <PlaceLabel label="Home" />
          </Billboard>
          <Billboard x={END.x} y={END.y} lift={HOSPITAL_LIFT_PX} tiltX={tiltX} tiltZ={tiltZ}>
            <PlaceLabel label={DESTINATION} />
          </Billboard>
          <Rise x={TRUCK_AT.x} y={TRUCK_AT.y} index={BUILDINGS.length} isRisen={isShown}>
            <m.div
              className="absolute [transform-style:preserve-3d]"
              initial={false}
              animate={
                view === "working"
                  ? { x: TRUCK_WORK_AT.x - TRUCK_AT.x, y: TRUCK_WORK_AT.y - TRUCK_AT.y }
                  : { x: 0, y: 0 }
              }
              transition={{
                duration: isStatic ? 0 : DRIVE_S,
                ease: "easeInOut",
                delay: view === "repaired" && !isStatic ? RETURN_DELAY_S : 0,
              }}
            >
              <RepairTruck isWorking={view === "working"} isStatic={isStatic} />
            </m.div>
          </Rise>
          <RoadBarricade
            x={BARRIER.x}
            y={BARRIER.y}
            isRepaired={isRepaired}
            isWorking={view === "working"}
            workDelay={DRIVE_S}
            isStatic={isStatic}
            onToggle={toggleRepair}
          />
        </m.div>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p
          aria-live="polite"
          className="font-display text-3xl font-semibold text-surface tabular-nums"
        >
          {Math.round(meters)} m
          <span className="mt-1 block text-base font-normal text-surface/70">
            {isRepaired
              ? `modeled, home to ${DESTINATION}`
              : `current route, home to ${DESTINATION}`}
          </span>
        </p>
        <p className="max-w-xs text-sm text-surface/70">
          Example trip. Streets, barrier, and distances are illustrative.
        </p>
      </div>
      <figcaption className="sr-only">
        An illustrative trip to {DESTINATION} in Fremont. A wheelchair user&apos;s current route
        from home detours {CURRENT_METERS} metres around a missing curb ramp. With that ramp
        repaired, the modeled route is {MODELED_METERS} metres. The streets, barrier, and distances
        are examples, not real data.
      </figcaption>
    </figure>
  );
}

function useCityTilt(isShown: boolean, isStatic: boolean) {
  const baseX = isShown ? TILT.x : 0;
  const baseZ = isShown ? TILT.z : 0;
  const tiltX = useSpring(isStatic ? TILT.x : 0, TILT_SPRING);
  const tiltZ = useSpring(isStatic ? TILT.z : 0, TILT_SPRING);
  useEffect(() => {
    if (isStatic) {
      tiltX.jump(TILT.x);
      tiltZ.jump(TILT.z);
      return;
    }
    tiltX.set(baseX);
    tiltZ.set(baseZ);
  }, [baseX, baseZ, isStatic, tiltX, tiltZ]);

  const lean = (event: PointerEvent<HTMLElement>) => {
    if (isStatic || !isShown || event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    const nx = (event.clientX - box.left) / box.width - 0.5;
    const ny = (event.clientY - box.top) / box.height - 0.5;
    tiltX.set(baseX - ny * LEAN.x * 2);
    tiltZ.set(baseZ + nx * LEAN.z * 2);
  };
  const settle = () => {
    if (isStatic) return;
    tiltX.set(baseX);
    tiltZ.set(baseZ);
  };
  return { tiltX, tiltZ, lean, settle };
}

function useCountedMeters(target: number, isStatic: boolean): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    if (isStatic) {
      fromRef.current = target;
      return;
    }
    const controls = animate(fromRef.current, target, {
      duration: COUNT_S,
      ease: "easeOut",
      onUpdate: (latest) => {
        fromRef.current = latest;
        setValue(latest);
      },
    });
    return () => controls.stop();
  }, [target, isStatic]);
  return isStatic ? target : value;
}

function PlaceLabel({ label }: { readonly label: string }) {
  return (
    <span className="rounded-md bg-surface px-2 py-1 text-xs font-semibold whitespace-nowrap text-ink shadow-lift">
      {label}
    </span>
  );
}
