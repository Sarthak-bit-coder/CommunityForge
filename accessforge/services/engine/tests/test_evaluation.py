"""Hand-computed modeled access and removal-only invariants."""

from dataclasses import replace
from unittest.mock import patch

import networkx as nx
import pytest
from hypothesis import given, strategies as st

from accessforge_engine import (
    Barrier,
    Destination,
    Edge,
    InvalidInstanceError,
    Node,
    Origin,
    ProblemInstance,
    Repair,
    SolveParams,
    evaluate,
)
from test_contract import instance, profile


def params(budget: float = 100, n_scenarios: int = 1) -> SolveParams:
    return SolveParams(budget, "evaluation", n_scenarios, 0, None, 10)


def corridor() -> ProblemInstance:
    return ProblemInstance(
        (
            Edge("ab", "a", "b", 5, {"incline": 0}),
            Edge("bc", "b", "c", 5, {"incline": 0}),
        ),
        (
            Barrier("a", "ab", None, "step", 3, 1),
            Barrier("b", "bc", None, "step", 3, 1),
        ),
        (Repair("a", ("a",), 1, 1, 1), Repair("b", ("b",), 1, 1, 1)),
        (replace(profile(), threshold_m=10),),
        (Origin("home", "a", 3, "north"),),
        (Destination("clinic", "c", "health", 2),),
        (Node("a"), Node("b"), Node("c"), Node("isolated")),
    )


def test_weighted_access_for_two_profiles_and_multiple_origins() -> None:
    pedestrian = replace(
        profile(), id="walking", weight=0.25, impassable_types=frozenset()
    )
    data = replace(
        instance(),
        profiles=(replace(profile(), weight=0.75), pedestrian),
        origins=(Origin("home", "a", 10, "north"), Origin("other", "b", 4, "south")),
        destinations=(
            Destination("clinic", "b", "health", 2),
            Destination("park", "isolated", "park", 7),
        ),
    )
    result = evaluate(data, ("repair",), params())
    # Walking: .25*(10*2+4*2)=7. Wheelchair baseline: .75*(4*2)=6.
    assert result.before.total == 13
    assert result.after.total == 28
    assert result.before.by_profile == {"wheelchair": 6, "walking": 7}
    assert result.after.by_profile == {"wheelchair": 21, "walking": 7}
    assert result.delta_a_expected == 15
    assert result.delta_a_by_profile == {"wheelchair": 15, "walking": 0}
    assert result.delta_a_by_group == {"north": 15, "south": 0}
    assert (
        result.before.reachable_probabilities.get(("wheelchair", "home", "clinic"), 0)
        == 0
    )
    assert result.after.reachable_probabilities[("wheelchair", "home", "clinic")] == 1
    assert all(key[2] != "park" for key in result.after.reachable_probabilities)


def test_dependent_repairs_only_unlock_access_together() -> None:
    data = corridor()
    for selection in ((), ("a",), ("b",)):
        assert evaluate(data, selection, params()).delta_a_expected == 0
    both = evaluate(data, ("a", "b"), params())
    assert both.before.total == 0
    assert both.after.total == both.delta_a_expected == 3 * 2
    assert data.barriers[0].presence_prob == 1


def test_overlapping_repairs_are_idempotent_but_costs_are_additive() -> None:
    data = replace(
        instance(),
        repairs=(
            Repair("first", ("barrier",), 1, 1, 1),
            Repair("second", ("barrier",), 2, 2, 2),
        ),
    )
    first = evaluate(data, ("first",), params())
    both = evaluate(data, ("first", "second"), params())
    assert first.delta_a_expected == both.delta_a_expected == 10
    assert both.total_cost == 3


def test_multi_barrier_repair_removes_both_serial_obstacles() -> None:
    data = replace(corridor(), repairs=(Repair("bundle", ("a", "b"), 2, 2, 2),))
    assert evaluate(data, ("bundle",), params()).delta_a_expected == 6


@pytest.mark.parametrize("threshold,expected", [(9.99, 0), (10, 6), (10.01, 6)])
def test_inclusive_distance_threshold(threshold: float, expected: float) -> None:
    data = replace(corridor(), profiles=(replace(profile(), threshold_m=threshold),))
    assert evaluate(data, ("a", "b"), params()).after.total == expected


