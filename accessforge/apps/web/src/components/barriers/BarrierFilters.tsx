import {
  ALL,
  BARRIER_TYPES,
  BARRIER_TYPE_LABELS,
  STATE_DISPLAY,
  VERIFICATION_STATES,
  type BarrierFilter,
  type BarrierType,
  type VerificationState,
} from "@/lib/barriers";

type BarrierFiltersProps = {
  readonly filter: BarrierFilter;
  readonly onChange: (filter: BarrierFilter) => void;
};

export function BarrierFilters({ filter, onChange }: BarrierFiltersProps) {
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      <legend className="sr-only">Filter barriers</legend>
      <label className="af-label">
        Barrier type
        <select
          className="af-select"
          value={filter.type}
          onChange={(event) =>
            onChange({ ...filter, type: event.target.value as BarrierType | typeof ALL })
          }
        >
          <option value={ALL}>All types</option>
          {BARRIER_TYPES.map((type) => (
            <option key={type} value={type}>
              {BARRIER_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>
      <label className="af-label">
        Verification status
        <select
          className="af-select"
          value={filter.state}
          onChange={(event) =>
            onChange({ ...filter, state: event.target.value as VerificationState | typeof ALL })
          }
        >
          <option value={ALL}>All statuses</option>
          {VERIFICATION_STATES.map((state) => (
            <option key={state} value={state}>
              {STATE_DISPLAY[state].label}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}
