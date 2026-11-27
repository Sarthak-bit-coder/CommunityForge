"""Exercise snapshot preconditions at the demo routing and planning boundaries."""

from dataclasses import replace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from accessforge_api import planning, planning_adapter, routing_adapter
from accessforge_api.planning_schemas import PlanningDataset


@pytest.mark.parametrize("use_stale_request", [True, False])
def test_barrier_only_change_invalidates_route_or_repair_plan(
    monkeypatch: pytest.MonkeyPatch, use_stale_request: bool
) -> None:
    dataset = PlanningDataset.corridor
    network = planning_adapter.demo_network(dataset)
    old = planning_adapter.network_snapshot_id(network)
    first, *others = network.instance.barriers
    updated = replace(
        network,
        instance=replace(
            network.instance, barriers=(replace(first, presence_prob=0), *others)
        ),
    )
    current = planning_adapter.network_snapshot_id(updated)
    assert old != current
    monkeypatch.setattr(routing_adapter, "demo_network", lambda _: updated)

    with pytest.raises(routing_adapter.StaleSnapshotError) as rejected:
        routing_adapter.analyze_demo_route(
            dataset,
            "home",
            "clinic",
            "wheelchair",
            10,
            old if use_stale_request else current,
        )
    assert rejected.value.current_snapshot_id == current


def test_planning_rejects_mismatched_snapshot_id() -> None:
    app = FastAPI()
    app.include_router(planning.router)
    app.dependency_overrides[planning.limit_planning] = lambda: None
    with TestClient(app) as client:
        response = client.get(
            "/planning/plans",
            params={"dataset": "corridor", "budget": 10, "snapshot_id": "0" * 64},
        )
    assert response.status_code == 409
