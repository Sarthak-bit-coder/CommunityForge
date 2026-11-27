// Confetti pieces for the arrival burst. Pure and seeded, so the burst is the same on every
// arrival and can be tested. Units are SVG user units, relative to the burst point.

export const CONFETTI_COLORS = [
  "fill-marker",
  "fill-accent",
  "fill-accent-soft",
  "fill-ink",
] as const;

export type ConfettiPiece = {
  readonly id: number;
  readonly shape: "strip" | "dot";
  readonly color: (typeof CONFETTI_COLORS)[number];
  /** Where the piece lands, after rising and falling. */
  readonly x: number;
  readonly peakY: number;
  readonly endY: number;
  readonly size: number;
  readonly spin: number;
  readonly delay: number;
};

const SPREAD = { minAngle: -160, maxAngle: -20 } as const; // degrees; upward fan
const SPEED = { min: 50, max: 100 } as const;
const FALL = 80;
const SIZE = { min: 6, max: 10 } as const;
const SPIN_MAX = 540;
const DELAY_MAX_S = 0.12;
const DEG_TO_RAD = Math.PI / 180;

// mulberry32: a tiny deterministic generator, enough for decoration.
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function confettiPieces(count: number, seed: number): readonly ConfettiPiece[] {
  const random = seededRandom(seed);
  const between = (min: number, max: number) => min + random() * (max - min);
  return Array.from({ length: count }, (_, id) => {
    const angle = between(SPREAD.minAngle, SPREAD.maxAngle) * DEG_TO_RAD;
    const speed = between(SPEED.min, SPEED.max);
    const peakY = Math.sin(angle) * speed;
    return {
      id,
      shape: random() < 0.6 ? "strip" : "dot",
      color: CONFETTI_COLORS[Math.floor(random() * CONFETTI_COLORS.length)],
      x: Math.cos(angle) * speed,
      peakY,
      endY: peakY + FALL,
      size: between(SIZE.min, SIZE.max),
      spin: between(-SPIN_MAX, SPIN_MAX),
      delay: random() * DELAY_MAX_S,
    };
  });
}
