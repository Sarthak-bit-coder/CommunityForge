"""Route analysis runs the real engine graph on fixed fixtures; nothing is mocked."""

from dataclasses import replace

import pytest
from accessforge_engine import (
    Barrier,
    Destination,
    Edge,
    Node,
    Origin,
    ProblemInstance,
    Profile,
    Repair,
)
from fastapi.testclient import TestClient
from test_api import application

from accessforge_api import planning_adapter, routing_adapter
from accessforge_api.planning_schemas import PlanningDataset
from accessforge_api.routing_core import (
    UNVERIFIED_LIMITATION,
    RouteQuery,
    compare_routes,
)
from accessforge_api.routing_schemas import RouteReason, RouteStatus

# Corridor fixture: a-b and b-c are 25 m each; the wheelchair profile treats steps as impassable.
CORRIDOR_TRIP_M = 50.0
CORRIDOR_REPAIR_COST = 10.0
WHEELCHAIR_TRIP = RouteQuery("home", "clinic", "wheelchair")
SNAPSHOT_ID_LENGTH = 64  # hex SHA-256
ID_MAX_LENGTH = 64  # matches the route query limits in routing.py


def analysis(client: TestClient, **params: object) -> dict:
    response = client.get("/routing/analysis", params=params)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["synthetic"] is True
    return data


def test_route_analysis_exposes_snapshot_id_and_rejects_a_stale_one() -> None:
    query = {
        "dataset": "corridor",
        "origin": "home",
        "destination": "clinic",
        "profile": "wheelchair",
        "budget": CORRIDOR_REPAIR_COST,
    }
    with TestClient(application()) as client:
        current = analysis(client, **query)
        snapshot = current["snapshot_id"]
        assert len(snapshot) == SNAPSHOT_ID_LENGTH
        assert (
            analysis(client, **query, snapshot_id=snapshot)["snapshot_id"] == snapshot
        )
        stale = client.get(
            "/routing/analysis",
            params={**query, "snapshot_id": "0" * SNAPSHOT_ID_LENGTH},
        )
        assert stale.status_code == 409


def test_wheelchair_corridor_has_no_route_until_both_steps_are_repaired() -> None:
    with TestClient(application()) as client:
        none_funded = analysis(
            client,
            dataset="corridor",
            origin="home",
            destination="clinic",
            profile="wheelchair",
            budget=CORRIDOR_REPAIR_COST,
        )
        both_funded = analysis(
            client,
            dataset="corridor",
            origin="home",
            destination="clinic",
            profile="wheelchair",
            budget=2 * CORRIDOR_REPAIR_COST,
        )
    assert none_funded["recommended_repair_ids"] == []
    assert none_funded["current"]["status"] == "no_route"
    assert none_funded["current"]["reason"] == "barrier"
    assert none_funded["after_repairs"] == none_funded["current"]
    assert both_funded["recommended_repair_ids"] == ["r0", "r1"]
    assert both_funded["recommended_cost"] == 2 * CORRIDOR_REPAIR_COST
    assert both_funded["after_repairs"]["status"] == "accessible"
    assert both_funded["after_repairs"]["distance_m"] == CORRIDOR_TRIP_M
    assert both_funded["after_repairs"]["node_ids"] == ["a", "b", "c"]


def test_both_corridor_steps_are_listed_as_barriers_that_block_the_wheelchair() -> None:
    with TestClient(application()) as client:
        data = analysis(
            client,
            dataset="corridor",
            origin="home",
            destination="clinic",
            profile="wheelchair",
            budget=0,
        )
    affecting = {item["id"]: item for item in data["affecting_barriers"]}
    assert set(affecting) == {"b0", "b1"}
    assert all(item["blocks_profile"] for item in affecting.values())
    assert all(item["verified"] for item in affecting.values())


