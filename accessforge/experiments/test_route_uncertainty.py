"""Check route status at the API boundary on the engine's synthetic corridor."""

from dataclasses import replace

import pytest
from accessforge_api.routing_core import RouteQuery, compare_routes
from accessforge_api.routing_schemas import RouteReason, RouteStatus
from accessforge_engine.synthetic import complementarity_case

TRIP = RouteQuery("home", "clinic", "wheelchair")


@pytest.mark.parametrize("gap", ["unknown incline", "missing edge", "none"])
def test_unverified_barrier_cannot_explain_away_missing_connectivity(gap: str) -> None:
    data = complementarity_case().instance
    first, last = data.edges
    edges = (first, replace(last, attrs={})) if gap == "unknown incline" else data.edges
    data = replace(
        data,
        edges=(first,) if gap == "missing edge" else edges,
        barriers=(replace(data.barriers[0], presence_prob=0.5),),
        repairs=(),
    )

    comparison = compare_routes(data, TRIP, ())

    assert comparison.current == comparison.after_repairs
    if gap == "none":
        assert comparison.current.status == RouteStatus.uncertain
        assert comparison.current.barriers_on_route[0].verified is False
    else:
        assert comparison.current.status == RouteStatus.no_route
        assert comparison.current.reason == RouteReason.distance_or_disconnected
        assert comparison.current.distance_m is None


def test_confirmed_blocked_node_is_unavailable_even_for_colocated_endpoints() -> None:
    data = complementarity_case().instance
    node = data.origins[0].node_id
    data = replace(
        data,
        destinations=(replace(data.destinations[0], node_id=node),),
        barriers=(replace(data.barriers[0], edge_id=None, node_id=node),),
        repairs=(),
    )

    outcome = compare_routes(data, TRIP, ()).current

    assert outcome.status == RouteStatus.no_route
    assert outcome.reason == RouteReason.barrier
    assert outcome.distance_m is None
