from dataclasses import replace

import networkx as nx
import pytest

from accessforge_engine import InvalidInstanceError, evaluate
from accessforge_engine.synthetic import (
    SyntheticConfig,
    generate_network,
    complementarity_case,
)
from test_evaluation import params


def test_seed_reproduces_network_and_changes_draws() -> None:
    config = SyntheticConfig(width=4, height=3, barrier_count=5)
    first = generate_network(config, seed=17)
    assert first == generate_network(config, seed=17)
    assert first != generate_network(config, seed=18)
    assert len(first.instance.nodes) == 12
    assert len(first.instance.edges) == 17
    assert len(first.instance.repairs) == len(first.instance.barriers) == 5


def test_full_clustering_places_barriers_on_connected_edges() -> None:
    network = generate_network(
        SyntheticConfig(width=5, height=4, barrier_count=6, clustering=1), seed=4
    )
    by_id = {edge.id: edge for edge in network.instance.edges}
    graph = nx.Graph()
    for barrier in network.instance.barriers:
        edge = by_id[barrier.edge_id]
        graph.add_edge(edge.u, edge.v)
    assert nx.is_connected(graph)
    assert len({b.edge_id for b in network.instance.barriers}) == 6


def test_cost_bounds_and_zero_barriers() -> None:
    config = SyntheticConfig(width=3, height=2, barrier_count=4, cost_min=7, cost_max=7)
    assert all(r.cost == 7 for r in generate_network(config, seed=1).instance.repairs)
    assert (
        generate_network(replace(config, barrier_count=0), seed=1).instance.repairs
        == ()
    )


@pytest.mark.parametrize(
    "changes",
    [
        {"width": 1},
        {"height": 0},
        {"barrier_count": -1},
        {"barrier_count": 999},
        {"clustering": -0.1},
        {"clustering": float("nan")},
        {"clustering": 1.1},
        {"cost_min": -1},
        {"cost_min": 40, "cost_max": 10},
        {"cost_max": 1.5},
        {"threshold_m": -1},
        {"edge_length_m": 0},
    ],
)
def test_invalid_config_fails(changes: dict[str, object]) -> None:
    with pytest.raises(InvalidInstanceError):
        replace(SyntheticConfig(), **changes)


def test_invalid_seed_and_positions_fail() -> None:
    with pytest.raises(InvalidInstanceError):
        generate_network(SyntheticConfig(), seed=-1)
    with pytest.raises(InvalidInstanceError):
        replace(complementarity_case(), positions={})


def test_complementarity_fixture_has_hand_computed_access() -> None:
    data = complementarity_case().instance
    assert evaluate(data, (), params()).before.total == 10
    assert evaluate(data, ("r0",), params()).delta_a_expected == 0
    assert evaluate(data, ("r1",), params()).delta_a_expected == 0
    assert evaluate(data, ("r0", "r1"), params()).delta_a_expected == 10
