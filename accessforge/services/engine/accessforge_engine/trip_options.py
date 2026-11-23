"""Compare mapped crossing repairs between two snapped public landmark nodes."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from heapq import heappop, heappush

import networkx as nx

from .validation import InvalidInstanceError, identifier, number, unique

_PEDESTRIAN = frozenset({"sidewalk", "footway", "crossing"})
_KINDS = _PEDESTRIAN | {"street", "steps"}


@dataclass(frozen=True)
class TripEdge:
    id: str
    from_node: str
    to_node: str
    length_m: float
    kind: str

    def __post_init__(self) -> None:
        for value in (self.id, self.from_node, self.to_node):
            identifier(value, "edge or node ID")
        number(self.length_m, "length_m")
        if self.from_node == self.to_node or self.length_m == 0:
            raise InvalidInstanceError(
                "edge must connect distinct nodes with positive length"
            )
        if self.kind not in _KINDS:
            raise InvalidInstanceError(f"unknown mapped edge kind: {self.kind}")


@dataclass(frozen=True)
class TripBlocker:
    id: str
    node_id: str

    def __post_init__(self) -> None:
        identifier(self.id, "barrier ID")
        identifier(self.node_id, "barrier node ID")


@dataclass(frozen=True)
class CrossingOption:
    node_id: str
    barrier_ids: tuple[str, ...]
    alone_reachable: bool


@dataclass(frozen=True)
class TripOptions:
    baseline_reachable: bool
    combined_reachable: bool
    length_m: float | None
    edge_ids: tuple[str, ...]
    crossings: tuple[CrossingOption, ...]
    coverage_gap_edge_ids: tuple[str, ...]


_UNAVAILABLE = TripOptions(False, False, None, (), (), ())


def _graph(edges: Sequence[TripEdge]) -> nx.MultiGraph[str]:
    graph: nx.MultiGraph[str] = nx.MultiGraph()
    for edge in sorted(edges, key=lambda e: e.id):
        if edge.kind != "steps":
            graph.add_edge(edge.from_node, edge.to_node, key=edge.id, edge=edge)
    return graph


def _path(
    graph: nx.MultiGraph[str],
    start: str,
    end: str,
    blocked: set[str],
    *,
    survey_gaps: bool,
) -> list[tuple[str, TripEdge]]:
    """Lexicographic Dijkstra: minimize blocked sites (or proxy segments), then length."""
    if start not in graph or end not in graph:
        return []
    best = {start: (0, 0.0)}
    parent: dict[str, tuple[str, TripEdge]] = {}
    heap = [(0, 0.0, start)]
    while heap:
        count, length, node = heappop(heap)
        if (count, length) != best[node]:
            continue
        if node == end:
            break
        for neighbor, parallels in graph[node].items():
            for data in parallels.values():
                edge: TripEdge = data["edge"]
                proxy = edge.kind == "street"
                if proxy and not survey_gaps:
                    continue
                priority = proxy if survey_gaps else neighbor in blocked
                cost = (count + priority, length + edge.length_m)
                if neighbor not in best or cost < best[neighbor]:
                    best[neighbor] = cost
                    parent[neighbor] = (node, edge)
                    heappush(heap, (*cost, neighbor))
    path = []
    if end in parent:
        node = end
        while node != start:
            previous, edge = parent[node]
            path.append((node, edge))
            node = previous
    return list(reversed(path))


def compare_trip(
    start: str, end: str, edges: Iterable[TripEdge], blockers: Iterable[TripBlocker]
) -> TripOptions:
    """Model undirected connectivity, without a distance cutoff or an access guarantee."""
    identifier(start, "start node")
    identifier(end, "end node")
    road_edges = tuple(edges)
    obstacles = tuple(blockers)
    unique(tuple(edge.id for edge in road_edges), "edge IDs")
    unique(tuple(item.id for item in obstacles), "barrier IDs")
    if start == end:
        return _UNAVAILABLE
    sites: dict[str, list[str]] = defaultdict(list)
    for item in obstacles:
        sites[item.node_id].append(item.id)
    graph = _graph(road_edges)
    path = _path(graph, start, end, set(sites), survey_gaps=False)
    if not path:
        survey = _path(graph, start, end, set(), survey_gaps=True)
        gaps = tuple(edge.id for _, edge in survey if edge.kind == "street")
        return TripOptions(False, False, None, (), (), gaps)
    nodes = (start, *(node for node, _ in path))
    blocked = tuple(node for node in nodes if node in sites)
    # If two sites are necessary on a minimum-site path, no single repair anywhere suffices.
    crossings = tuple(
        CrossingOption(node, tuple(sorted(sites[node])), len(blocked) == 1)
        for node in blocked
    )
    return TripOptions(
        not blocked,
        True,
        sum(edge.length_m for _, edge in path),
        tuple(edge.id for _, edge in path),
        crossings,
        (),
    )
