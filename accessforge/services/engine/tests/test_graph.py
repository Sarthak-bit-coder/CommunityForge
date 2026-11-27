from dataclasses import replace

import networkx as nx
import pytest
from hypothesis import given, strategies as st

from accessforge_engine import Barrier, Edge, InvalidInstanceError, build_graph
from test_contract import instance, profile


def test_mobility_profiles_have_different_passability() -> None:
    data = instance()
    pedestrian = replace(
        profile(), id="pedestrian", max_incline=None, impassable_types=frozenset()
    )
    data = replace(data, profiles=(*data.profiles, pedestrian))
    wheelchair_graph = build_graph(data, "wheelchair", directed=False)
    walking_graph = build_graph(data, "pedestrian", directed=False)
    assert not nx.has_path(wheelchair_graph, "a", "b")
    assert nx.shortest_path_length(walking_graph, "a", "b", weight="weight") == 10


def test_disconnected_nodes_are_preserved() -> None:
    graph = build_graph(instance(), "wheelchair", directed=False)
    assert set(graph) == {"a", "b", "isolated"}
    assert nx.number_connected_components(graph) == 3
    with pytest.raises(nx.NetworkXNoPath):
        nx.shortest_path(graph, "a", "isolated")


def test_parallel_edges_and_direction_are_preserved() -> None:
    data = replace(
        instance(),
        barriers=(),
        repairs=(),
        edges=(
            Edge("short", "a", "b", 2, {"incline": 0}),
            Edge("long", "a", "b", 7, {"incline": 0}),
        ),
    )
    graph = build_graph(data, "wheelchair", directed=True)
    assert graph.number_of_edges() == 2
    assert set(graph["a"]["b"]) == {"short", "long"}
    assert nx.shortest_path_length(graph, "a", "b", weight="weight") == 2
    assert not nx.has_path(graph, "b", "a")
    assert nx.has_path(build_graph(data, "wheelchair", directed=False), "b", "a")


@pytest.mark.parametrize(
    "incline,passable",
    [(0.08, True), (-0.08, True), (0.081, False), (-0.081, False), (None, False)],
)
def test_incline_limits_are_inclusive_and_missing_fails_closed(
    incline: float | None, passable: bool
) -> None:
    attrs = {} if incline is None else {"incline": incline}
    data = replace(
        instance(), barriers=(), repairs=(), edges=(Edge("ab", "a", "b", 10, attrs),)
    )
    graph = build_graph(data, "wheelchair", directed=False)
    assert nx.has_path(graph, "a", "b") is passable


def test_edge_penalties_have_hand_computed_cost_without_severity_scaling() -> None:
    data = replace(
        instance(),
        barriers=(
            Barrier("r1", "ab", None, "rough", 1, 1),
            Barrier("r2", "ab", None, "rough", 5, 1),
        ),
        repairs=(),
    )
    graph = build_graph(data, "wheelchair", directed=False)
    assert graph["a"]["b"]["ab"]["weight"] == 10 * (1 + 2 + 2)
    assert graph["a"]["b"]["ab"]["length_m"] == 10


def test_node_barrier_blocks_all_incident_edges() -> None:
    data = replace(
        instance(),
        barriers=(Barrier("node", None, "b", "step", 3, 1),),
        repairs=(),
        edges=(*instance().edges, Edge("bi", "b", "isolated", 3, {"incline": 0})),
    )
    graph = build_graph(data, "wheelchair", directed=True)
    assert graph.number_of_edges() == 0
    assert "b" in graph


def test_soft_node_penalties_fail_instead_of_inventing_costs() -> None:
    data = replace(
        instance(), barriers=(Barrier("node", None, "b", "rough", 3, 1),), repairs=()
    )
    with pytest.raises(InvalidInstanceError, match="soft node"):
        build_graph(data, "wheelchair", directed=False)


def test_uncertain_presence_requires_explicit_scenario() -> None:
    data = replace(
        instance(), barriers=(replace(instance().barriers[0], presence_prob=0.5),)
    )
    with pytest.raises(InvalidInstanceError, match="explicit"):
        build_graph(data, "wheelchair", directed=False)
    absent = build_graph(
        data, "wheelchair", directed=False, present_barrier_ids=frozenset()
    )
    present = build_graph(
        data, "wheelchair", directed=False, present_barrier_ids=frozenset({"barrier"})
    )
    assert nx.has_path(absent, "a", "b")
    assert not nx.has_path(present, "a", "b")


def test_zero_probability_barrier_is_absent() -> None:
    data = replace(
        instance(), barriers=(replace(instance().barriers[0], presence_prob=0),)
    )
    assert nx.has_path(build_graph(data, "wheelchair", directed=False), "a", "b")


def test_known_absent_barrier_cannot_be_present_in_an_explicit_scenario() -> None:
    data = replace(
        instance(), barriers=(replace(instance().barriers[0], presence_prob=0),)
    )
    with pytest.raises(InvalidInstanceError, match="known-absent"):
        build_graph(
            data,
            "wheelchair",
            directed=False,
            present_barrier_ids=frozenset({"barrier"}),
        )


def test_invalid_graph_arguments_fail() -> None:
    with pytest.raises(InvalidInstanceError, match="unknown profile"):
        build_graph(instance(), "missing", directed=False)
    with pytest.raises(InvalidInstanceError, match="unknown barrier"):
        build_graph(
            instance(),
            "wheelchair",
            directed=False,
            present_barrier_ids=frozenset({"missing"}),
        )
    with pytest.raises(InvalidInstanceError, match="boolean"):
        build_graph(instance(), "wheelchair", directed="false")  # type: ignore[arg-type]


def test_graph_is_fresh_deterministic_and_does_not_mutate_inputs() -> None:
    data = replace(instance(), barriers=(), repairs=())
    first = build_graph(data, "wheelchair", directed=False)
    second = build_graph(data, "wheelchair", directed=False)
    assert nx.utils.graphs_equal(first, second)
    first["a"]["b"]["ab"]["attrs"]["incline"] = 10
    first.remove_node("a")
    assert "a" in second
    assert data.edges[0].attrs["incline"] == 0.04


def test_empty_network_is_valid() -> None:
    data = replace(
        instance(),
        edges=(),
        barriers=(),
        repairs=(),
        origins=(),
        destinations=(),
        nodes=(),
    )
    assert len(build_graph(data, "wheelchair", directed=False)) == 0


def test_generalized_cost_overflow_fails() -> None:
    data = replace(
        instance(),
        edges=(Edge("ab", "a", "b", 1e308, {"incline": 0}),),
        barriers=(Barrier("rough", "ab", None, "rough", 1, 1),),
        repairs=(),
    )
    with pytest.raises(InvalidInstanceError, match="overflow"):
        build_graph(data, "wheelchair", directed=False)


@given(st.floats(min_value=0, max_value=1e6, allow_nan=False, allow_infinity=False))
def test_removing_nonnegative_penalty_never_increases_edge_cost(penalty: float) -> None:
    data = replace(
        instance(),
        profiles=(
            replace(
                profile(), penalties={"step": penalty}, impassable_types=frozenset()
            ),
        ),
    )
    before = build_graph(data, "wheelchair", directed=False)
    after = build_graph(
        data, "wheelchair", directed=False, present_barrier_ids=frozenset()
    )
    assert after["a"]["b"]["ab"]["weight"] <= before["a"]["b"]["ab"]["weight"]