def test_pedestrian_route_crosses_steps_and_reports_them_as_not_blocking() -> None:
    with TestClient(application()) as client:
        data = analysis(
            client,
            dataset="corridor",
            origin="home",
            destination="clinic",
            profile="pedestrian",
            budget=0,
        )
    current = data["current"]
    assert current["status"] == "accessible"
    assert current["distance_m"] == CORRIDOR_TRIP_M
    assert current["generalized_cost"] == CORRIDOR_TRIP_M
    assert {item["id"] for item in current["barriers_on_route"]} == {"b0", "b1"}
    assert not any(item["blocks_profile"] for item in current["barriers_on_route"])


def test_unknown_origin_and_profile_are_not_found() -> None:
    with TestClient(application()) as client:
        for params in (
            {"origin": "nowhere", "profile": "wheelchair"},
            {"origin": "home", "profile": "unknown"},
        ):
            response = client.get(
                "/routing/analysis",
                params={
                    "dataset": "corridor",
                    "destination": "clinic",
                    "budget": 0,
                    **params,
                },
            )
            assert response.status_code == 404


def test_negative_budget_is_rejected_before_any_engine_run() -> None:
    with TestClient(application()) as client:
        response = client.get(
            "/routing/analysis",
            params={
                "dataset": PlanningDataset.corridor.value,
                "origin": "home",
                "destination": "clinic",
                "profile": "wheelchair",
                "budget": -1,
            },
        )
    assert response.status_code == 422


def _single_edge_instance(
    *, presence: float, length_m: float, threshold_m: float, step: bool
) -> ProblemInstance:
    impassable = frozenset({"step"}) if step else frozenset()
    return ProblemInstance(
        (Edge("e0", "a", "b", length_m, {"incline": 0}),),
        (Barrier("b0", "e0", None, "step", 3, presence),),
        (Repair("r0", ("b0",), 10, 10, 10),),
        (Profile("wheelchair", 1.0, None, impassable, {}, threshold_m),),
        (Origin("home", "a", 1, "corridor"),),
        (Destination("clinic", "b", "health", 1),),
        (Node("a"), Node("b")),
    )


def test_unverified_step_makes_route_uncertain_not_accessible() -> None:
    instance = _single_edge_instance(
        presence=0.5, length_m=25, threshold_m=100, step=True
    )
    comparison = compare_routes(instance, WHEELCHAIR_TRIP, ())
    assert comparison.current.status == RouteStatus.uncertain
    # The route assumes the unverified step is absent, yet it crosses that step.
    [crossed] = comparison.current.barriers_on_route
    assert crossed.id == "b0"
    assert crossed.verified is False
    assert crossed.blocks_profile is True
    assert comparison.current.distance_m == 25
    assert comparison.affecting_barriers[0].verified is False
    assert comparison.affecting_barriers[0].blocks_profile is True
    assert UNVERIFIED_LIMITATION in comparison.limitations


def test_route_longer_than_threshold_has_no_route_with_distance_reason() -> None:
    instance = _single_edge_instance(
        presence=0, length_m=120, threshold_m=100, step=False
    )
    comparison = compare_routes(instance, WHEELCHAIR_TRIP, ())
    assert comparison.current.status == RouteStatus.no_route
    assert comparison.current.reason == RouteReason.distance_or_disconnected
    assert comparison.affecting_barriers == ()
    assert UNVERIFIED_LIMITATION not in comparison.limitations


def test_route_at_threshold_is_accessible() -> None:
    instance = _single_edge_instance(
        presence=0, length_m=100, threshold_m=100, step=False
    )
    comparison = compare_routes(instance, WHEELCHAIR_TRIP, ())
    assert comparison.current.status == RouteStatus.accessible
    assert comparison.current.generalized_cost == 100


@pytest.mark.parametrize(
    "override",
    [
        {"budget": "nan"},
        {"budget": "inf"},
        {"budget": -1},
        {"budget": 1_000_001},
        {"budget": "abc"},
        {"origin": "h" * (ID_MAX_LENGTH + 1)},
        {"origin": ""},
        {"dataset": "not_a_dataset"},
        {"snapshot_id": "a" * (ID_MAX_LENGTH + 1)},
        {"snapshot_id": ""},
    ],
)
def test_malformed_or_oversized_route_inputs_are_rejected_before_the_engine(
    override: dict[str, object],
) -> None:
    query: dict[str, object] = {
        "dataset": "corridor",
        "origin": "home",
        "destination": "clinic",
        "profile": "wheelchair",
        "budget": 20,
        **override,
    }
    with TestClient(application(), raise_server_exceptions=False) as client:
        response = client.get("/routing/analysis", params=query)
    assert response.status_code == 422


