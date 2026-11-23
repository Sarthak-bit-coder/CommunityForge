"use client";

import { domMax } from "motion/react";
import { useId, useState, useSyncExternalStore } from "react";
import { MotionRoot } from "@/components/motion/MotionRoot";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";
import { RepairRouteFigure } from "./RepairRouteFigure";
import { SCENARIOS, type Scenario } from "./repair-scenarios";
import { StoryStepList } from "./StoryStepList";
import { ScenarioPicker } from "./ScenarioPicker";
import { ScrollStage } from "./ScrollStage";

// Scroll steps through the story only where the stage fits on screen, with a mouse or trackpad,
// and with motion allowed. Touch scrolling keeps its native momentum, so touch screens and
// everywhere else get the radio buttons.
export const STAGE_QUERY =
  "(min-width: 48rem) and (min-height: 40rem) and (hover: hover) and (pointer: fine)";

export function RepairStory() {
  const [scenario, setScenario] = useState<Scenario>(SCENARIOS[0]);
  const name = useId();
  const fitsStage = useMediaQuery(STAGE_QUERY);
  const reduceMotion = usePrefersReducedMotion();

  return (
    <MotionRoot features={domMax}>
      {fitsStage && !reduceMotion ? (
        <ScrollStage name={name} scenario={scenario} onScenario={setScenario} />
      ) : (
        <StackedStory name={name} scenario={scenario} onScenario={setScenario} />
      )}
    </MotionRoot>
  );
}

type StoryProps = {
  readonly name: string;
  readonly scenario: Scenario;
  readonly onScenario: (scenario: Scenario) => void;
};

// Buttons drive the story; the figure plays a timed run for each pick.
function StackedStory({ name, scenario, onScenario }: StoryProps) {
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-14">
      <div>
        <ScenarioPicker name={name} scenario={scenario} onChange={onScenario} />
        <StoryStepList scenario={scenario} className="mt-6" />
      </div>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <RepairRouteFigure fixed={scenario.fixed} summary={scenario.summary} />
      </div>
    </div>
  );
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia?.(query);
      list?.addEventListener("change", onChange);
      return () => list?.removeEventListener("change", onChange);
    },
    () => window.matchMedia?.(query).matches ?? false,
    // Server and first paint: the stacked layout, driven by the buttons.
    () => false,
  );
}
