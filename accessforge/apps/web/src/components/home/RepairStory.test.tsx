import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { scrubKeyframes } from "./RepairRouteFigure";
import { scenarioAt } from "./repair-scenarios";
import { RepairStory } from "./RepairStory";

describe("RepairStory", () => {
  test("starts on today's blocked trip and says it is an illustration", () => {
    // Arrange & Act
    render(<RepairStory />);

    // Assert
    expect(screen.getByRole("radio", { name: "Today" })).toBeChecked();
    expect(screen.getByRole("img", { name: /blocked at the first corner/i })).toBeInTheDocument();
    expect(screen.getByText(/illustration, not a map or a real result/i)).toBeInTheDocument();
  });

  test("explains that one repair alone opens nothing", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<RepairStory />);

    // Act
    await user.click(screen.getByRole("radio", { name: "Fix one corner" }));

    // Assert
    expect(screen.getByRole("img", { name: /still blocked at the second corner/i })).toBeVisible();
    const step = screen.getByRole("heading", { name: "Fix one corner" }).closest("li");
    expect(step).toHaveAttribute("aria-current", "step");
    expect(step).toHaveTextContent(/scores this repair as zero/i);
  });

  test("opens the whole trip when both repairs are funded together", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<RepairStory />);

    // Act
    await user.click(screen.getByRole("radio", { name: "Fix both corners" }));

    // Assert
    expect(screen.getByRole("img", { name: /whole trip is open/i })).toBeVisible();
  });

  test("moves between scenarios with the arrow keys", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<RepairStory />);
    await user.click(screen.getByRole("radio", { name: "Today" }));

    // Act
    await user.keyboard("{ArrowRight}");

    // Assert
    expect(screen.getByRole("radio", { name: "Fix one corner" })).toBeChecked();
  });

  test("maps each third of the story progress to its scenario", () => {
    // Arrange
    const samples = [0, 0.2, 0.34, 0.6, 0.67, 0.99, 1];

    // Act
    const ids = samples.map((progress) => scenarioAt(progress).id);

    // Assert
    expect(ids).toEqual(["today", "today", "one", "one", "both", "both", "both"]);
  });

  test("scroll keyframes start at home, end at the clinic, and never go backwards in progress", () => {
    // Arrange & Act
    const { input, output } = scrubKeyframes();

    // Assert
    expect(input).toHaveLength(output.length);
    expect(input[0]).toBe(0);
    expect(input.at(-1)).toBe(1);
    expect(output[0]).toBe(80);
    expect(output.at(-1)).toBe(480);
    input.slice(1).forEach((value, index) => expect(value).toBeGreaterThanOrEqual(input[index]));
  });
});