def test_soft_penalty_removal_restores_within_threshold_access() -> None:
    data = replace(
        instance(),
        barriers=(Barrier("barrier", "ab", None, "rough", 1, 1),),
        profiles=(replace(profile(), threshold_m=20),),
    )
    result = evaluate(data, ("repair",), params())
    # Penalized distance 10*(1+2)=30; repaired distance 10.
    assert result.before.total == 0
    assert result.after.total == 10


def test_hard_node_repair_cannot_override_structural_incline_limit() -> None:
    data = replace(instance(), barriers=(Barrier("barrier", None, "b", "step", 1, 1),))
    assert evaluate(data, ("repair",), params()).after.total == 10
    steep = replace(data, edges=(replace(data.edges[0], attrs={"incline": 0.1}),))
    assert evaluate(steep, ("repair",), params()).after.total == 0


def test_zero_distance_counts_isolated_colocated_destination() -> None:
    data = replace(
        instance(),
        origins=(Origin("home", "isolated", 3, "tract"),),
        destinations=(Destination("clinic", "isolated", "health", 2),),
        profiles=(replace(profile(), threshold_m=0),),
    )
    result = evaluate(data, (), params())
    assert result.before.total == result.after.total == 6


@pytest.mark.parametrize("presence", [0, 0.5, 1])
def test_colocated_destination_respects_node_barrier_presence(presence: float) -> None:
    data = replace(
        instance(),
        barriers=(Barrier("barrier", None, "b", "step", 3, presence),),
        origins=(Origin("home", "b", 1, "tract"),),
        profiles=(replace(profile(), threshold_m=0),),
    )

    result = evaluate(data, ("repair",), params(n_scenarios=4))

    assert result.before.total == 1 - presence
    assert result.after.total == 1


def test_empty_origins_or_destinations_have_zero_access() -> None:
    for data in (replace(instance(), origins=()), replace(instance(), destinations=())):
        result = evaluate(data, (), params())
        assert result.before.total == result.after.total == result.delta_a_expected == 0


def test_unchanged_scenario_and_colocated_origins_share_one_search() -> None:
    data = replace(
        instance(),
        barriers=(),
        repairs=(),
        origins=(Origin("home", "a", 2, "north"), Origin("other", "a", 3, "south")),
    )
    with patch(
        "accessforge_engine.evaluation.nx.single_source_dijkstra_path_length",
        wraps=nx.single_source_dijkstra_path_length,
    ) as search:
        result = evaluate(data, (), params())

    assert search.call_count == 1
    assert result.before == result.after
    assert result.after.by_group == {"north": 2, "south": 3}


def test_explicit_directionality_preserves_three_argument_call() -> None:
    data = replace(
        instance(),
        origins=(Origin("home", "b", 1, "tract"),),
        destinations=(Destination("clinic", "a", "health", 1),),
    )
    assert evaluate(data, ("repair",), params()).after.total == 1
    assert evaluate(data, ("repair",), params(), directed=True).after.total == 0


def test_uncertain_before_after_use_same_seeded_scenarios() -> None:
    data = replace(
        instance(), barriers=(replace(instance().barriers[0], presence_prob=0.5),)
    )
    # Random(0)'s first four draws: .844, .758, .421, .259; present twice.
    result = evaluate(data, ("repair",), params(n_scenarios=4))
    assert result.before.total == 5
    assert result.after.total == 10
    assert result.delta_a_expected == 5
    assert (
        result.before.reachable_probabilities[("wheelchair", "home", "clinic")] == 0.5
    )
    assert evaluate(data, ("repair",), params(n_scenarios=4)) == result
    assert evaluate(data, (), params(n_scenarios=4)).delta_a_expected == 0


def test_selection_and_barrier_order_do_not_change_seeded_results() -> None:
    data = replace(
        corridor(),
        barriers=tuple(replace(b, presence_prob=0.5) for b in corridor().barriers),
    )
    first = evaluate(data, ("a", "b"), params(n_scenarios=10))
    reverse = evaluate(
        replace(data, barriers=tuple(reversed(data.barriers))),
        ("b", "a"),
        params(n_scenarios=10),
    )
    assert first == reverse


@pytest.mark.parametrize(
    "selection", [("missing",), ("repair", "repair"), ("",), "repair"]
)
def test_invalid_selection_fails(selection: tuple[str, ...]) -> None:
    with pytest.raises(InvalidInstanceError):
        evaluate(instance(), selection, params())


def test_budget_feasibility_is_reported_without_filtering_repairs() -> None:
    result = evaluate(instance(), ("repair",), params(budget=4))
    assert result.total_cost == 5
    assert result.budget_feasible is False
    assert result.after.total == 10
    assert evaluate(instance(), ("repair",), params(budget=5)).budget_feasible is True


