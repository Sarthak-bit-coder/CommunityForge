import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Reveal } from "./Reveal";

describe("Reveal", () => {
  test("renders its children so content stays readable without motion", () => {
    // Arrange
    const heading = "Fix the barriers that reconnect the most routes";

    // Act
    render(
      <Reveal>
        <h2>{heading}</h2>
      </Reveal>,
    );

    // Assert
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  });

  test("passes the class name to the wrapping element", () => {
    // Arrange & Act
    const { container } = render(
      <Reveal className="h-full">
        <p>Body text</p>
      </Reveal>,
    );

    // Assert
    expect(container.firstElementChild).toHaveClass("h-full");
  });
});
