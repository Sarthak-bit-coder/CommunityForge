"""Edge cases for route analysis: absent barriers, unverified crossings, bad IDs, disconnection."""

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

from accessforge_api.routing_core import RouteQuery, compare_routes
from accessforge_api.routing_schemas import RouteReason, RouteStatus

TRIP = RouteQuery("home", "clinic", "p")


def _instance(
    *,
    presence: float = 1.0,
    penalties: dict[str, float] | None = None,
    impassable: frozenset[str] = frozenset(),
    destination_node: str = "b",
    edges: tuple[Edge, ...] | None = None,
) -> ProblemInstance:
    return ProblemInstance(
        edges or (Edge("e0", "a", "b", 25, {"incline": 0}),),
        (Barrier("b0", "e0", None, "rough", 2, presence),),
        (Repair("r0", ("b0",), 10, 10, 10),),
        (Profile("p", 1.0, None, impassable, penalties or {}, 100),),
        (Origin("home", "a", 1, "g"),),
        (Destination("clinic", destination_node, "health", 1),),
        (Node("a"), Node("b"), Node("c")),
    )


def test_known_absent_barrier_is_not_listed_as_affecting() -> None:
    comparison = compare_routes(_instance(presence=0), TRIP, ())
    assert comparison.affecting_barriers == ()
    assert comparison.current.status == RouteStatus.accessible


def test_unverified_soft_barrier_on_route_is_uncertain_not_accessible() -> None:
    comparison = compare_routes(
        _instance(presence=0.5, penalties={"rough": 1.0}), TRIP, ()
    )
    assert comparison.current.status == RouteStatus.uncertain
    [crossed] = comparison.current.barriers_on_route
    assert crossed.id == "b0"
    assert crossed.verified is False


def test_verified_soft_barrier_keeps_route_accessible() -> None:
    comparison = compare_routes(_instance(penalties={"rough": 1.0}), TRIP, ())
    assert comparison.current.status == RouteStatus.accessible
    [crossed] = comparison.current.barriers_on_route
    assert crossed.verified is True
    # Penalty doubles the edge cost, so the route's cost exceeds its length.
    assert comparison.current.generalized_cost == 50
    assert comparison.current.distance_m == 25


def test_disconnected_destination_reports_distance_or_disconnected() -> None:
    instance = _instance(
        destination_node="c", edges=(Edge("e0", "a", "b", 25, {"incline": 0}),)
    )
    comparison = compare_routes(instance, TRIP, ())
    assert comparison.current.status == RouteStatus.no_route
    assert comparison.current.reason == RouteReason.distance_or_disconnected
    assert comparison.affecting_barriers == ()


def test_origin_equal_to_destination_is_a_zero_length_route() -> None:
    comparison = compare_routes(_instance(destination_node="a"), TRIP, ())
    assert comparison.current.status == RouteStatus.accessible
    assert comparison.current.distance_m == 0
    assert comparison.current.node_ids == ("a",)
    assert comparison.current.edge_ids == ()


def test_confirmed_blocked_node_at_colocated_endpoints_is_not_accessible() -> None:
    # Arrange: a confirmed impassable step sits on the single shared node.
    instance = ProblemInstance(
        (Edge("e0", "a", "b", 25, {"incline": 0}),),
        (Barrier("b0", None, "a", "step", 3, 1.0),),
        (Repair("r0", ("b0",), 10, 10, 10),),
        (Profile("p", 1.0, None, frozenset({"step"}), {}, 100),),
        (Origin("home", "a", 1, "g"),),
        (Destination("clinic", "a", "health", 1),),
        (Node("a"), Node("b")),
    )
    # Act
    comparison = compare_routes(instance, TRIP, ())
    # Assert: a zero-length route through a confirmed blocked node is never accessible.
    assert comparison.current.status == RouteStatus.no_route
    assert comparison.current.reason == RouteReason.barrier
    assert comparison.current.node_ids == ()


@pytest.mark.parametrize(
    ("query", "repairs"),
    [
        (RouteQuery("nowhere", "clinic", "p"), ()),
        (RouteQuery("home", "nowhere", "p"), ()),
        (RouteQuery("home", "clinic", "unknown"), ()),
        (TRIP, ("missing",)),
    ],
)
def test_unknown_identifiers_raise_lookup_error(
    query: RouteQuery, repairs: tuple[str, ...]
) -> None:
    with pytest.raises(LookupError):
        compare_routes(_instance(), query, repairs)
