"use client";

import { m } from "motion/react";
import { confettiPieces } from "./confetti-pieces";

const PIECE_COUNT = 44;
const SEED = 20261119;
const BURST_S = 1.7;
// Rise fast, hang for a moment, then drift down and fade.
const RISE_SHARE = 0.3;
const PIECES = confettiPieces(PIECE_COUNT, SEED);

// A one-shot burst at (x, y) inside the drawing. Decorative and never repeating; the caller
// mounts it on arrival and leaves it out under reduced motion.
export function Confetti({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <g aria-hidden="true" transform={`translate(${x} ${y})`}>
      {PIECES.map((piece) => (
        <m.g
          key={piece.id}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{
            x: [0, piece.x * 0.75, piece.x],
            y: [0, piece.peakY, piece.endY],
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: BURST_S,
            delay: piece.delay,
            times: [0, RISE_SHARE, 1],
            ease: ["easeOut", "easeIn"],
          }}
        >
          <m.g
            initial={{ rotate: 0 }}
            animate={{ rotate: piece.spin }}
            transition={{ duration: BURST_S, delay: piece.delay, ease: "linear" }}
          >
            {piece.shape === "strip" ? (
              <rect
                x={-piece.size / 2}
                y={-piece.size / 4}
                width={piece.size}
                height={piece.size / 2}
                rx={0.4}
                className={piece.color}
              />
            ) : (
              <circle r={piece.size / 3} className={piece.color} />
            )}
          </m.g>
        </m.g>
      ))}
    </g>
  );
}
