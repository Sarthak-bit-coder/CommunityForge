"""Correctness references for budgeted optimization of modeled access."""

from dataclasses import FrozenInstanceError, replace
from itertools import combinations
from sys import float_info
from unittest.mock import patch

import pytest
from hypothesis import given, settings, strategies as st

from accessforge_engine import (
    Barrier,
    Destination,
    Edge,
    InvalidInstanceError,
    Node,
    Origin,
    ProblemInstance,
    Repair,
    SolveResult,
    SolveParams,
    evaluate,
    solve,
)
from test_contract import instance, profile
from test_evaluation import corridor, params


def solve_params(method: str = "exhaustive", budget: float = 100) -> SolveParams:
    return replace(params(budget=budget), method=method)


def test_exact_finds_complementary_pair_that_greedy_misses() -> None:
    data = corridor()
    exact = solve(data, solve_params(budget=2))
    greedy = solve(data, solve_params("B3", budget=2))
    assert isinstance(exact, SolveResult)
    assert exact.selected_repair_ids == ("a", "b")
    assert exact.total_cost == 2
    assert exact.delta_a_expected == 6
    assert exact.delta_a_by_profile == {"wheelchair": 6}
    assert exact.delta_a_by_group == {"north": 6}
    assert exact.diagnostics["optimality_proven"] == 1
    assert greedy.selected_repair_ids == ()
    assert greedy.delta_a_expected == 0
    assert greedy.diagnostics["optimality_proven"] == 0


@pytest.mark.parametrize("method", ["exhaustive", "B3", "greedy"])
@pytest.mark.parametrize("budget", [0, 1, 1.99, 2])
def test_budget_limits_and_boundary(method: str, budget: float) -> None:
    result = solve(corridor(), solve_params(method, budget))
    metrics = evaluate(
        corridor(), result.selected_repair_ids, solve_params(method, budget)
    )
    assert result.total_cost <= budget
    assert metrics.budget_feasible
    assert result.total_cost == metrics.total_cost
    assert result.delta_a_expected == metrics.delta_a_expected
    if budget < 2:
        assert result.delta_a_expected == 0
        assert result.selected_repair_ids == ()


def test_fractional_budget_does_not_allow_tolerance_overspend() -> None:
    data = replace(instance(), repairs=(Repair("repair", ("barrier",), 0.3, 0.3, 0.3),))
    assert solve(data, solve_params(budget=0.3)).selected_repair_ids == ("repair",)
    assert solve(data, solve_params(budget=0.299999999)).selected_repair_ids == ()


@pytest.mark.parametrize("method", ["exhaustive", "B3"])
def test_zero_cost_positive_gain_and_zero_budget(method: str) -> None:
    data = replace(instance(), repairs=(Repair("repair", ("barrier",), 0, 0, 0),))
    result = solve(data, solve_params(method, 0))
    assert result.selected_repair_ids == ("repair",)
    assert result.total_cost == 0
    assert result.delta_a_expected == 10


def test_zero_cost_complementary_pair_is_found_by_exact_search() -> None:
    data = replace(
        corridor(),
        repairs=tuple(
            replace(r, cost=0, cost_low=0, cost_high=0) for r in corridor().repairs
        ),
    )
    assert solve(data, solve_params(budget=0)).delta_a_expected == 6
    assert solve(data, solve_params("B3", 0)).delta_a_expected == 0


@pytest.mark.parametrize("method", ["exhaustive", "B3"])
def test_no_candidates_and_no_gain_return_empty_portfolio(method: str) -> None:
    assert (
        solve(replace(instance(), repairs=()), solve_params(method)).selected_repair_ids
        == ()
    )
    data = replace(instance(), destinations=())
    assert solve(data, solve_params(method)).selected_repair_ids == ()


def test_exact_ties_prefer_cheaper_then_fewer_then_lexical_ids() -> None:
    data = replace(
        instance(),
        repairs=(
            Repair("z", ("barrier",), 2, 2, 2),
            Repair("b", ("barrier",), 1, 1, 1),
            Repair("a", ("barrier",), 1, 1, 1),
            Repair("free-no-op", (), 0, 0, 0),
        ),
    )
    assert solve(data, solve_params()).selected_repair_ids == ("a",)
    assert solve(data, solve_params("B3")).selected_repair_ids == ("a",)


