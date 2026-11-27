import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { HeroRoute } from "./HeroRoute";

describe("HeroRoute", () => {
  test("is hidden from assistive technology", () => {
    // Arrange & Act
    const { container } = render(<HeroRoute />);

    // Assert
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  test("shows the finished route when the browser cannot draw SVG paths", () => {
    // Arrange: jsdom has no SVGPathElement.getTotalLength, like a browser without SVG geometry.

    // Act
    const { container } = render(<HeroRoute />);

    // Assert
    expect(container.querySelector("svg")).toHaveStyle({ opacity: "1" });
  });
});
