// Pilot-area street lines for the map background (FastAPI StreetNetwork).
export type StreetNetwork = {
  readonly lines: readonly (readonly (readonly [number, number])[])[];
  readonly attribution: readonly string[];
};
const REQUEST_TIMEOUT_MS = 15_000;

/** Resolves to null when no pilot network is loaded or it cannot be read; callers fall back. */
export async function fetchStreets(signal: AbortSignal): Promise<StreetNetwork | null> {
  try {
    const response = await fetch("/api/network/streets", {
      signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
    });
    if (!response.ok) return null;
    const data: unknown = (await response.json())?.data;
    const network = data as StreetNetwork | undefined;
    return Array.isArray(network?.lines) &&
      network.lines.length &&
      Array.isArray(network.attribution)
      ? network
      : null;
  } catch {
    return null;
  }
}

/** [[west, south], [east, north]] of every street point. */
type Bounds = [[number, number], [number, number]];
// Room around the pilot network so its edge streets are not pinned to the map border.
const LOCK_PADDING_FRACTION = 0.15;

/** Bounds covering both boxes, grown by LOCK_PADDING_FRACTION, to keep panning on the data. */
export function lockBounds(network: Bounds, markers: Bounds | null): Bounds {
  const [[w, s], [e, n]] = markers
    ? [
        [Math.min(network[0][0], markers[0][0]), Math.min(network[0][1], markers[0][1])],
        [Math.max(network[1][0], markers[1][0]), Math.max(network[1][1], markers[1][1])],
      ]
    : network;
  const padX = (e - w) * LOCK_PADDING_FRACTION;
  const padY = (n - s) * LOCK_PADDING_FRACTION;
  return [
    [w - padX, s - padY],
    [e + padX, n + padY],
  ];
}

export function streetBounds(network: StreetNetwork): Bounds {
  const points = network.lines.flat();
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}
