"""Profile-specific modeled pedestrian graphs, without optimization or I/O."""

from __future__ import annotations

from collections import defaultdict
from math import isfinite

import networkx as nx

from .contract import Barrier, ProblemInstance, Profile
from .validation import InvalidInstanceError

BLOCKED_BY_BARRIER = "blocked_by_barrier"


def _present_ids(
    instance: ProblemInstance, present: frozenset[str] | None
) -> frozenset[str]:
    if present is not None:
        probabilities = {
            barrier.id: barrier.presence_prob for barrier in instance.barriers
        }
        if not present <= probabilities.keys():
            raise InvalidInstanceError("scenario contains unknown barrier IDs")
        if any(probabilities[key] == 0 for key in present):
            raise InvalidInstanceError("scenario contains a known-absent barrier")
        return frozenset(present)
    if any(b.presence_prob not in (0, 1) for b in instance.barriers):
        raise InvalidInstanceError(
            "uncertain barriers require explicit present_barrier_ids"
        )
    return frozenset(b.id for b in instance.barriers if b.presence_prob == 1)


def _index_barriers(
    barriers: tuple[Barrier, ...], present: frozenset[str], profile: Profile
) -> tuple[set[str], dict[str, list[Barrier]]]:
    blocked_nodes: set[str] = set()
    by_edge: dict[str, list[Barrier]] = defaultdict(list)
    for barrier in barriers:
        if barrier.id not in present:
            continue
        if barrier.node_id is not None:
            if barrier.type in profile.impassable_types:
                blocked_nodes.add(barrier.node_id)
            elif profile.penalties.get(barrier.type, 0) > 0:
                raise InvalidInstanceError("soft node barrier penalties are undefined")
        else:
            assert barrier.edge_id is not None
            by_edge[barrier.edge_id].append(barrier)
    return blocked_nodes, by_edge


def build_graph(
    instance: ProblemInstance,
    profile_id: str,
    *,
    directed: bool,
    present_barrier_ids: frozenset[str] | None = None,
) -> nx.MultiGraph[str] | nx.MultiDiGraph[str]:
    """Build a fresh graph with edge-ID keys and generalized-meter `weight`.

    Direction is explicit; directed edges follow u -> v. Incline is a signed
    rise/run ratio; its absolute value is compared with max_incline. Unknown
    incline fails closed when the profile requires an incline limit. Hard node
    barriers isolate and mark the node as blocked. Soft node penalties are rejected: the contract
    does not define their traversal costs. Explicit presence is a realized
    scenario, not a probability-weighted graph. Parallel edges stay distinct.
    """
    if type(directed) is not bool:
        raise InvalidInstanceError("directed must be a boolean")
    profile = next((p for p in instance.profiles if p.id == profile_id), None)
    if profile is None:
        raise InvalidInstanceError(f"unknown profile {profile_id}")
    present = _present_ids(instance, present_barrier_ids)
    blocked_nodes, by_edge = _index_barriers(instance.barriers, present, profile)
    graph: nx.MultiGraph[str]
    graph = nx.MultiDiGraph() if directed else nx.MultiGraph()
    graph.add_nodes_from(node.id for node in instance.nodes)
    for node_id in blocked_nodes:
        graph.nodes[node_id][BLOCKED_BY_BARRIER] = True
    for edge in instance.edges:
        barriers = by_edge[edge.id]
        if edge.u in blocked_nodes or edge.v in blocked_nodes:
            continue
        if any(b.type in profile.impassable_types for b in barriers):
            continue
        if profile.max_incline is not None:
            incline = edge.attrs.get("incline")
            if incline is None or abs(float(incline)) > profile.max_incline:
                continue
        weight = edge.length_m * (
            1 + sum(profile.penalties.get(b.type, 0) for b in barriers)
        )
        if not isfinite(weight):
            raise InvalidInstanceError(f"edge {edge.id}: generalized cost overflow")
        graph.add_edge(
            edge.u,
            edge.v,
            key=edge.id,
            id=edge.id,
            length_m=edge.length_m,
            weight=weight,
            attrs=dict(edge.attrs),
        )
    return graph
