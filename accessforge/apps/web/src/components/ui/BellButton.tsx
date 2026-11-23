"use client";

/**
 * Adapted from KokonutUI "Bell Button" v1.0.0 by @dorianbaffier (MIT), https://kokonutui.com.
 * Changes: controlled only, label toggle without the subscriber count, AccessForge tokens.
 */

import { type PointerEvent, useCallback, useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";

// The bell and its clapper are two pendulums on the same pivot. Nothing
// couples them but collisions: the swinging bell catches the clapper with
// its lip, flings it across, and it strikes the other side. Angles in deg,
// time in seconds.
const STEP = 1 / 240;
const BELL_STIFFNESS = 380;
const BELL_DAMPING = 5;
const CLAPPER_STIFFNESS = 150;
const CLAPPER_DAMPING = 4;
// How far the clapper can swing inside the bell before it hits the lip.
const LIP = 13;
const RESTITUTION = 0.45;
// Share of a hit that goes into the bell, which is much heavier.
const RECOIL = 0.18;
// Impacts harder than this ring out (deg/s, relative).
const STRIKE_SPEED = 260;
const RING_KICK = 600;
const NUDGE_KICK = 160;
const MUTE_KICK = 300;
const NUDGE_COOLDOWN_MS = 700;
const MAX_FRAME_S = 0.05;
const REST = 0.05;
const PIVOT = { x: 12, y: 2.5 };
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

type Sim = {
  bell: number;
  bellSpeed: number;
  clapper: number;
  clapperSpeed: number;
  // Muffled: the clapper is held against the bell and can't strike.
  muffled: boolean;
  raf: number;
  last: number;
  carry: number;
  lastNudge: number;
};

type Props = {
  readonly pressed: boolean;
  readonly onPressedChange: (pressed: boolean) => void;
  /** The accessible name; aria-pressed carries the state. */
  readonly label: string;
  readonly offText: string;
  readonly onText: string;
  readonly describedBy?: string;
};

function haptic(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
}

// Advances both pendulums one step; returns the strike side and strength on a ringing hit.
function advance(s: Sim): { side: 1 | -1; strength: number } | null {
  s.bellSpeed += (-s.bell * BELL_STIFFNESS - s.bellSpeed * BELL_DAMPING) * STEP;
  s.bell += s.bellSpeed * STEP;
  if (s.muffled) {
    s.clapper = s.bell;
    s.clapperSpeed = s.bellSpeed;
    return null;
  }
  s.clapperSpeed += (-s.clapper * CLAPPER_STIFFNESS - s.clapperSpeed * CLAPPER_DAMPING) * STEP;
  s.clapper += s.clapperSpeed * STEP;
  const relative = s.clapper - s.bell;
  if (Math.abs(relative) <= LIP) return null;
  const side = relative > 0 ? 1 : -1;
  const impact = (s.clapperSpeed - s.bellSpeed) * side;
  s.clapper = s.bell + side * LIP;
  if (impact <= 0) return null;
  s.clapperSpeed -= side * impact * (1 + RESTITUTION);
  s.bellSpeed += side * impact * RECOIL;
  return impact > STRIKE_SPEED ? { side, strength: impact / 1600 } : null;
}

// One animation frame: steps the simulation, then schedules the next frame until it rests.
function runFrame(
  s: Sim,
  now: number,
  draw: () => void,
  flare: (side: 1 | -1, strength: number) => void,
) {
  s.raf = 0;
  s.carry += s.last ? Math.min((now - s.last) / 1000, MAX_FRAME_S) : STEP;
  s.last = now;
  while (s.carry >= STEP) {
    const strike = advance(s);
    if (strike) {
      flare(strike.side, strike.strength);
      haptic(6);
    }
    s.carry -= STEP;
  }
  const energy =
    Math.abs(s.bell) +
    Math.abs(s.bellSpeed) * 0.02 +
    Math.abs(s.clapper) +
    Math.abs(s.clapperSpeed) * 0.02;
  const isResting = energy < REST;
  if (isResting) {
    Object.assign(s, { bell: 0, bellSpeed: 0, clapper: 0, clapperSpeed: 0, last: 0 });
  }
  draw();
  if (!isResting) s.raf = requestAnimationFrame((next) => runFrame(s, next, draw, flare));
}

export function BellButton({
  pressed,
  onPressedChange,
  label,
  offText,
  onText,
  describedBy,
}: Props) {
  const bellRef = useRef<SVGGElement>(null);
  const clapperRef = useRef<SVGPathElement>(null);
  const leftWaveRef = useRef<SVGPathElement>(null);
  const rightWaveRef = useRef<SVGPathElement>(null);
  const sim = useRef<Sim>({
    bell: 0,
    bellSpeed: 0,
    clapper: 0,
    clapperSpeed: 0,
    muffled: !pressed,
    raf: 0,
    last: 0,
    carry: 0,
    lastNudge: 0,
  });
  const reduceMotion = usePrefersReducedMotion();

  const draw = useCallback(() => {
    const s = sim.current;
    bellRef.current?.setAttribute(
      "transform",
      `rotate(${s.bell.toFixed(2)} ${PIVOT.x} ${PIVOT.y})`,
    );
    clapperRef.current?.setAttribute(
      "transform",
      `rotate(${s.clapper.toFixed(2)} ${PIVOT.x} ${PIVOT.y})`,
    );
  }, []);

  // Two short arcs flare out on the side that was struck.
  const flare = useCallback((side: 1 | -1, strength: number) => {
    const wave = side > 0 ? rightWaveRef.current : leftWaveRef.current;
    if (!wave?.animate) return;
    wave.animate(
      [
        { opacity: Math.min(1, 0.45 + strength * 0.55), transform: "translateX(0px)" },
        { opacity: 0, transform: `translateX(${side * 3}px)` },
      ],
      { duration: 420, easing: EASE_OUT },
    );
  }, []);

  const kick = useCallback(
    (speed: number) => {
      const s = sim.current;
      if (reduceMotion) return;
      s.bellSpeed += speed;
      if (!s.raf) s.raf = requestAnimationFrame((now) => runFrame(s, now, draw, flare));
    },
    [draw, flare, reduceMotion],
  );

  useEffect(() => {
    const s = sim.current;
    return () => {
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, []);

  useEffect(() => {
    sim.current.muffled = !pressed;
  }, [pressed]);

  function handleClick() {
    const s = sim.current;
    if (!pressed) {
      s.muffled = false;
      // Swing the bell away from the clapper so the first hit rings.
      kick(s.bellSpeed >= 0 ? RING_KICK : -RING_KICK);
      if (reduceMotion) {
        flare(1, 0.6);
        flare(-1, 0.6);
      }
      haptic(10);
    } else {
      // Off: a dull shake, the clapper held still against the bell.
      s.muffled = true;
      kick(-MUTE_KICK);
    }
    onPressedChange(!pressed);
  }

  // A brush past the bell sets it swaying a little. Mouse only: on touch, enter fires right
  // before the tap.
  function handlePointerEnter(event: PointerEvent) {
    const s = sim.current;
    if (event.pointerType !== "mouse" || s.muffled) return;
    if (event.timeStamp - s.lastNudge < NUDGE_COOLDOWN_MS) return;
    s.lastNudge = event.timeStamp;
    kick(s.bellSpeed >= 0 ? NUDGE_KICK : -NUDGE_KICK);
  }

  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-describedby={describedBy}
      onClick={handleClick}
      onPointerEnter={handlePointerEnter}
      className={`inline-flex min-h-11 items-center gap-2.5 rounded-full border px-4 text-sm font-semibold transition-colors duration-200 ease-out select-none ${
        pressed
          ? "border-accent bg-accent text-surface hover:bg-accent-hover"
          : "border-control bg-surface text-ink hover:border-ink"
      }`}
    >
      <svg
        aria-hidden="true"
        className="size-5 overflow-visible"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path ref={rightWaveRef} className="opacity-0" d="M21.5 4.5c1.2 1.6 1.8 3.4 1.8 5.5" />
        <path ref={leftWaveRef} className="opacity-0" d="M2.5 4.5C1.3 6.1.7 7.9.7 10" />
        <path ref={clapperRef} d="M10.27 21a2 2 0 0 0 3.46 0" />
        <g ref={bellRef}>
          <path
            className={`transition-[fill] duration-200 ease-out ${pressed ? "fill-current" : "fill-transparent"}`}
            d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33"
          />
          {/* The mute slash, drawn across when off. */}
          <path
            className="transition-[stroke-dashoffset] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
            d="M3 3l18 18"
            strokeDasharray="26"
            strokeDashoffset={pressed ? 26 : 0}
          />
        </g>
      </svg>
      <span className="sr-only">{label}</span>
      {/* Both texts share one grid cell so the button keeps its width while they cross-fade. */}
      <span aria-hidden="true" className="relative grid">
        {[
          { key: "off", isOn: !pressed, text: offText },
          { key: "on", isOn: pressed, text: onText },
        ].map((line) => (
          <span
            key={line.key}
            className={`col-start-1 row-start-1 whitespace-nowrap transition-[opacity,filter] duration-200 ease-out motion-reduce:transition-none ${
              line.isOn ? "opacity-100 blur-0" : "opacity-0 blur-[2px]"
            }`}
          >
            {line.text}
          </span>
        ))}
      </span>
    </button>
  );
}
