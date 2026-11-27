"""Keep the largest connected piece of the network and report what was dropped."""

from dataclasses import dataclass, replace

import networkx as nx

from .osm import Network


@dataclass(frozen=True)
class ConnectivityReport:
    components: int
    kept_edges: int
    dropped_edges: int
    dropped_component_sizes: tuple[int, ...]  # edge counts, largest first


def largest_component(network: Network) -> tuple[Network, ConnectivityReport]:
    graph: nx.MultiGraph[int] = nx.MultiGraph()
    for index, edge in enumerate(network.edges):
        graph.add_edge(edge.node_ids[0], edge.node_ids[-1], key=index)
    components = sorted(nx.connected_components(graph), key=len, reverse=True)
    if not components:
        raise ValueError("network has no walkable edges")
    keep = components[0]
    edges = tuple(e for e in network.edges if e.node_ids[0] in keep)
    used = {n for e in edges for n in e.node_ids}
    dropped_sizes = sorted(
        (graph.subgraph(c).number_of_edges() for c in components[1:]), reverse=True
    )
    kept = replace(
        network,
        nodes={n: node for n, node in network.nodes.items() if n in used},
        edges=edges,
        raised_kerbs=tuple(k for k in network.raised_kerbs if k.osm_id in used),
    )
    report = ConnectivityReport(
        len(components),
        len(edges),
        len(network.edges) - len(edges),
        tuple(dropped_sizes),
    )
    return kept, report
