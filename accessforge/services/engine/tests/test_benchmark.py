from dataclasses import replace
from math import pi
from unittest.mock import patch

import pytest

from accessforge_engine import InvalidInstanceError, Repair
from accessforge_engine.baselines import _defect_score, select_baseline
from accessforge_engine.benchmark import (
    DEFAULT_METHODS,
    benchmark_network,
    run_case,
    run_sweep,
)
from accessforge_engine.synthetic import SyntheticConfig, complementarity_case
from test_evaluation import params


def test_baseline_rankings_have_hand_computed_scores() -> None:
    network = complementarity_case()
    expected = 3 * (2 / (1 + 37.5 / 100)) * (10 / (pi * 100**2))
    assert _defect_score(network, network.instance.barriers[0]) == pytest.approx(
        expected
    )
    assert select_baseline(network, replace(params(10), method="B1"), seed=0) == ("r0",)
    assert select_baseline(network, replace(params(10), method="B2"), seed=0) == ("r1",)
    first = select_baseline(network, replace(params(10), method="B0"), seed=23)
    assert first == select_baseline(network, replace(params(10), method="B0"), seed=23)


def test_baselines_scan_past_unaffordable_candidates_and_handle_free_repairs() -> None:
    network = complementarity_case()
    data = replace(
        network.instance,
        repairs=(Repair("r0", ("b0",), 11, 11, 11), Repair("r1", ("b1",), 5, 5, 5)),
    )
    assert select_baseline(
        replace(network, instance=data), replace(params(5), method="B1"), seed=0
    ) == ("r1",)
    free = replace(
        network.instance,
        repairs=tuple(
            replace(r, cost=0, cost_low=0, cost_high=0)
            for r in network.instance.repairs
        ),
    )
    for method in ("B0", "B1", "B2"):
        assert select_baseline(
            replace(network, instance=free), replace(params(0), method=method), seed=0
        ) == ("r0", "r1")


def test_invalid_baseline_method_and_seed_fail() -> None:
    with pytest.raises(InvalidInstanceError):
        select_baseline(complementarity_case(), params(), seed=0)
    with pytest.raises(InvalidInstanceError):
        select_baseline(complementarity_case(), replace(params(), method="B0"), seed=-1)


def test_metrics_and_clock_have_hand_computed_values() -> None:
    with patch("accessforge_engine.benchmark.perf_counter", side_effect=[10, 10.125]):
        row = run_case(
            complementarity_case(),
            case="corridor",
            seed=0,
            budget_fraction=1,
            method="exhaustive",
        )
    assert row.runtime_s == 0.125
    assert row.accessibility_before == 10
    assert row.accessibility_after == 20
    assert row.delta_a == 10
    assert row.total_cost == row.budget == 20
    assert row.budget_usage == 1
    assert row.gain_per_budget == row.gain_per_spend == 0.5
    assert row.delta_a_by_profile == {"wheelchair": 10, "pedestrian": 0}
    assert row.to_dict()["delta_a_by_profile"] == {"wheelchair": 10, "pedestrian": 0}


def test_complementarity_benchmark_publishes_greedy_failure_and_gaps() -> None:
    rows = benchmark_network(
        complementarity_case(), case="corridor", seed=0, budget_fractions=(0.5, 1)
    )
    assert len(rows) == 2 * len(DEFAULT_METHODS)
    full = {row.method: row for row in rows if row.budget_fraction == 1}
    assert full["B3"].delta_a == 0
    assert full["B3"].optimality_gap == 1
    assert full["exhaustive"].delta_a == 10
    assert full["B0"].delta_a == full["B1"].delta_a == full["B2"].delta_a == 10
    assert all(row.optimality_gap is None for row in rows if row.budget_fraction == 0.5)


def test_repeated_sweep_matches_except_observed_runtime() -> None:
    config = SyntheticConfig(width=3, height=2, barrier_count=3)
    first = run_sweep(config, seeds=(0, 1), budget_fractions=(0.2, 0.5))
    second = run_sweep(config, seeds=(0, 1), budget_fractions=(0.2, 0.5))
    assert len(first) == 20
    assert [replace(row, runtime_s=0) for row in first] == [
        replace(row, runtime_s=0) for row in second
    ]
    assert all(row.status == "ok" for row in first)
    assert all(row.total_cost <= row.budget for row in first)


def test_failures_are_recorded_without_fake_zero_metrics() -> None:
    with patch(
        "accessforge_engine.benchmark.solve", side_effect=TimeoutError("test timeout")
    ):
        row = run_case(
            complementarity_case(),
            case="corridor",
            seed=0,
            budget_fraction=1,
            method="exhaustive",
        )
    assert row.status == "timeout"
    assert row.error == "test timeout"
    assert row.delta_a is row.total_cost is row.selected_repair_ids is None
    with patch(
        "accessforge_engine.benchmark.solve",
        side_effect=InvalidInstanceError("size limit"),
    ):
        row = run_case(
            complementarity_case(),
            case="corridor",
            seed=0,
            budget_fraction=1,
            method="exhaustive",
        )
    assert row.status == "error"
    assert row.delta_a is None


def test_zero_budget_and_zero_spend_ratios_are_undefined() -> None:
    row = run_case(
        complementarity_case(), case="corridor", seed=0, budget_fraction=0, method="B3"
    )
    assert row.delta_a == 0
    assert row.budget_usage is row.gain_per_budget is row.gain_per_spend is None


@pytest.mark.parametrize(
    "fraction,method", [(-1, "B0"), (1.1, "B0"), (float("nan"), "B0"), (0.5, "P2")]
)
def test_invalid_run_parameters_fail(fraction: float, method: str) -> None:
    with pytest.raises(InvalidInstanceError):
        run_case(
            complementarity_case(),
            case="corridor",
            seed=0,
            budget_fraction=fraction,
            method=method,
        )


def test_duplicate_sweep_axes_fail() -> None:
    with pytest.raises(InvalidInstanceError, match="duplicate"):
        run_sweep(SyntheticConfig(), seeds=(0, 0), budget_fractions=(0.2,))
    with pytest.raises(InvalidInstanceError, match="duplicate"):
        benchmark_network(
            complementarity_case(), case="corridor", seed=0, budget_fractions=(0.2, 0.2)
        )


def test_empty_axes_and_negative_seed_fail() -> None:
    with pytest.raises(InvalidInstanceError):
        run_sweep(SyntheticConfig(), seeds=(), budget_fractions=(0.1,))
    with pytest.raises(InvalidInstanceError):
        benchmark_network(
            complementarity_case(), case="corridor", seed=0, budget_fractions=()
        )
    with pytest.raises(InvalidInstanceError):
        run_case(
            complementarity_case(),
            case="corridor",
            seed=-1,
            budget_fraction=0.1,
            method="B0",
        )