def test_shared_multi_barrier_repair_is_not_double_charged() -> None:
    data = replace(
        corridor(),
        repairs=(*corridor().repairs, Repair("combined", ("a", "b"), 1, 1, 1)),
    )
    result = solve(data, solve_params(budget=1))
    assert result.selected_repair_ids == ("combined",)
    assert result.total_cost == 1
    assert result.delta_a_expected == 6


def test_profile_weights_change_selected_portfolio() -> None:
    data = ProblemInstance(
        (
            Edge("ab", "a", "b", 1, {"incline": 0}),
            Edge("ac", "a", "c", 1, {"incline": 0}),
        ),
        (
            Barrier("step", "ab", None, "step", 1, 1),
            Barrier("signal", "ac", None, "signal", 1, 1),
        ),
        (Repair("ramp", ("step",), 1, 1, 1), Repair("beacon", ("signal",), 1, 1, 1)),
        (
            replace(profile(), weight=2),
            replace(
                profile(), id="vision", weight=1, impassable_types=frozenset({"signal"})
            ),
        ),
        (Origin("home", "a", 1, "tract"),),
        (Destination("clinic", "b", "health", 1), Destination("park", "c", "park", 1)),
        (Node("a"), Node("b"), Node("c")),
    )
    assert solve(data, solve_params(budget=1)).selected_repair_ids == ("ramp",)
    data = replace(
        data,
        profiles=(
            replace(data.profiles[0], weight=1),
            replace(data.profiles[1], weight=2),
        ),
    )
    assert solve(data, solve_params(budget=1)).selected_repair_ids == ("beacon",)


def test_greedy_recomputes_marginals_after_every_pick() -> None:
    data = ProblemInstance(
        (
            Edge("a", "o", "m", 1, {"incline": 0}),
            Edge("b", "m", "d", 1, {"incline": 0}),
            Edge("c", "o", "e", 1, {"incline": 0}),
        ),
        tuple(Barrier(key, key, None, "step", 1, 1) for key in ("a", "b", "c")),
        tuple(Repair(key, (key,), 1, 1, 1) for key in ("a", "b", "c")),
        (profile(),),
        (Origin("home", "o", 1, "tract"),),
        (
            Destination("first", "m", "health", 2),
            Destination("large", "d", "health", 100),
            Destination("small", "e", "health", 1),
        ),
        tuple(Node(key) for key in ("o", "m", "d", "e")),
    )
    result = solve(data, solve_params("B3", 2))
    assert result.selected_repair_ids == ("a", "b")
    assert result.delta_a_expected == 102


@pytest.mark.parametrize("method", ["exhaustive", "B3"])
def test_seed_and_input_order_determinism(method: str) -> None:
    data = replace(
        corridor(),
        barriers=tuple(replace(b, presence_prob=0.5) for b in corridor().barriers),
    )
    settings = replace(solve_params(method, 2), n_scenarios=10, seed=37)
    first = solve(data, settings)
    assert first == solve(data, settings)
    assert first == solve(
        replace(
            data,
            barriers=tuple(reversed(data.barriers)),
            repairs=tuple(reversed(data.repairs)),
        ),
        settings,
    )
    assert (
        first.delta_a_expected
        == evaluate(data, first.selected_repair_ids, settings).delta_a_expected
    )


def test_explanations_report_removal_losses_and_complementary_partners() -> None:
    result = solve(corridor(), solve_params(budget=2))
    assert len(result.explanations) == 2
    for explanation in result.explanations:
        assert explanation.marginal_delta_a == 6
        assert explanation.profiles_benefiting == ("wheelchair",)
        assert explanation.destination_categories == ("health",)
        assert explanation.complementary_repair_ids == (
            ("b",) if explanation.repair_id == "a" else ("a",)
        )
        assert explanation.bundle_id is None
        # A uniform 30% cost increase makes the pair unaffordable.
        assert explanation.stable_under_cost_perturbation is False


def test_result_mappings_are_immutable() -> None:
    result = solve(corridor(), solve_params(budget=2))
    with pytest.raises(TypeError):
        result.diagnostics["optimality_proven"] = 0  # type: ignore[index]
    with pytest.raises(FrozenInstanceError):
        result.method = "other"  # type: ignore[misc]


def test_unsupported_method_fails_clearly() -> None:
    with pytest.raises(InvalidInstanceError, match="method"):
        solve(instance(), solve_params("P2"))


