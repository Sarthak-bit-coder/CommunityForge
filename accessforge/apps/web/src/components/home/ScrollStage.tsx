"use client";

import {
  AnimatePresence,
  type MotionValue,
  animate,
  m,
  useMotionValue,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  MOTION_DURATION_S,
  MOTION_EASE_ENTER,
  MOTION_EXIT_TRANSITION,
  MOTION_SPRING,
} from "@/components/motion/motion-tokens";
import { RepairRouteFigure } from "./RepairRouteFigure";
import { SCENARIOS, type Scenario } from "./repair-scenarios";
import { ScenarioPicker } from "./ScenarioPicker";
import { StoryStepList } from "./StoryStepList";
import { useStepScroll } from "@/components/motion/use-step-scroll";

// Each step plays its share of the story: the new ramp pours, the traveler rolls, then it stops
// at the next blocked curb or reaches the clinic. Linear here; the figure eases each move.
const STEP_PLAY_S = 1.8;
// The next gesture is held until most of the step has played, so steps never pile up.
const STEP_LOCK_MS = STEP_PLAY_S * 1000 * 0.8;
const STEP_ENDS = SCENARIOS.map((_, index) => (index + 1) / SCENARIOS.length);
// Words of the current step rise in one after another, fast enough to read along.
const WORD_STAGGER_S = 0.022;
const WORD_RISE_PX = 12;
// The stage must fit one screen, so the drawing gives way first on short windows: its width is
// capped so its height plus everything around it (counter, bars, caption, text, hint, spacing)
// never exceeds the view. Drawing aspect is 560:196; 3rem is the figure's side padding.
const STAGE_CHROME_REM = 30;
const DRAWING_ASPECT = 560 / 196;
const FIGURE_MAX_WIDTH = `calc((100vh - ${STAGE_CHROME_REM}rem) * ${DRAWING_ASPECT.toFixed(3)} + 3rem)`;

type ScrollStageProps = {
  readonly name: string;
  readonly scenario: Scenario;
  readonly onScenario: (scenario: Scenario) => void;
};

// The stage locks in when it reaches the top of the view. From then on each scroll gesture,
// however small or large, plays exactly one step; past the last step the page scrolls on.
export function ScrollStage({ name, scenario, onScenario }: ScrollStageProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const progress = useMotionValue(0);
  const [hasStarted, setHasStarted] = useState(false);
  const index = SCENARIOS.indexOf(scenario);
  const isLast = index === SCENARIOS.length - 1;

  useStepScroll({
    trackRef,
    index,
    count: SCENARIOS.length,
    onStep: (next) => onScenario(SCENARIOS[next]),
    onEngage: () => setHasStarted(true),
    stepLockMs: STEP_LOCK_MS,
  });

  // Play from wherever the story is to the end of the current step, so a step changed mid-play
  // carries on smoothly in either direction.
  useEffect(() => {
    if (!hasStarted) return;
    const target = STEP_ENDS[index];
    const shares = Math.abs(target - progress.get()) * SCENARIOS.length;
    const controls = animate(progress, target, { duration: shares * STEP_PLAY_S, ease: "linear" });
    return () => controls.stop();
  }, [hasStarted, index, progress]);

  function pick(next: Scenario) {
    setHasStarted(true);
    onScenario(next);
  }

  const hint = !hasStarted
    ? "Scroll to start. Each scroll plays one step."
    : isLast
      ? "Keep scrolling to continue down the page."
      : "Scroll again for the next step.";

  return (
    <div ref={trackRef} className="relative h-screen">
      <div className="flex h-full flex-col justify-center gap-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <StepCounter index={index} />
          <ScenarioPicker name={name} scenario={scenario} onChange={pick} />
        </div>
        <SegmentedProgress progress={progress} />
        <div className="w-full" style={{ maxWidth: FIGURE_MAX_WIDTH }}>
          <RepairRouteFigure
            fixed={scenario.fixed}
            summary={scenario.summary}
            progress={progress}
          />
        </div>
        <StepText scenario={scenario} />
        <Hint text={hint} />
      </div>
      <StoryStepList scenario={scenario} className="sr-only" />
    </div>
  );
}

// "01 / 03": the step number rolls over as the step changes. Decorative; the list says it.
function StepCounter({ index }: { readonly index: number }) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    <p aria-hidden="true" className="flex items-baseline gap-2 font-display tabular-nums">
      <span className="relative inline-flex h-[1em] overflow-hidden text-6xl font-semibold leading-none text-ink">
        <AnimatePresence initial={false} mode="popLayout">
          <m.span
            key={index}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%", transition: MOTION_EXIT_TRANSITION }}
            transition={MOTION_SPRING}
          >
            {pad(index + 1)}
          </m.span>
        </AnimatePresence>
      </span>
      <span className="text-xl text-muted">/ {pad(SCENARIOS.length)}</span>
    </p>
  );
}

// One bar per step, each filling while its step plays. Scale only.
function SegmentedProgress({ progress }: { readonly progress: MotionValue<number> }) {
  return (
    <div aria-hidden="true" className="flex gap-2">
      {SCENARIOS.map((item, index) => (
        <ProgressSegment key={item.id} progress={progress} index={index} />
      ))}
    </div>
  );
}

function ProgressSegment({
  progress,
  index,
}: {
  readonly progress: MotionValue<number>;
  readonly index: number;
}) {
  const share = 1 / SCENARIOS.length;
  const fill = useTransform(progress, [index * share, (index + 1) * share], [0, 1]);
  return (
    <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
      <m.div className="h-full origin-left rounded-full bg-marker" style={{ scaleX: fill }} />
    </div>
  );
}

// The current step's explanation, revealed word by word. A visual copy: the list holds the text.
function StepText({ scenario }: { readonly scenario: Scenario }) {
  const words = scenario.detail.split(" ");
  return (
    <div aria-hidden="true" className="min-h-[7.5rem]">
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={scenario.id}
          exit={{ opacity: 0, y: -WORD_RISE_PX / 2, transition: MOTION_EXIT_TRANSITION }}
          className="max-w-[62ch]"
        >
          <p className="font-display text-2xl font-semibold text-ink">{scenario.label}</p>
          <p className="mt-2 text-lg leading-relaxed text-ink">
            {words.map((word, index) => (
              <m.span
                key={`${index}-${word}`}
                className="inline-block whitespace-pre"
                initial={{ opacity: 0, y: WORD_RISE_PX }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: index * WORD_STAGGER_S,
                  duration: MOTION_DURATION_S.slow,
                  ease: MOTION_EASE_ENTER,
                }}
              >
                {index < words.length - 1 ? `${word} ` : word}
              </m.span>
            ))}
          </p>
        </m.div>
      </AnimatePresence>
    </div>
  );
}

// What the next scroll will do. Announced politely so keyboard users hear it too.
function Hint({ text }: { readonly text: string }) {
  return (
    <p aria-live="polite" className="relative h-5 text-sm text-muted">
      <AnimatePresence initial={false} mode="wait">
        <m.span
          key={text}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: MOTION_EXIT_TRANSITION }}
          transition={{ duration: MOTION_DURATION_S.interactive }}
        >
          {text}
        </m.span>
      </AnimatePresence>
    </p>
  );
}
