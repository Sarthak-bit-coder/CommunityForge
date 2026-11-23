"use client";

import { AnimatePresence, m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { seededRandom } from "@/components/home/confetti-pieces";
import { HomeMapPreview } from "@/components/home/HomeMapPreview";
import {
  MOTION_DURATION_S,
  MOTION_EASE_ENTER,
  MOTION_EXIT_TRANSITION,
  MOTION_OFFSET_PX,
} from "@/components/motion/motion-tokens";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";
import { useStepScroll } from "@/components/motion/use-step-scroll";
import type { ParticleScene } from "./particle-scene";
import { drawBlockedScene, drawOpenScene, drawRepairScene, drawTripScene } from "./story-pictures";

// The planner's opening story, told in particles: a wheelchair user's trip to Washington Hospital
// stops at a curb with no ramp, the planner picks that repair, the trip opens, and the story moves
// on to the live map of the pilot area the planner works on. Like the overview's repair story, the
// stage locks in when it reaches the top of the view; each scroll gesture then plays exactly one
// part, and the next gesture waits until the particles have fully settled. Past the last part the
// page scrolls on.

type SceneStatus = "loading" | "ready" | "error";

// Fixed so the globe's spin and the particles' drift are the same on every visit.
const PARTICLE_SEED = 20_260_418;
// The particle morph decides when a part is done (see isBusy), so no extra time lock is needed.
const STEP_LOCK_MS = 0;

const STORY = [
  {
    title: "A short trip",
    text: "A resident who uses a wheelchair has an appointment at Washington Hospital, just across the street.",
  },
  {
    title: "The curb stops it",
    text: "At the corner the curb has no ramp. The trip ends here, and the next way around is far longer.",
  },
  {
    title: "One repair, ranked first",
    text: "The repair planner looks across the whole network and ranks this ramp first: one fix reopens many trips.",
  },
  {
    title: "The way is open",
    text: "With ramps at both curbs, the modeled route to the hospital is open.",
  },
] as const;
// The last part shows the live map instead of a particle picture.
const NETWORK = {
  title: "Every corner like it",
  text: "This is the pilot area the planner works on, mapped in OpenStreetMap. Every barrier on it is a corner like that one.",
} as const;

type StoryPart = { readonly title: string; readonly text: string };

/** The planner section right after the story (app/planner/page.tsx). */
export const PLANNER_ID = "repair-planner";

export function AccessStory() {
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<ParticleScene | null>(null);
  const isMorphingRef = useRef(false);
  // The picture the particles currently form; the scene starts on the first one.
  const shownRef = useRef(0);
  const isStatic = usePrefersReducedMotion();
  const [status, setStatus] = useState<SceneStatus>("loading");
  const [hasStarted, setHasStarted] = useState(false);
  const [step, setStep] = useState(0);

  const parts: readonly StoryPart[] = [...STORY, NETWORK];
  const showsMap = step === parts.length - 1;

  useStepScroll({
    trackRef,
    index: step,
    count: parts.length,
    onStep: (next) => {
      // Marked busy before React re-renders, so a second gesture right behind this one waits.
      // The map part has no particle picture, so it plays no morph to wait for.
      if (sceneRef.current && next < STORY.length) isMorphingRef.current = true;
      setStep(next);
    },
    onEngage: () => setHasStarted(true),
    stepLockMs: STEP_LOCK_MS,
    isBusy: () => isMorphingRef.current,
    // Scrolling back up past the map must not replay the particles in reverse.
    isOneWay: true,
  });

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const controller = new AbortController();

    async function start(stageElement: HTMLElement, canvasElement: HTMLCanvasElement) {
      const pictures = [drawTripScene(), drawBlockedScene(), drawRepairScene(), drawOpenScene()];
      // three.js is loaded only here, so other pages and the planner's first paint skip it.
      const { startParticleScene } = await import("./particle-scene");
      if (controller.signal.aborted) return;
      const scene = await startParticleScene({
        canvas: canvasElement,
        stage: stageElement,
        pictures,
        isStatic,
        seed: seededRandom(PARTICLE_SEED),
      });
      if (controller.signal.aborted) {
        scene.dispose();
        return;
      }
      sceneRef.current = scene;
      shownRef.current = 0;
      setStatus("ready");
    }

    start(stage, canvas).catch((error: unknown) => {
      console.error("Access story scene failed to start", error);
      if (!controller.signal.aborted) setStatus("error");
    });
    return () => {
      controller.abort();
      sceneRef.current?.dispose();
      sceneRef.current = null;
      isMorphingRef.current = false;
    };
  }, [isStatic]);

  // Each step plays one full morph. Scrolling is held (isBusy) until the particles settle.
  useEffect(() => {
    const scene = sceneRef.current;
    if (status !== "ready" || !scene || step >= STORY.length || shownRef.current === step) {
      isMorphingRef.current = false;
      return;
    }
    shownRef.current = step;
    scene
      .goTo(step)
      .catch((error: unknown) => console.error("Access story scene failed to move", error))
      .finally(() => {
        isMorphingRef.current = false;
      });
  }, [step, status]);

  const hint = !hasStarted
    ? "Scroll to start. Each scroll plays one part of the story."
    : showsMap
      ? "Drag the map or use + and − to explore. Keep scrolling to continue to the planner."
      : "Scroll again for the next part.";

  return (
    // No scroll anchoring: the stage changes height when the map swaps in, and the browser would
    // otherwise shift the locked page to compensate.
    <div ref={trackRef} className="relative h-svh [overflow-anchor:none]">
      <div className="grid h-full content-center gap-6 py-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-12">
        {/* The map's key makes the figure taller, so it glides to its new centre, not jumps. */}
        <m.figure
          layout="position"
          transition={{ duration: MOTION_DURATION_S.slow, ease: MOTION_EASE_ENTER }}
          className="mx-auto w-full max-w-[calc((100svh_-_18rem)*1.5)] lg:order-last lg:max-w-[calc((100svh_-_6rem)*1.5)]"
        >
          {showsMap && (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: MOTION_DURATION_S.slow, ease: MOTION_EASE_ENTER }}
            >
              {/* Same 3:2 box as the particle picture, so the map lands where the picture was.
                  On short windows it gets shorter: the key and summary below take ~25rem, and
                  the whole stage must fit one screen or it spills into the sections around it. */}
              <HomeMapPreview
                mapClassName="aspect-[3/2] max-h-[calc(100svh_-_25rem)] w-full"
                isWheelZoomOff
              />
            </m.div>
          )}
          {/* Hidden, not removed, under the map: the scene keeps running for scrolling back. */}
          <div
            ref={stageRef}
            className={`relative aspect-[3/2] w-full overflow-hidden rounded-2xl border border-line bg-canvas shadow-lift ${showsMap ? "hidden" : ""}`}
          >
            <canvas ref={canvasRef} aria-hidden="true" className="block size-full" />
            {status !== "ready" && (
              <p
                role="status"
                className="pointer-events-none absolute inset-x-0 top-0 p-6 text-center text-sm text-muted"
              >
                {status === "loading"
                  ? "Loading the story…"
                  : "This browser cannot show the animated story. The story reads the same as text; the planner below works the same."}
              </p>
            )}
            <StepDots count={parts.length} step={step} />
          </div>
          <figcaption className={`mt-2 text-xs text-muted ${showsMap ? "hidden" : ""}`}>
            An illustrative story, not a real report.
          </figcaption>
        </m.figure>
        {/* Top-aligned with the picture or map, and glides with it. */}
        <m.div
          layout="position"
          transition={{ duration: MOTION_DURATION_S.slow, ease: MOTION_EASE_ENTER }}
          className="flex flex-col gap-4"
        >
          <CurrentPart part={parts[step] ?? parts[0]} index={step} count={parts.length} />
          <p aria-live="polite" className="text-sm text-muted">
            {hint}
          </p>
          {showsMap && <StoryRecap />}
        </m.div>
      </div>
      <StoryList parts={parts} step={step} />
    </div>
  );
}

