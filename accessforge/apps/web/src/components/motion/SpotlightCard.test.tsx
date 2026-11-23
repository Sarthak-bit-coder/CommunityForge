import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SpotlightCard } from "./SpotlightCard";

afterEach(() => vi.unstubAllGlobals());

// Motion reads prefers-reduced-motion once per module and caches it, so this test runs first.
describe("SpotlightCard", () => {
  test("adds no light and no tilt under reduced motion", () => {
    // Arrange
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }));

    // Act
    const { container } = render(
      <SpotlightCard>
        <p>Pending</p>
      </SpotlightCard>,
    );

    // Assert
    expect(container.firstElementChild?.className).not.toContain("before:");
  });

  test("renders its content directly, so it can be a group inside a definition list", () => {
    // Arrange & Act
    const { container } = render(
      <dl>
        <SpotlightCard className="p-4">
          <dt>Verified</dt>
          <dd>3</dd>
        </SpotlightCard>
      </dl>,
    );

    // Assert
    const card = container.querySelector("dl > div");
    expect(card).toHaveClass("p-4");
    expect(card?.firstElementChild?.tagName).toBe("DT");
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
