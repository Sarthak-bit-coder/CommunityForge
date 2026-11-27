import type { ExpressionSpecification } from "maplibre-gl";

// Places an accessible trip has to end at, grouped by the OpenStreetMap `poi` classes they cover.
// A building holding one of these places is coloured by type, the whole footprint at once.
// `hover` is a deeper shade of the same hue, so pointing at a building never changes its meaning.
export const DESTINATION_TYPES = [
  {
    id: "health",
    label: "Healthcare",
    color: "#d6455d",
    hover: "#9e2238",
    classes: ["hospital", "pharmacy", "dentist", "doctors"],
  },
  {
    id: "education",
    label: "Schools",
    color: "#2f6fd6",
    hover: "#1d4a9a",
    classes: ["school", "college", "kindergarten"],
  },
  {
    id: "community",
    label: "Libraries and civic",
    color: "#8e5bd1",
    hover: "#5f3497",
    classes: ["library", "town_hall", "post", "community_centre"],
  },
  { id: "food", label: "Groceries", color: "#e08a1e", hover: "#a35d07", classes: ["grocery"] },
  {
    id: "transit",
    label: "Transit stops",
    color: "#1b2b45",
    hover: "#3a5277",
    classes: ["bus", "railway"],
  },
] as const;

export type DestinationType = (typeof DESTINATION_TYPES)[number];
export type DestinationTypeId = DestinationType["id"];

/** Feature-state key set on the place under the pointer. */
export const HOVER_STATE = "hover";
const FALLBACK_COLOR = "#7b8698";

// The spec's tuple types cannot express a spread of label/value pairs, hence the cast.
function matchType(pick: (type: DestinationType) => string): ExpressionSpecification {
  return [
    "match",
    ["get", "type"],
    ...DESTINATION_TYPES.flatMap((type) => [type.id, pick(type)]),
    FALLBACK_COLOR,
  ] as unknown as ExpressionSpecification;
}

/** A place's colour from its `type` property: a deeper shade while pointed at. */
export const PLACE_COLOR: ExpressionSpecification = [
  "case",
  ["boolean", ["feature-state", HOVER_STATE], false],
  matchType((type) => type.hover),
  matchType((type) => type.color),
];
