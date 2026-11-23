import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_BARRIERS } from "@/lib/sample-barriers";
import { isWatched } from "@/lib/watched-barriers";
import { BarrierDetails } from "./BarrierDetails";

const barrier = SAMPLE_BARRIERS[0];

describe("BarrierDetails watch toggle", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("watches a barrier in this browser and says no alerts are sent", async () => {
    const user = userEvent.setup();
    render(<BarrierDetails barrier={barrier} />);
    const watch = screen.getByRole("button", { name: "Watch this barrier" });
    expect(watch).toHaveAttribute("aria-pressed", "false");
    expect(watch).toHaveAccessibleDescription(/Saved in this browser only\. No alerts are sent\./);
    await user.click(watch);
    expect(watch).toHaveAttribute("aria-pressed", "true");
    expect(isWatched(barrier.id)).toBe(true);
    await user.click(watch);
    expect(watch).toHaveAttribute("aria-pressed", "false");
    expect(isWatched(barrier.id)).toBe(false);
  });

  it("shows a saved watch on the next visit", () => {
    localStorage.setItem("accessforge:watched-barriers", JSON.stringify([barrier.id]));
    render(<BarrierDetails barrier={barrier} />);
    expect(screen.getByRole("button", { name: "Watch this barrier" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("keeps the toggle off and explains when the browser cannot save", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    const user = userEvent.setup();
    render(<BarrierDetails barrier={barrier} />);
    const watch = screen.getByRole("button", { name: "Watch this barrier" });
    await user.click(watch);
    expect(watch).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("status")).toHaveTextContent(
      "This browser blocked saving. Allow site storage to watch barriers.",
    );
  });
});
