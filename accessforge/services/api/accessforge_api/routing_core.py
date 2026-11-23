"""Pure route analysis over an engine instance: no I/O, no repair selection here."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from itertools import pairwise
from math import fsum
from typing import TypeVar

import networkx as nx
from accessforge_engine import ProblemInstance
from accessforge_engine.contract import Barrier, Destination, Origin, Profile
from accessforge_engine.graph import build_graph

from .routing_schemas import (
    RouteBarrierView,
    RouteComparison,
    RouteOutcome,
    RouteReason,
    RouteStatus,
)

LIMITATIONS = (
    "Synthetic demonstration network. Streets, barriers and destinations are generated, not Fremont data.",
    "A route is a modeled path over the edges and barriers in this model. It was not checked on site.",
    "An accessible route is not a guarantee of safety or step-free travel.",
    "Only recorded barriers are modeled. An unrecorded barrier can block any route.",
    "Repair effects are modeled for the recommended combination. Real repairs are unverified until checked on site.",
    "Costs are abstract cost units, not dollars.",
)
UNVERIFIED_LIMITATION = (
    "Some barriers are unverified. An uncertain route assumes they may be present."
)


@dataclass(frozen=True)
class RouteQuery:
    origin_id: str
    destination_id: str
    profile_id: str


@dataclass(frozen=True)
class _Route:
    cost: float
    distance_m: float
    node_ids: tuple[str, ...]
    edge_ids: tuple[str, ...]


_Item = TypeVar("_Item", Profile, Origin, Destination)


def _lookup(items: Iterable[_Item], item_id: str) -> _Item:
    for item in items:
        if item.id == item_id:
            return item
    raise LookupError(item_id)


def _leg(graph: nx.MultiGraph[str], u: str, v: str) -> tuple[str, float]:
    """The cheapest parallel edge between u and v, as (edge ID, length)."""
    edge_id, data = min(graph[u][v].items(), key=lambda item: item[1]["weight"])
    return edge_id, float(data["length_m"])


def _shortest(
    instance: ProblemInstance,
    profile: Profile,
    present: frozenset[str],
    query: RouteQuery,
) -> _Route | None:
    """Dijkstra over the engine's profile graph; the threshold cutoff matches engine reach."""
    graph = build_graph(
        instance, profile.id, directed=False, present_barrier_ids=present
    )
    origin = _lookup(instance.origins, query.origin_id).node_id
    destination = _lookup(instance.destinations, query.destination_id).node_id
    try:
        cost, nodes = nx.single_source_dijkstra(
            graph, origin, destination, cutoff=profile.threshold_m, weight="weight"
        )
    except nx.NetworkXNoPath:
        return None
    legs = [_leg(graph, u, v) for u, v in pairwise(nodes)]
    route = _Route(
        cost=float(cost),
        distance_m=fsum(length for _, length in legs),
        node_ids=tuple(nodes),
        edge_ids=tuple(edge_id for edge_id, _ in legs),
    )
    if _blocked_on_route(instance, route, present, profile):
        return None
    return route


def _blocked_on_route(
    instance: ProblemInstance, route: _Route, present: frozenset[str], profile: Profile
) -> bool:
    """A present barrier that impedes this profile stops the route, even at a shared endpoint."""
    return any(
        item.blocks_profile for item in _touching(instance, route, present, profile)
    )


def _view(barrier: Barrier, profile: Profile) -> RouteBarrierView:
    return RouteBarrierView(
        id=barrier.id,
        edge_id=barrier.edge_id,
        node_id=barrier.node_id,
        type=barrier.type,
        severity=barrier.severity,
        verified=barrier.presence_prob == 1,
        blocks_profile=barrier.type in profile.impassable_types,
    )


def _touching(
    instance: ProblemInstance, route: _Route, present: frozenset[str], profile: Profile
) -> tuple[RouteBarrierView, ...]:
    edges = set(route.edge_ids)
    nodes = set(route.node_ids)
    return tuple(
        _view(barrier, profile)
        for barrier in instance.barriers
        if barrier.id in present
        and (barrier.edge_id in edges or barrier.node_id in nodes)
    )


