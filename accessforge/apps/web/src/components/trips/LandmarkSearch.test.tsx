import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { LandmarkSearch, type LandmarkOption } from "./LandmarkSearch";

const OPTIONS: readonly LandmarkOption[] = [
  { key: "osm:node/1", label: "Fremont BART Station" },
  { key: "osm:way/2", label: "Fremont Main Library" },
  { key: "osm:way/3", label: "Central Park" },
];

function Harness({ onChange = vi.fn() }: { readonly onChange?: (key: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <LandmarkSearch
      label="Start landmark"
      options={OPTIONS}
      value={value}
      onChange={(key) => {
        setValue(key);
        onChange(key);
      }}
    />
  );
}

describe("LandmarkSearch", () => {
  test("filters landmarks as you type, ignoring case", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Harness />);

    // Act
    await user.type(screen.getByRole("combobox", { name: "Start landmark" }), "fremont");

    // Assert
    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Fremont BART Station",
      "Fremont Main Library",
    ]);
    expect(screen.getByRole("status")).toHaveTextContent("2 landmarks match");
  });

  test("selects a landmark with the arrow keys and Enter", async () => {
    // Arrange
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "Start landmark" });

    // Act
    await user.type(input, "park");
    await user.keyboard("{ArrowDown}{Enter}");

    // Assert
    expect(onChange).toHaveBeenLastCalledWith("osm:way/3");
    expect(input).toHaveValue("Central Park");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  test("selects a landmark by clicking it", async () => {
    // Arrange
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    // Act
    await user.click(screen.getByRole("combobox", { name: "Start landmark" }));
    await user.click(screen.getByRole("option", { name: "Fremont Main Library" }));

    // Assert
    expect(onChange).toHaveBeenLastCalledWith("osm:way/2");
  });

  test("clears the choice when the text is edited again", async () => {
    // Arrange
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "Start landmark" });
    await user.click(input);
    await user.click(screen.getByRole("option", { name: "Central Park" }));

    // Act
    await user.type(input, "x");

    // Assert
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  test("closes the list with Escape", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Start landmark" });
    await user.type(input, "f");

    // Act
    await user.keyboard("{Escape}");

    // Assert
    expect(input).toHaveAttribute("aria-expanded", "false");
    // The list fades out before it unmounts.
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });

  test("says when nothing matches", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Harness />);

    // Act
    await user.type(screen.getByRole("combobox", { name: "Start landmark" }), "zzz");

    // Assert
    expect(screen.getByRole("status")).toHaveTextContent("No landmark matches “zzz”");
    expect(screen.queryByRole("option")).toBeNull();
  });
});
