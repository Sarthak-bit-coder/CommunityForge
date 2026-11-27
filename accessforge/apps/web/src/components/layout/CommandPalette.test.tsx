import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CommandPalette, filterPages } from "./CommandPalette";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => push.mockReset());

describe("filterPages", () => {
  test("returns every page for an empty query", () => {
    // Arrange & Act
    const results = filterPages("  ");

    // Assert
    expect(results.length).toBeGreaterThan(1);
  });

  test("matches every typed word against label and description, ignoring case", () => {
    // Arrange & Act
    const results = filterPages("REPAIR budget");

    // Assert
    expect(results.map((item) => item.href)).toEqual(["/planner"]);
  });

  test("returns nothing when no page matches", () => {
    // Arrange & Act & Assert
    expect(filterPages("zzzz")).toEqual([]);
  });
});

describe("CommandPalette", () => {
  test("opens with Ctrl+K and goes to the chosen page with the keyboard", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<CommandPalette />);

    // Act
    await user.keyboard("{Control>}k{/Control}");
    await user.type(screen.getByRole("combobox", { name: "Search pages" }), "verification");
    await user.keyboard("{Enter}");

    // Assert
    expect(push).toHaveBeenCalledWith("/verify");
  });

  test("moves the active option with the arrow keys", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<CommandPalette />);
    await user.click(screen.getByRole("button", { name: /search pages/i }));
    const input = screen.getByRole("combobox", { name: "Search pages" });

    // Act
    await user.type(input, "{ArrowDown}");

    // Assert
    const options = screen.getAllByRole("option");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", options[1].id);
  });

  test("says so when no page matches", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<CommandPalette />);
    await user.click(screen.getByRole("button", { name: /search pages/i }));

    // Act
    await user.type(screen.getByRole("combobox", { name: "Search pages" }), "zzzz");

    // Assert
    expect(screen.getByRole("status")).toHaveTextContent("No pages match.");
  });
});
