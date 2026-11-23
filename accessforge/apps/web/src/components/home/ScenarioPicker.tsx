"use client";

import { m } from "motion/react";
import { MOTION_SPRING } from "@/components/motion/motion-tokens";
import { SCENARIOS, type Scenario } from "./repair-scenarios";

export function ScenarioPicker({
  name,
  scenario,
  onChange,
}: {
  readonly name: string;
  readonly scenario: Scenario;
  readonly onChange: (scenario: Scenario) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-bold text-ink">Choose a scenario</legend>
      <div className="mt-3 inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
        {SCENARIOS.map((item) => {
          const isChecked = item.id === scenario.id;
          return (
            <label
              key={item.id}
              className={`relative flex min-h-11 cursor-pointer items-center rounded-lg px-4 text-sm font-semibold transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                isChecked ? "text-surface" : "text-ink hover:bg-canvas"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={item.id}
                checked={isChecked}
                onChange={() => onChange(item)}
                className="sr-only"
              />
              {isChecked ? (
                <m.span
                  layoutId={`${name}-pill`}
                  transition={MOTION_SPRING}
                  aria-hidden="true"
                  className="absolute inset-0 rounded-lg bg-ink"
                />
              ) : null}
              <span className="relative">{item.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
