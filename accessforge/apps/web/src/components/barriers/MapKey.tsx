import type { ReactNode } from "react";
import { PlaceFilters, type PlaceFiltersProps } from "./PlaceFilters";
import { BUILDING_RAMP, HEIGHT_SCALE } from "./map-flyover";
import { REACH_M } from "./map-interactions";

// The map draws in WebGL, so this key is the text equivalent of its layers. Every swatch pairs
// colour with a label, and lines differ by shape too (solid, dashed, ring) (WCAG 1.4.1).
const RAMP_GRADIENT = `linear-gradient(90deg, ${BUILDING_RAMP.map(([, color]) => color).join(", ")})`;

type MapKeyProps = PlaceFiltersProps & {
  /** Whether selecting a barrier on this map lights up the footpaths around it. */
  readonly showsReach: boolean;
  /** Basemap provider named in the attribution line. */
  readonly provider: string;
};

export function MapKey({ showsReach, provider, ...filters }: MapKeyProps) {
  return (
    <div className="text-xs leading-relaxed text-muted">
      <PlaceFilters {...filters} />
      <ul aria-label="Map key" className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
        <KeyItem label="Footpath">
          <line x1="2" x2="26" y1="6" y2="6" strokeWidth="6" className="stroke-accent/25" />
          <line x1="2" x2="26" y1="6" y2="6" strokeWidth="2.5" className="stroke-accent" />
        </KeyItem>
        <KeyItem label="Stairs, not step-free">
          <line
            x1="2"
            x2="26"
            y1="6"
            y2="6"
            strokeWidth="3"
            strokeDasharray="4 3"
            className="stroke-warning"
          />
        </KeyItem>
        {showsReach ? (
          <KeyItem label={`Footpaths within ${REACH_M} m of the selected barrier`}>
            <circle
              cx="8"
              cy="6"
              r="5"
              strokeWidth="1.5"
              className="fill-marker/20 stroke-warning"
            />
            <line x1="15" x2="26" y1="6" y2="6" strokeWidth="3" className="stroke-marker" />
          </KeyItem>
        ) : null}
        <li className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-2.5 w-7 rounded-sm"
            style={{ background: RAMP_GRADIENT }}
          />
          <span>Other buildings</span>
        </li>
      </ul>
      <p className="mt-1.5">
        Places, paths, and buildings: OpenStreetMap data via {provider}. They can be missing or out
        of date, and mapped paths are not verified accessible routes. Building heights are drawn{" "}
        {HEIGHT_SCALE} times taller than mapped, so the 3D view is easier to read.
      </p>
    </div>
  );
}

function KeyItem({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <svg
        aria-hidden="true"
        viewBox="0 0 28 12"
        className="h-3 w-7 shrink-0 fill-none"
        strokeLinecap="round"
      >
        {children}
      </svg>
      <span>{label}</span>
    </li>
  );
}