def _found(
    status: RouteStatus,
    route: _Route,
    instance: ProblemInstance,
    profile: Profile,
    present: frozenset[str],
) -> RouteOutcome:
    return RouteOutcome(
        status=status,
        reason=None,
        generalized_cost=route.cost,
        distance_m=route.distance_m,
        node_ids=route.node_ids,
        edge_ids=route.edge_ids,
        barriers_on_route=_touching(instance, route, present, profile),
    )


def _touches_unverified(
    instance: ProblemInstance, route: _Route, present: frozenset[str], profile: Profile
) -> bool:
    return any(
        not item.verified for item in _touching(instance, route, present, profile)
    )


def _outcome(
    instance: ProblemInstance,
    profile: Profile,
    query: RouteQuery,
    possible: frozenset[str],
    certain: frozenset[str],
    unobstructed: _Route | None,
) -> RouteOutcome:
    """Accessible only when no unverified barrier lies on the route; otherwise the ladder continues."""
    route = _shortest(instance, profile, possible, query)
    if route is not None and not _touches_unverified(
        instance, route, possible, profile
    ):
        return _found(RouteStatus.accessible, route, instance, profile, possible)
    route = _shortest(instance, profile, certain, query)
    if route is not None:
        # Listing uses the possible set so unverified barriers on the route stay visible.
        return _found(RouteStatus.uncertain, route, instance, profile, possible)
    reason = (
        RouteReason.barrier
        if unobstructed is not None
        else RouteReason.distance_or_disconnected
    )
    return RouteOutcome(
        status=RouteStatus.no_route,
        reason=reason,
        generalized_cost=None,
        distance_m=None,
        node_ids=(),
        edge_ids=(),
        barriers_on_route=(),
    )


def _possible_ids(instance: ProblemInstance) -> frozenset[str]:
    """Presence > 0. A barrier with presence 0 is recorded as absent and is never listed."""
    return frozenset(b.id for b in instance.barriers if b.presence_prob > 0)


def _verified_ids(instance: ProblemInstance) -> frozenset[str]:
    return frozenset(b.id for b in instance.barriers if b.presence_prob == 1)


def _removed_barriers(
    instance: ProblemInstance, selected_repair_ids: tuple[str, ...]
) -> frozenset[str]:
    repairs = {repair.id: repair for repair in instance.repairs}
    missing = [key for key in selected_repair_ids if key not in repairs]
    if missing:
        raise LookupError(missing[0])
    return frozenset(b for key in selected_repair_ids for b in repairs[key].barrier_ids)


def compare_routes(
    instance: ProblemInstance,
    query: RouteQuery,
    selected_repair_ids: tuple[str, ...],
) -> RouteComparison:
    """Current route versus the route after the selected repairs, on the same profile.

    Raises LookupError for an unknown origin, destination, profile or repair ID.
    """
    profile = _lookup(instance.profiles, query.profile_id)
    _lookup(instance.origins, query.origin_id)
    _lookup(instance.destinations, query.destination_id)
    removed = _removed_barriers(instance, selected_repair_ids)
    unobstructed = _shortest(instance, profile, frozenset(), query)
    affecting = (
        ()
        if unobstructed is None
        else _touching(instance, unobstructed, _possible_ids(instance), profile)
    )
    has_unverified = any(0 < b.presence_prob < 1 for b in instance.barriers)
    return RouteComparison(
        threshold_m=profile.threshold_m,
        current=_outcome(
            instance,
            profile,
            query,
            _possible_ids(instance),
            _verified_ids(instance),
            unobstructed,
        ),
        after_repairs=_outcome(
            instance,
            profile,
            query,
            _possible_ids(instance) - removed,
            _verified_ids(instance) - removed,
            unobstructed,
        ),
        affecting_barriers=affecting,
        limitations=LIMITATIONS + ((UNVERIFIED_LIMITATION,) if has_unverified else ()),
    )