def test_exact_instance_size_limit_fails_clearly() -> None:
    from accessforge_engine.optimization import MAX_EXHAUSTIVE_REPAIRS

    data = replace(
        instance(),
        repairs=tuple(
            Repair(str(i), (), 1, 1, 1) for i in range(MAX_EXHAUSTIVE_REPAIRS + 1)
        ),
    )
    with pytest.raises(InvalidInstanceError, match="at most"):
        solve(data, solve_params())


def test_timeout_raises_without_silent_partial_result() -> None:
    with patch("accessforge_engine.optimization.monotonic", side_effect=[0, 11]):
        with pytest.raises(TimeoutError, match="time limit"):
            solve(corridor(), solve_params())


@settings(max_examples=20, deadline=None)
@given(st.lists(st.integers(0, 5), min_size=2, max_size=4), st.integers(0, 10))
def test_exact_matches_independent_enumeration_and_dominates_greedy(
    costs: list[int], budget: int
) -> None:
    data = replace(
        instance(),
        repairs=tuple(
            Repair(str(i), ("barrier",) if i % 2 else (), cost, cost, cost)
            for i, cost in enumerate(costs)
        ),
    )
    settings = solve_params(budget=budget)
    exact = solve(data, settings)
    ids = tuple(r.id for r in data.repairs)
    feasible = []
    for size in range(len(ids) + 1):
        for selected in combinations(ids, size):
            metrics = evaluate(data, selected, settings)
            if metrics.budget_feasible:
                feasible.append(
                    (
                        -metrics.delta_a_expected,
                        metrics.total_cost,
                        len(selected),
                        selected,
                    )
                )
    assert (
        -exact.delta_a_expected,
        exact.total_cost,
        len(exact.selected_repair_ids),
        exact.selected_repair_ids,
    ) == min(feasible)
    assert (
        exact.delta_a_expected
        >= solve(data, replace(settings, method="B3")).delta_a_expected
    )


def test_overflowing_subset_cost_is_infeasible_not_a_crash() -> None:
    data = replace(
        instance(),
        repairs=(
            Repair("a", ("barrier",), 1e308, 1e308, 1e308),
            Repair("b", ("barrier",), 1e308, 1e308, 1e308),
        ),
    )
    result = solve(data, solve_params(budget=1e308))
    assert result.selected_repair_ids == ("a",)
    assert result.total_cost == 1e308


def test_timeout_during_evaluation_does_not_return_a_partial_portfolio() -> None:
    with patch("accessforge_engine.optimization.monotonic", side_effect=[0, 0, 11]):
        with pytest.raises(TimeoutError, match="time limit"):
            solve(corridor(), solve_params())


def test_solver_respects_directed_graphs_and_disconnected_destinations() -> None:
    data = replace(
        instance(),
        origins=(Origin("home", "b", 1, "tract"),),
        destinations=(Destination("clinic", "a", "health", 1),),
    )
    assert solve(data, solve_params()).selected_repair_ids == ("repair",)
    assert solve(data, solve_params(), directed=True).selected_repair_ids == ()
    disconnected = replace(
        data, destinations=(Destination("clinic", "isolated", "health", 1),)
    )
    assert solve(disconnected, solve_params()).delta_a_expected == 0


@pytest.mark.parametrize("method", ["exhaustive", "B3"])
def test_maximum_finite_budget_keeps_a_valid_recommendation(method: str) -> None:
    data = instance()
    result = solve(data, solve_params(method, float_info.max))

    assert result.selected_repair_ids == (data.repairs[0].id,)
    assert result.total_cost == data.repairs[0].cost
    assert result.explanations[0].stable_under_cost_perturbation


@pytest.mark.parametrize("method", ["exhaustive", "B3"])
def test_competing_repairs_for_one_barrier_earn_one_trip_gain(method: str) -> None:
    data = instance()
    original = data.repairs[0]
    alternative = replace(original, id="alternative")
    data = replace(data, repairs=(original, alternative))
    options = solve_params(method, original.cost + alternative.cost)

    result = solve(data, options)

    assert result.selected_repair_ids == ("alternative",)
    assert result.total_cost == original.cost
    assert (
        result.delta_a_expected
        == evaluate(data, (original.id,), options).delta_a_expected
    )
    assert result == solve(data, options)