// Shown beside the map once the story is done (it does not replay): the parts so far, and a
// direct way on to the planner. The titles are a visual copy; StoryList holds the text.
function StoryRecap() {
  function goToPlanner() {
    const planner = document.getElementById(PLANNER_ID);
    // Focus moves out of the story, which releases the locked page (see useStepScroll).
    planner?.focus({ preventScroll: true });
    planner?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return (
    <m.div
      initial={{ opacity: 0, y: MOTION_OFFSET_PX }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION_DURATION_S.slow, ease: MOTION_EASE_ENTER, delay: 0.2 }}
      className="mt-4 flex flex-col gap-6 border-t border-line pt-6"
    >
      <ol aria-hidden="true" className="flex flex-col gap-3">
        {STORY.map((part, index) => (
          <li key={part.title} className="flex items-center gap-3 text-sm text-ink">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent tabular-nums">
              {index + 1}
            </span>
            {part.title}
          </li>
        ))}
      </ol>
      <button type="button" onClick={goToPlanner} className="af-button-primary self-start">
        Go to the planner
      </button>
    </m.div>
  );
}

// One dot per part; the current one stretches. Decorative: the list says where the story is.
function StepDots({ count, step }: { readonly count: number; readonly step: number }) {
  return (
    <ol aria-hidden="true" className="absolute right-4 bottom-4 flex gap-1.5">
      {Array.from({ length: count }, (_, index) => (
        <li
          key={index}
          className={`h-1.5 rounded-full transition-all duration-300 ${index === step ? "w-6 bg-accent" : "w-1.5 bg-ink/25"}`}
        />
      ))}
    </ol>
  );
}

// The part being shown, swapped in as each step plays. A visual copy: the list holds the text.
function CurrentPart({
  part,
  index,
  count,
}: {
  readonly part: StoryPart;
  readonly index: number;
  readonly count: number;
}) {
  return (
    <div aria-hidden="true">
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={part.title}
          initial={{ opacity: 0, y: MOTION_OFFSET_PX }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -MOTION_OFFSET_PX / 2, transition: MOTION_EXIT_TRANSITION }}
          transition={{ duration: MOTION_DURATION_S.slow, ease: MOTION_EASE_ENTER }}
          className="flex flex-col gap-3"
        >
          <span className="text-sm font-semibold text-accent tabular-nums">
            {index + 1} of {count}
          </span>
          <p className="text-2xl font-semibold text-balance text-ink">{part.title}</p>
          <p className="max-w-prose text-lg leading-relaxed text-ink">{part.text}</p>
        </m.div>
      </AnimatePresence>
    </div>
  );
}

// The whole story as text for screen readers, with the part on screen marked current.
function StoryList({
  parts,
  step,
}: {
  readonly parts: readonly StoryPart[];
  readonly step: number;
}) {
  return (
    <ol className="sr-only">
      {parts.map((part, index) => (
        <li key={part.title} aria-current={index === step ? "step" : undefined}>
          <h3>{part.title}</h3>
          <p>{part.text}</p>
        </li>
      ))}
    </ol>
  );
}