def test_results_are_read_only() -> None:
    result = evaluate(instance(), ("repair",), params())
    with pytest.raises(TypeError):
        result.after.by_profile["wheelchair"] = 0  # type: ignore[index]
    with pytest.raises(TypeError):
        result.after.reachable_probabilities[("wheelchair", "home", "clinic")] = 0  # type: ignore[index]


def test_accessibility_overflow_fails_clearly() -> None:
    data = replace(
        instance(),
        origins=(Origin("home", "b", 1e308, "tract"),),
        destinations=(Destination("clinic", "b", "health", 2),),
    )
    with pytest.raises(InvalidInstanceError, match="finite"):
        evaluate(data, (), params())


@given(
    st.lists(
        st.tuples(st.integers(0, 3), st.integers(0, 3), st.integers(0, 20)), max_size=6
    ),
    st.sampled_from([0.0, 0.5, 1.0]),
    st.booleans(),
)
def test_repair_supersets_have_nondecreasing_access(
    edges: list[tuple[int, int, int]], probability: float, directed: bool
) -> None:
    data = ProblemInstance(
        tuple(
            Edge(str(i), str(u), str(v), length, {"incline": 0})
            for i, (u, v, length) in enumerate(edges)
        ),
        tuple(
            Barrier(str(i), str(i), None, "step" if i % 2 else "rough", 1, probability)
            for i in range(len(edges))
        ),
        tuple(Repair(str(i), (str(i),), 1, 1, 1) for i in range(len(edges))),
        (replace(profile(), threshold_m=25),),
        tuple(Origin(str(i), str(i), i + 1, "tract") for i in range(4)),
        tuple(Destination(str(i), str(i), "health", i + 1) for i in range(4)),
        tuple(Node(str(i)) for i in range(4)),
    )
    ids = tuple(r.id for r in data.repairs)
    previous = evaluate(data, (), params(n_scenarios=3), directed=directed)
    for end in range(len(ids) + 1):
        result = evaluate(data, ids[:end], params(n_scenarios=3), directed=directed)
        assert result.after.total >= previous.after.total
        assert result.delta_a_expected >= 0
        for key, chance in previous.after.reachable_probabilities.items():
            assert result.after.reachable_probabilities[key] >= chance
        previous = result


def test_parallel_accessible_detour_makes_repair_redundant() -> None:
    data = replace(
        instance(),
        edges=(*instance().edges, Edge("detour", "a", "b", 15, {"incline": 0})),
    )
    result = evaluate(data, ("repair",), params())
    assert result.before.total == result.after.total == 10
    assert result.delta_a_expected == 0


def test_each_reachable_destination_counts_once_even_at_same_node() -> None:
    data = replace(
        instance(),
        destinations=(
            Destination("clinic", "b", "health", 2),
            Destination("pharmacy", "b", "health", 3),
        ),
    )
    result = evaluate(data, ("repair",), params())
    assert result.after.total == 10 * (2 + 3)
    assert len(result.after.reachable_probabilities) == 2


def test_zero_weights_preserve_reachability_without_contributing_score() -> None:
    data = replace(
        instance(),
        profiles=(replace(profile(), weight=0), replace(profile(), id="other")),
        origins=(Origin("home", "a", 0, "tract"),),
    )
    result = evaluate(data, ("repair",), params())
    assert result.after.total == 0
    assert result.after.by_profile == {"wheelchair": 0, "other": 0}
    assert len(result.after.reachable_probabilities) == 2


def test_repair_shortens_detour_without_connecting_isolated_destination() -> None:
    data = replace(
        corridor(),
        edges=(*corridor().edges, Edge("detour", "a", "c", 12, {"incline": 0})),
        profiles=(
            replace(profile(), threshold_m=10),
            replace(profile(), id="longer", threshold_m=12),
        ),
        destinations=(
            Destination("clinic", "c", "health", 2),
            Destination("park", "isolated", "park", 9),
        ),
    )
    result = evaluate(data, ("a", "b"), params(), directed=True)
    assert result.before.by_profile == {"wheelchair": 0, "longer": 6}
    assert result.after.by_profile == {"wheelchair": 6, "longer": 6}
    assert all(key[2] != "park" for key in result.after.reachable_probabilities)
    assert evaluate(data, ("a", "b"), params(), directed=True) == result
