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

const SELECT_CLASS =
  "mt-1 block min-h-11 w-full rounded-md border border-muted bg-surface px-3 text-ink";

export function BarrierFilters({ filter, onChange }: BarrierFiltersProps) {
  return (
    <fieldset className="grid gap-4 sm:grid-cols-2">
      <legend className="mb-2 text-lg font-semibold text-ink">Filter barriers</legend>
      <label className="block font-medium text-ink">
        Barrier type
        <select
          className={SELECT_CLASS}
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
      <label className="block font-medium text-ink">
        Verification status
        <select
          className={SELECT_CLASS}
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
