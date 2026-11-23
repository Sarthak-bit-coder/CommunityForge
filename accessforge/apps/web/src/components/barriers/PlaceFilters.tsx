import type { DestinationCounts } from "./map-destinations";
import { DESTINATION_TYPES, type DestinationTypeId } from "./place-types";

export type PlaceFiltersProps = {
  /** How many places of each type are in the current map view (recounted when the map settles). */
  readonly places: DestinationCounts;
  /** Place types switched off the map. */
  readonly hiddenTypes: readonly DestinationTypeId[];
  readonly onToggleType: (id: DestinationTypeId) => void;
  readonly onShowOnlyType: (id: DestinationTypeId) => void;
  readonly onShowAllTypes: () => void;
};

// Each place type is a switch: pressed shows it on the map. A switched-off type keeps its count
// but loses its colour, gets a dashed outline, and is struck through, so the state never rests
// on colour alone (WCAG 1.4.1).
export function PlaceFilters({
  places,
  hiddenTypes,
  onToggleType,
  onShowOnlyType,
  onShowAllTypes,
}: PlaceFiltersProps) {
  const shownCount = DESTINATION_TYPES.length - hiddenTypes.length;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">Places people travel to</p>
          <p className="text-muted">Counts show places in the current map view.</p>
        </div>
        <button
          type="button"
          onClick={onShowAllTypes}
          disabled={hiddenTypes.length === 0}
          className="min-h-8 rounded-lg px-2 font-semibold text-accent underline-offset-2 hover:underline disabled:cursor-default disabled:text-muted disabled:no-underline"
        >
          Show all
        </button>
      </div>
      <ul aria-label="Place types on the map" className="mt-2 flex flex-wrap gap-2">
        {DESTINATION_TYPES.map((type) => (
          <PlaceChip
            key={type.id}
            label={type.label}
            color={type.color}
            isStop={type.id === "transit"}
            count={places[type.id]}
            isShown={!hiddenTypes.includes(type.id)}
            onToggle={() => onToggleType(type.id)}
            onShowOnly={() => onShowOnlyType(type.id)}
          />
        ))}
      </ul>
      <p className="mt-2 min-h-10" aria-live="polite">
        {shownCount === DESTINATION_TYPES.length
          ? "Press a type to hide it from the map, or Only to show it alone."
          : `Showing ${shownCount} of ${DESTINATION_TYPES.length} place types on the map.`}
        <span className="hidden [@media(hover:hover)]:inline">
          {" "}
          Point at a coloured place to see its name and the nearest reported barrier.
        </span>
      </p>
    </div>
  );
}

type PlaceChipProps = {
  readonly label: string;
  readonly color: string;
  readonly isStop: boolean;
  readonly count: number;
  readonly isShown: boolean;
  readonly onToggle: () => void;
  readonly onShowOnly: () => void;
};

function PlaceChip({ label, color, isStop, count, isShown, onToggle, onShowOnly }: PlaceChipProps) {
  const frame = isShown
    ? "border-solid border-line bg-surface"
    : "border-dashed border-control bg-canvas";
  return (
    <li className={`flex items-stretch overflow-hidden rounded-lg border ${frame}`}>
      <button
        type="button"
        aria-pressed={isShown}
        onClick={onToggle}
        className="flex min-h-9 items-center gap-2 py-1 pr-2.5 pl-1.5 transition-colors duration-150 hover:bg-canvas"
      >
        {/* The name comes from the visible text plus hidden words: "Healthcare, 12 in this view". */}
        <PlaceSwatch color={color} isStop={isStop} isShown={isShown} />
        <span
          className={`font-semibold ${isShown ? "text-ink" : "text-muted line-through decoration-2"}`}
        >
          {label}
        </span>
        <span className="sr-only">{`, ${count} in this view`}</span>
        <span
          aria-hidden="true"
          className="min-w-6 rounded-full bg-canvas px-1.5 text-center font-semibold text-ink tabular-nums"
        >
          {count}
        </span>
      </button>
      <button
        type="button"
        aria-label={`Show only ${label}`}
        onClick={onShowOnly}
        className="border-l border-line px-2 font-semibold text-muted transition-colors duration-150 hover:bg-canvas hover:text-ink"
      >
        Only
      </button>
    </li>
  );
}

// A tiny isometric building in the place colour; transit stops are dots on the map, so a dot here.
// Switched off, it turns to an outline.
function PlaceSwatch({
  color,
  isStop,
  isShown,
}: {
  readonly color: string;
  readonly isStop: boolean;
  readonly isShown: boolean;
}) {
  const fill = isShown ? color : "none";
  const stroke = isShown ? "white" : "currentColor";
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 shrink-0 text-muted">
      {isStop ? (
        <circle cx="10" cy="10" r="6" fill={fill} stroke={stroke} strokeWidth="2" />
      ) : (
        <g stroke={stroke} strokeWidth={isShown ? 0.75 : 1.25} strokeLinejoin="round">
          <path d="M10 3 L17 6.5 L10 10 L3 6.5 Z" fill={fill} />
          <path d="M3 6.5 L10 10 L10 17.5 L3 14 Z" fill={fill} opacity="0.75" />
          <path d="M17 6.5 L10 10 L10 17.5 L17 14 Z" fill={fill} opacity="0.55" />
        </g>
      )}
    </svg>
  );
}
