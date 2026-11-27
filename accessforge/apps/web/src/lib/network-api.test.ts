import { describe, expect, it } from "vitest";
import { lockBounds } from "./network-api";

describe("lockBounds", () => {
  it("pads the network box by 15% on each side", () => {
    expect(
      lockBounds(
        [
          [0, 0],
          [10, 20],
        ],
        null,
      ),
    ).toEqual([
      [-1.5, -3],
      [11.5, 23],
    ]);
  });

  it("grows to include markers outside the network, so no report is hidden", () => {
    const [[w, s], [e, n]] = lockBounds(
      [
        [0, 0],
        [10, 10],
      ],
      [
        [12, -2],
        [14, 1],
      ],
    );
    expect(w).toBeLessThan(0);
    expect(s).toBeLessThan(-2);
    expect(e).toBeGreaterThan(14);
    expect(n).toBeGreaterThan(10);
  });
});
