import { describe, expect, test } from "vitest";
import { CONFETTI_COLORS, confettiPieces } from "./confetti-pieces";

describe("confettiPieces", () => {
  test("makes the same burst every time for the same seed", () => {
    // Arrange & Act
    const first = confettiPieces(12, 7);
    const second = confettiPieces(12, 7);

    // Assert
    expect(second).toEqual(first);
  });

  test("makes a different burst for a different seed", () => {
    // Arrange & Act
    const first = confettiPieces(12, 7);
    const other = confettiPieces(12, 8);

    // Assert
    expect(other).not.toEqual(first);
  });

  test("fires every piece upward, then lets it fall below its peak", () => {
    // Arrange & Act
    const pieces = confettiPieces(40, 1);

    // Assert
    expect(pieces).toHaveLength(40);
    pieces.forEach((piece) => {
      expect(piece.peakY).toBeLessThan(0);
      expect(piece.endY).toBeGreaterThan(piece.peakY);
      expect(CONFETTI_COLORS).toContain(piece.color);
    });
  });
});
