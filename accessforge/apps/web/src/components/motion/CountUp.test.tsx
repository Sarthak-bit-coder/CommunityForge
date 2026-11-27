import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { CountUp } from "./CountUp";

describe("CountUp", () => {
  test("gives assistive tech the final value before any counting happens", () => {
    // Arrange & Act: jsdom never reports the number as in view, so it stays at its start.
    render(<CountUp value={1234} />);

    // Assert
    expect(screen.getByText("1,234")).toHaveClass("sr-only");
    expect(screen.getByText("0")).toHaveAttribute("aria-hidden", "true");
  });

  test("uses the supplied format for the final value", () => {
    // Arrange & Act
    render(<CountUp value={42} format={(value) => `${Math.round(value)}%`} />);

    // Assert
    expect(screen.getByText("42%")).toHaveClass("sr-only");
  });
});
