from itertools import permutations

import networkx as nx
import pytest
from hypothesis import given, strategies as st

from accessforge_engine.trip_options import TripBlocker, TripEdge, compare_trip
from accessforge_engine.validation import InvalidInstanceError


def edge(a: str, b: str, length: float = 10, kind: str = "sidewalk") -> TripEdge:
    return TripEdge(f"{a}-{b}", a, b, length, kind)


def test_two_crossings_are_jointly_necessary() -> None:
    edges = (edge("a", "b"), edge("b", "c", kind="crossing"), edge("c", "d"))
    blockers = (TripBlocker("1", "b"), TripBlocker("2", "c"))
    result = compare_trip("a", "d", edges, blockers)
    assert not result.baseline_reachable and result.combined_reachable
    assert result.length_m == 30
    assert result.edge_ids == ("a-b", "b-c", "c-d")
    assert [(c.node_id, c.alone_reachable) for c in result.crossings] == [
        ("b", False),
        ("c", False),
    ]


def test_existing_detour_wins_over_a_shorter_blocked_path() -> None:
    edges = (edge("a", "b"), edge("b", "d"), edge("a", "d", 100))
    result = compare_trip("a", "d", edges, (TripBlocker("1", "b"),))
    assert result.baseline_reachable and result.length_m == 100
    assert result.crossings == ()


def test_multiple_observations_at_a_crossing_count_as_one_site() -> None:
    result = compare_trip(
        "a", "b", (edge("a", "b"),), (TripBlocker("y", "a"), TripBlocker("x", "a"))
    )
    assert result.crossings[0].barrier_ids == ("x", "y")
    assert result.crossings[0].alone_reachable
    assert not result.baseline_reachable


def test_gap_ids_identify_only_street_proxies_on_a_connection() -> None:
    edges = (
        edge("a", "b", kind="street"),
        edge("b", "c"),
        edge("a", "c", kind="steps"),
        edge("x", "y", kind="street"),
    )
    result = compare_trip("a", "c", edges, ())
    assert not result.combined_reachable and result.length_m is None
    assert result.edge_ids == ()
    assert result.coverage_gap_edge_ids == ("a-b",)


def test_disconnected_or_shared_anchors_do_not_establish_reach() -> None:
    edges = (edge("a", "b"), edge("c", "d"))
    for start, end in [("a", "d"), ("a", "a"), ("unmapped", "b")]:
        result = compare_trip(start, end, edges, ())
        assert not result.combined_reachable and not result.coverage_gap_edge_ids


def test_edge_order_does_not_change_parallel_or_tied_routes() -> None:
    edges = (
        edge("a", "b"),
        TripEdge("alternate", "a", "b", 10, "sidewalk"),
        edge("b", "c"),
        edge("a", "x"),
        edge("x", "c"),
    )
    expected = compare_trip("a", "c", edges, ())
    for perm in permutations(edges):
        assert compare_trip("a", "c", perm, ()) == expected


def test_invalid_geometry_and_duplicate_ids_are_rejected() -> None:
    with pytest.raises(InvalidInstanceError):
        compare_trip("a", "b", (edge("a", "b", float("nan")),), ())
    with pytest.raises(InvalidInstanceError):
        compare_trip("a", "b", (edge("a", "b"), edge("a", "b")), ())


def test_blockers_on_both_landmark_anchors_are_counted() -> None:
    result = compare_trip(
        "a", "b", (edge("a", "b"),), (TripBlocker("one", "a"), TripBlocker("two", "b"))
    )
    assert [item.node_id for item in result.crossings] == ["a", "b"]
    assert all(not item.alone_reachable for item in result.crossings)


@given(
    st.sets(st.sampled_from(("ab", "ac", "ad", "bc", "bd", "cd"))),
    st.sets(st.sampled_from(("a", "b", "c", "d"))),
)
def test_crossing_count_and_length_match_all_simple_routes(
    links: set[str], blocked: set[str]
) -> None:
    edges = tuple(edge(pair[0], pair[1], i + 1) for i, pair in enumerate(sorted(links)))
    graph: nx.Graph[str] = nx.Graph()
    graph.add_nodes_from(("a", "b", "c", "d"))
    for link in edges:
        graph.add_edge(link.from_node, link.to_node, weight=link.length_m)
    options = compare_trip(
        "a", "d", edges, (TripBlocker(node, node) for node in blocked)
    )
    routes = [
        (len(set(nodes) & blocked), nx.path_weight(graph, nodes, "weight"))
        for nodes in nx.all_simple_paths(graph, "a", "d")
    ]
    assert options.combined_reachable == bool(routes)
    if routes:
        assert (len(options.crossings), options.length_m) == min(routes)
        assert options.baseline_reachable == (min(routes)[0] == 0)
