import { SCENARIOS, type Scenario } from "./repair-scenarios";

// Every explanation, always in the document. The scroll stage keeps this list for assistive tech
// and shows an animated copy of the current step.
export function StoryStepList({
  scenario,
  className = "",
}: {
  readonly scenario: Scenario;
  readonly className?: string;
}) {
  return (
    <ol className={className}>
      {SCENARIOS.map((item) => {
        const isActive = item.id === scenario.id;
        return (
          <li
            key={item.id}
            aria-current={isActive ? "step" : undefined}
            className={`border-l-4 py-4 pl-5 transition-colors duration-300 ${
              isActive ? "border-marker" : "border-line"
            }`}
          >
            <h3 className="font-display text-xl font-semibold text-ink">{item.label}</h3>
            <p className={`mt-2 text-lg leading-relaxed ${isActive ? "text-ink" : "text-muted"}`}>
              {item.detail}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
