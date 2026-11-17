import type { Barrier, LngLat } from "./barriers";

// FICTIONAL SAMPLE DATA. None of these barriers, streets, reports, or dates are real.
// They exist only to demonstrate the map and list until real data is connected.

export const SAMPLE_DATA_NOTICE =
  "All barriers and streets shown here are fictional sample data for demonstration. They are not real locations, reports, or inspections.";

export const SAMPLE_MAP_CENTER: LngLat = { lng: -121.9886, lat: 37.5485 };
export const SAMPLE_MAP_ZOOM = 15;

// A fictional street grid drawn without any basemap, so the map needs no network access.
const GRID_STREET_COUNT = 5;
const GRID_SPACING_DEGREES = 0.002;
const GRID_HALF_SPAN = ((GRID_STREET_COUNT - 1) / 2) * GRID_SPACING_DEGREES;

function gridOffset(index: number): number {
  return index * GRID_SPACING_DEGREES - GRID_HALF_SPAN;
}

// Position of the intersection of avenue `column` and street `row`, nudged along the block.
function samplePoint(column: number, row: number, alongBlock = 0): LngLat {
  return {
    lng: SAMPLE_MAP_CENTER.lng + gridOffset(column) + alongBlock * GRID_SPACING_DEGREES,
    lat: SAMPLE_MAP_CENTER.lat + gridOffset(row),
  };
}

export function sampleStreetGrid(): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const { lng, lat } = SAMPLE_MAP_CENTER;
  const indices = Array.from({ length: GRID_STREET_COUNT }, (_, index) => index);
  const line = (coordinates: GeoJSON.Position[]): GeoJSON.Feature<GeoJSON.LineString> => ({
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates },
  });
  return {
    type: "FeatureCollection",
    features: [
      ...indices.map((index) =>
        line([
          [lng - GRID_HALF_SPAN, lat + gridOffset(index)],
          [lng + GRID_HALF_SPAN, lat + gridOffset(index)],
        ]),
      ),
      ...indices.map((index) =>
        line([
          [lng + gridOffset(index), lat - GRID_HALF_SPAN],
          [lng + gridOffset(index), lat + GRID_HALF_SPAN],
        ]),
      ),
    ],
  };
}

const FICTIONAL = "Fictional example for demonstration only.";

export const SAMPLE_BARRIERS: readonly Barrier[] = [
  {
    id: "sample-01",
    name: "Sample barrier 1",
    type: "missing_curb_ramp",
    severity: 5,
    state: "confirmed",
    source: "field_verification",
    location: samplePoint(1, 1),
    locationDescription: "Corner of Sample Avenue B and Sample Street 2 (fictional)",
    reportedOn: "2026-01-12",
    description: `${FICTIONAL} No curb ramp on the northeast corner.`,
  },
  {
    id: "sample-02",
    name: "Sample barrier 2",
    type: "surface_problem",
    severity: 3,
    state: "unverified",
    source: "community_report",
    location: samplePoint(2, 1, 0.5),
    locationDescription: "Sample Street 2 between Sample Avenues C and D (fictional)",
    reportedOn: "2026-02-03",
    description: `${FICTIONAL} Raised sidewalk panel from tree roots.`,
  },
  {
    id: "sample-03",
    name: "Sample barrier 3",
    type: "obstruction",
    severity: 2,
    state: "rejected",
    source: "community_report",
    location: samplePoint(3, 2, 0.4),
    locationDescription: "Sample Street 3 between Sample Avenues D and E (fictional)",
    reportedOn: "2026-02-18",
    description: `${FICTIONAL} Reported parked scooters; not found on a later check.`,
  },
  {
    id: "sample-04",
    name: "Sample barrier 4",
    type: "no_sidewalk",
    severity: 4,
    state: "repair_planned",
    source: "city_record",
    location: samplePoint(0, 3, 0.5),
    locationDescription: "Sample Street 4 between Sample Avenues A and B (fictional)",
    reportedOn: "2026-03-07",
    description: `${FICTIONAL} Sidewalk gap of about one block.`,
  },
  {
    id: "sample-05",
    name: "Sample barrier 5",
    type: "steep_slope",
    severity: 3,
    state: "unverified",
    source: "community_report",
    location: samplePoint(4, 0, -0.5),
    locationDescription: "Sample Street 1 between Sample Avenues D and E (fictional)",
    reportedOn: "2026-03-22",
    description: `${FICTIONAL} Steep cross slope at a driveway.`,
  },
  {
    id: "sample-06",
    name: "Sample barrier 6",
    type: "missing_curb_ramp",
    severity: 4,
    state: "repair_completed",
    source: "city_record",
    location: samplePoint(2, 2),
    locationDescription: "Corner of Sample Avenue C and Sample Street 3 (fictional)",
    reportedOn: "2026-04-09",
    description: `${FICTIONAL} Ramp installed; waiting for a verifier visit.`,
  },
  {
    id: "sample-07",
    name: "Sample barrier 7",
    type: "surface_problem",
    severity: 2,
    state: "resolved",
    source: "field_verification",
    location: samplePoint(1, 4, 0.5),
    locationDescription: "Sample Street 5 between Sample Avenues B and C (fictional)",
    reportedOn: "2026-04-30",
    description: `${FICTIONAL} Cracked panel replaced and checked on site.`,
  },
  {
    id: "sample-08",
    name: "Sample barrier 8",
    type: "obstruction",
    severity: 3,
    state: "confirmed",
    source: "community_report",
    location: samplePoint(3, 3, 0.5),
    locationDescription: "Sample Street 4 between Sample Avenues D and E (fictional)",
    reportedOn: "2026-05-14",
    description: `${FICTIONAL} Utility pole leaves a narrow passage.`,
  },
  {
    id: "sample-09",
    name: "Sample barrier 9",
    type: "missing_curb_ramp",
    severity: 3,
    state: "unverified",
    source: "community_report",
    location: samplePoint(4, 4),
    locationDescription: "Corner of Sample Avenue E and Sample Street 5 (fictional)",
    reportedOn: "2026-06-01",
    description: `${FICTIONAL} Curb ramp reported missing on one side.`,
  },
  {
    id: "sample-10",
    name: "Sample barrier 10",
    type: "steep_slope",
    severity: 1,
    state: "confirmed",
    source: "city_record",
    location: samplePoint(0, 0, 0.5),
    locationDescription: "Sample Street 1 between Sample Avenues A and B (fictional)",
    reportedOn: "2026-06-20",
    description: `${FICTIONAL} Mild running slope over a short distance.`,
  },
];
