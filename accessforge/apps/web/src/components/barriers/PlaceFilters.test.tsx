import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { emptyCounts } from "./map-destinations";
import { PlaceFilters } from "./PlaceFilters";

function renderFilters(hiddenTypes: Parameters<typeof PlaceFilters>[0]["hiddenTypes"] = []) {
  const handlers = {
    onToggleType: vi.fn(),
    onShowOnlyType: vi.fn(),
    onShowAllTypes: vi.fn(),
  };
  render(
    <PlaceFilters
      places={{ ...emptyCounts(), health: 12 }}
      hiddenTypes={hiddenTypes}
      {...handlers}
    />,
  );
  return handlers;
}

describe("PlaceFilters", () => {
  it("shows every type as a pressed switch with its count", () => {
    // Arrange / Act
    renderFilters();

    // Assert
    const health = screen.getByRole("button", { name: "Healthcare, 12 in this view" });
    expect(health).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Show all" })).toBeDisabled();
  });

  it("switches a type off when its button is pressed", async () => {
    // Arrange
    const { onToggleType } = renderFilters();

    // Act
    await userEvent.click(screen.getByRole("button", { name: "Schools, 0 in this view" }));

    // Assert
    expect(onToggleType).toHaveBeenCalledWith("education");
  });

  it("offers to show one type alone", async () => {
    // Arrange
    const { onShowOnlyType } = renderFilters();

    // Act
    await userEvent.click(screen.getByRole("button", { name: "Show only Groceries" }));

    // Assert
    expect(onShowOnlyType).toHaveBeenCalledWith("food");
  });

  it("marks hidden types unpressed and says how many are shown", async () => {
    // Arrange
    const { onShowAllTypes } = renderFilters(["transit", "food"]);

    // Act
    await userEvent.click(screen.getByRole("button", { name: "Show all" }));

    // Assert
    expect(screen.getByRole("button", { name: "Transit stops, 0 in this view" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByText(/Showing 3 of 5 place types on the map\./)).toBeInTheDocument();
    expect(onShowAllTypes).toHaveBeenCalledOnce();
  });
});
