import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import corridor from "@/test/corridor-plan.json";
import { RepairPlanner } from "./RepairPlanner";

// Real engine output for the corridor at budget 20; a second budget reuses its shape.
const tight = {
  ...corridor,
  budget: 10,
  plans: corridor.plans.map((plan) => ({
    ...plan,
    selected_repair_ids: [],
    total_cost: 0,
    delta_a: 0,
    accessibility_after: corridor.accessibility_before,
    explanations: [],
  })),
};
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(
      new Response(JSON.stringify({ data: url.includes("budget=10") ? tight : corridor })),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

it("runs the default scenario and explains the recommended pair accessibly", async () => {
  const { container } = render(<RepairPlanner />);
  expect(screen.getByText("Running the optimization engine…")).toBeInTheDocument();

  const why = await screen.findByRole("table", { name: /Each selected repair/ });
  const row = within(why).getByRole("row", { name: /^r0/ });
  expect(within(row).getByText("step on segment e0")).toBeInTheDocument();
  expect(within(row).getByText("r1")).toBeInTheDocument();
  expect(screen.getByText("20 of 20")).toBeInTheDocument();
  expect(screen.getByText("10 → 20")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /2 barriers, 2 repaired/ })).toBeInTheDocument();
  expect(
    within(screen.getByRole("table", { name: /Modeled gain of each/ })).getByRole("row", {
      name: /One repair at a time.*None 0 0/,
    }),
  ).toBeInTheDocument();
  expect(screen.getByText(/Synthetic demonstration, not Fremont data/)).toBeInTheDocument();
  expect(fetchMock.mock.calls[0][0]).toBe("/api/planning/plans?dataset=corridor&budget=20");
  expect(await axeViolations(container)).toEqual([]);
});

it("rejects an unusable budget without calling the service", async () => {
  const user = userEvent.setup();
  render(<RepairPlanner />);
  await screen.findByText("20 of 20");
  const budget = screen.getByLabelText("Budget (cost units)");
  await user.clear(budget);
  await user.type(budget, "-5");
  await user.click(screen.getByRole("button", { name: "Run plan" }));

  expect(budget).toHaveAccessibleDescription(/Enter a budget between 0 and/);
  expect(budget).toBeInvalid();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("explains an empty plan, then compares saved scenarios and exports", async () => {
  const user = userEvent.setup();
  render(<RepairPlanner />);
  await screen.findByText("20 of 20");
  expect(screen.getByText(/No saved scenarios yet/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Save scenario to compare" }));
  expect(screen.getByRole("button", { name: "Scenario saved" })).toBeDisabled();

  const budget = screen.getByLabelText("Budget (cost units)");
  await user.clear(budget);
  await user.type(budget, "10");
  await user.click(screen.getByRole("button", { name: "Run plan" }));
  expect(
    await screen.findByText(/No combination of repairs within this budget/),
  ).toBeInTheDocument();
  expect(screen.queryByRole("table", { name: /Each selected repair/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Save scenario to compare" }));

  const saved = screen.getByRole("table", { name: /Saved scenarios/ });
  expect(within(saved).getAllByRole("row")).toHaveLength(3);
  expect(within(saved).getByText("20 (+10)")).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Remove Two-barrier corridor at budget 20" }),
  );
  expect(within(saved).getAllByRole("row")).toHaveLength(2);

  const csv = screen.getByRole("link", { name: "Download summary (CSV)" });
  expect(csv).toHaveAttribute("download", "accessforge-plan-corridor-10.csv");
  expect(decodeURIComponent(csv.getAttribute("href") ?? "")).toContain("Not an inspection");
});

it("keeps the previous result and announces a failed run", async () => {
  const user = userEvent.setup();
  render(<RepairPlanner />);
  await screen.findByText("20 of 20");
  fetchMock.mockResolvedValueOnce(new Response("", { status: 429 }));
  await user.selectOptions(screen.getByLabelText("Demonstration network"), "grid_clustered");
  expect(screen.getByText(/placed next to each other/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Run plan" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Too many planning runs. Wait a minute before trying again. The results below are from the previous run.",
  );
  expect(screen.getByText("20 of 20")).toBeInTheDocument();
});

it("reports a failed first run with no stale results", async () => {
  fetchMock.mockRejectedValueOnce(new TypeError("offline"));
  render(<RepairPlanner />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Cannot reach the planning service. Please try again.",
  );
  expect(screen.queryByText("Recommended plan")).not.toBeInTheDocument();
});