@pytest.mark.parametrize("origin", ["home\x00", "hömé", "home' OR 1=1--", "../../etc"])
def test_unknown_or_hostile_ids_are_not_found_not_executed(origin: str) -> None:
    query = {
        "dataset": "corridor",
        "origin": origin,
        "destination": "clinic",
        "profile": "wheelchair",
        "budget": 20,
    }
    with TestClient(application(), raise_server_exceptions=False) as client:
        response = client.get("/routing/analysis", params=query)
    assert response.status_code == 404


def test_every_plan_impact_is_a_probability_and_names_only_selected_repairs() -> None:
    with TestClient(application()) as client:
        response = client.get(
            "/planning/plans", params={"dataset": "corridor", "budget": 20}
        )
        assert response.status_code == 200
        for plan in response.json()["data"]["plans"]:
            selected = set(plan["selected_repair_ids"])
            for impact in plan["route_impacts"]:
                assert 0.0 <= impact["modeled_reach_before"] <= 1.0
                assert 0.0 <= impact["modeled_reach_after"] <= 1.0
                assert set(impact["contributing_repair_ids"]) <= selected


def test_route_impacts_match_the_plan_and_only_include_the_requested_trip() -> None:
    with TestClient(application()) as client:
        params = {"dataset": "corridor", "budget": 20}
        response = client.get("/planning/plans", params=params)
        assert response.status_code == 200
        plan = response.json()["data"]
        best = next(item for item in plan["plans"] if item["method"] == "exhaustive")
        query = {
            **params,
            "origin": "home",
            "destination": "clinic",
            "snapshot_id": plan["snapshot_id"],
        }
        route = analysis(client, **query, profile="wheelchair")
        pedestrian = analysis(client, **query, profile="pedestrian")

    [impact] = best["route_impacts"]
    assert impact == {
        "profile_id": "wheelchair",
        "origin_id": "home",
        "destination_id": "clinic",
        "modeled_reach_before": 0,
        "modeled_reach_after": 1,
        "contributing_repair_ids": ["r0", "r1"],
    }
    assert route["route_impacts"] == [
        {**impact, "current_distance_m": None, "modeled_distance_m": CORRIDOR_TRIP_M}
    ]
    assert pedestrian["route_impacts"] == []


def test_unaffordable_repair_bundle_returns_no_route_impacts() -> None:
    with TestClient(application()) as client:
        route = analysis(
            client,
            dataset="corridor",
            origin="home",
            destination="clinic",
            profile="wheelchair",
            budget=CORRIDOR_REPAIR_COST,
        )
    assert route["route_impacts"] == []
    assert route["after_repairs"]["distance_m"] is None


def test_disconnected_snapshot_rejects_an_old_plan_then_reports_no_impact(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dataset = PlanningDataset.corridor
    network = planning_adapter.demo_network(dataset)
    disconnected = replace(
        network, instance=replace(network.instance, edges=(), barriers=(), repairs=())
    )
    query = {
        "dataset": dataset.value,
        "budget": 20,
        "origin": "home",
        "destination": "clinic",
        "profile": "wheelchair",
    }
    monkeypatch.setattr(routing_adapter, "demo_network", lambda _: disconnected)
    with TestClient(application()) as client:
        assert client.get("/routing/analysis", params=query).status_code == 409
        monkeypatch.setattr(planning_adapter, "demo_network", lambda _: disconnected)
        monkeypatch.setattr(
            routing_adapter, "run_plan", planning_adapter.run_plan.__wrapped__
        )
        route = analysis(client, **query)
    assert route["current"]["reason"] == "distance_or_disconnected"
    assert route["current"]["distance_m"] is None
    assert route["after_repairs"] == route["current"]
    assert route["route_impacts"] == []
