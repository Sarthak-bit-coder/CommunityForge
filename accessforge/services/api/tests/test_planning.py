"""Planning runs call the real engine on synthetic networks; nothing is mocked."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from test_api import application

from accessforge_api.planning_adapter import demo_network, run_plan
from accessforge_api.planning_schemas import PlanningDataset
from accessforge_api.report_limits import PLANS_PER_WINDOW

# Corridor fixture: wheelchair weight 0.5 x origin weight 10 x clinic weight 2.
CORRIDOR_PAIR_GAIN = 10.0
CORRIDOR_REPAIR_COST = 10.0


def plans(client: TestClient, dataset: str, budget: float) -> dict[str, dict]:
    response = client.get(
        "/planning/plans", params={"dataset": dataset, "budget": budget}
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["synthetic"] is True
    return {plan["method"]: plan for plan in data["plans"]}


def test_complementary_pair_is_found_only_by_portfolio_search() -> None:
    with TestClient(application()) as client:
        result = plans(client, "corridor", 2 * CORRIDOR_REPAIR_COST)
    exact = result["exhaustive"]
    assert exact["selected_repair_ids"] == ["r0", "r1"]
    assert exact["delta_a"] == CORRIDOR_PAIR_GAIN
    assert exact["total_cost"] == 2 * CORRIDOR_REPAIR_COST
    assert exact["optimality_proven"] is True
    assert {
        item["repair_id"]: item["complementary_repair_ids"]
        for item in exact["explanations"]
    } == {
        "r0": ["r1"],
        "r1": ["r0"],
    }
    # Each repair alone is worth nothing, so single-repair greedy never starts.
    assert result["B3"]["selected_repair_ids"] == []
    assert result["B3"]["delta_a"] == 0


def test_budget_for_one_corridor_repair_buys_no_modeled_access() -> None:
    with TestClient(application()) as client:
        result = plans(client, "corridor", CORRIDOR_REPAIR_COST)
    assert result["exhaustive"]["selected_repair_ids"] == []
    # Severity ranking spends the budget on a repair with no modeled benefit.
    assert result["B1"]["selected_repair_ids"] == ["r0"]
    assert result["B1"]["delta_a"] == 0


def test_zero_budget_selects_nothing() -> None:
    with TestClient(application()) as client:
        result = plans(client, "grid_clustered", 0)
    for plan in result.values():
        assert plan["selected_repair_ids"] == []
        assert plan["total_cost"] == 0
        assert plan["delta_a"] == 0


@pytest.mark.parametrize("dataset", ["grid_scattered", "grid_clustered"])
@pytest.mark.parametrize("fraction", [0.2, 0.5, 1.0])
def test_plans_respect_budget_and_exhaustive_is_never_beaten(
    dataset: str, fraction: float
) -> None:
    network = demo_network(PlanningDataset(dataset))
    costs = {repair.id: repair.cost for repair in network.instance.repairs}
    budget = fraction * sum(costs.values())
    with TestClient(application()) as client:
        result = plans(client, dataset, budget)
    for plan in result.values():
        assert (
            sum(costs[key] for key in plan["selected_repair_ids"]) == plan["total_cost"]
        )
        assert plan["total_cost"] <= budget
        assert 0 <= plan["delta_a"] <= result["exhaustive"]["delta_a"]


def test_runs_are_deterministic_and_describe_the_network() -> None:
    with TestClient(application()) as client:
        params = {"dataset": "grid_scattered", "budget": 40}
        first = client.get("/planning/plans", params=params).json()
        run_plan.cache_clear()
        second = client.get("/planning/plans", params=params).json()
    assert first == second
    data = first["data"]
    network = data["network"]
    assert len(network["nodes"]) == 12
    assert len(network["barriers"]) == len(network["repairs"]) == 8
    assert data["total_repair_cost"] == sum(r["cost"] for r in network["repairs"])
    assert data["engine_version"] == "0.1.0"


@pytest.mark.parametrize(
    "params",
    [
        {"dataset": "fremont", "budget": 10},
        {"dataset": "corridor", "budget": -1},
        {"dataset": "corridor", "budget": "nan"},
        {"dataset": "corridor", "budget": "inf"},
        {"dataset": "corridor", "budget": 1e12},
        {"dataset": "corridor"},
        {"budget": 10},
    ],
)
def test_invalid_planning_input_is_rejected(params: dict[str, object]) -> None:
    with TestClient(application()) as client:
        response = client.get("/planning/plans", params=params)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_engine_timeout_returns_no_partial_plan() -> None:
    run_plan.cache_clear()
    with (
        patch(
            "accessforge_api.planning_adapter.solve",
            side_effect=TimeoutError("optimization time limit exceeded"),
        ),
        TestClient(application()) as client,
    ):
        response = client.get(
            "/planning/plans", params={"dataset": "corridor", "budget": 20}
        )
    assert response.status_code == 503
    assert response.json()["data"] is None
    assert "time limit" not in response.text


def test_planning_is_rate_limited_per_peer() -> None:
    with TestClient(application()) as client:
        params = {"dataset": "corridor", "budget": 20}
        for _ in range(PLANS_PER_WINDOW):
            assert client.get("/planning/plans", params=params).status_code == 200
        response = client.get("/planning/plans", params=params)
    assert response.status_code == 429
    assert int(response.headers["Retry-After"]) >= 1
