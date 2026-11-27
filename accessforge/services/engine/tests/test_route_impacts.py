"""Route-level reachability changes for fixed portfolios."""

from dataclasses import replace

import pytest

from accessforge_engine import Destination, Edge, InvalidInstanceError, Repair, solve
from accessforge_engine.evaluation import RouteImpact, evaluate_route_impacts
from test_contract import instance
from test_evaluation import corridor, params


@pytest.mark.parametrize("budget", [1, 2])
def test_route_impacts_follow_budgeted_recommendations(budget: float) -> None:
    data = corridor()
    options = replace(params(budget=budget), method="exhaustive")
    plan = solve(data, options)

    impacts = evaluate_route_impacts(data, plan.selected_repair_ids, options)

    assert plan.total_cost <= budget
    assert impacts == (
        (RouteImpact("wheelchair", "home", "clinic", 0, 1, ("a", "b")),)
        if budget == 2
        else ()
    )


def test_attribution_varies_by_route_and_omits_unreachable_trips() -> None:
    data = replace(
        corridor(),
        destinations=(
            *corridor().destinations,
            Destination("midpoint", "b", "park", 1),
            Destination("isolated", "isolated", "park", 1),
        ),
    )

    impacts = evaluate_route_impacts(data, ("a", "b"), params())

    assert impacts == (
        RouteImpact("wheelchair", "home", "clinic", 0, 1, ("a", "b")),
        RouteImpact("wheelchair", "home", "midpoint", 0, 1, ("a",)),
    )


def test_attribution_omits_repairs_with_no_marginal_gain_on_a_route() -> None:
    data = replace(
        corridor(),
        repairs=(*corridor().repairs, Repair("alternative", ("a",), 1, 1, 1)),
    )

    impacts = evaluate_route_impacts(data, ("b", "alternative", "a"), params())

    # The two repairs to barrier a are interchangeable in this portfolio.
    assert impacts == (RouteImpact("wheelchair", "home", "clinic", 0, 1, ("b",)),)


def test_already_reachable_route_within_threshold_has_no_reachability_gain() -> None:
    data = replace(
        instance(),
        edges=(*instance().edges, Edge("detour", "a", "b", 15, {"incline": 0})),
    )

    assert evaluate_route_impacts(data, ("repair",), params()) == ()


def test_uncertain_barrier_impacts_use_matched_seeded_scenarios() -> None:
    data = replace(
        instance(), barriers=(replace(instance().barriers[0], presence_prob=0.5),)
    )
    options = params(n_scenarios=4)

    impacts = evaluate_route_impacts(data, ("repair",), options)

    assert impacts == (
        RouteImpact("wheelchair", "home", "clinic", 0.5, 1, ("repair",)),
    )
    assert evaluate_route_impacts(data, ("repair",), options) == impacts


def test_unknown_repair_is_rejected() -> None:
    with pytest.raises(InvalidInstanceError, match="unknown repair"):
        evaluate_route_impacts(instance(), ("unknown",), params())


def test_route_impacts_reject_an_over_budget_portfolio() -> None:
    with pytest.raises(InvalidInstanceError, match="exceeds the budget"):
        evaluate_route_impacts(corridor(), ("a", "b"), params(budget=1))


def test_bundled_repair_leaves_an_untargeted_colocated_barrier() -> None:
    data = corridor()
    remaining = replace(data.barriers[1], id="remaining")
    data = replace(
        data,
        barriers=(*data.barriers, remaining),
        repairs=(
            Repair("bundle", ("a", "b"), 1, 1, 1),
            Repair("finish", ("remaining",), 1, 1, 1),
        ),
    )

    assert evaluate_route_impacts(data, ("bundle",), params()) == ()
    assert evaluate_route_impacts(data, ("finish",), params()) == ()
    assert evaluate_route_impacts(data, ("bundle", "finish"), params()) == (
        RouteImpact("wheelchair", "home", "clinic", 0, 1, ("bundle", "finish")),
    )
