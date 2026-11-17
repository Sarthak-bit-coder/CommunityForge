"""Pure synthetic experiment orchestration; persistence belongs to benchmarks/run.py."""

from collections.abc import Mapping
from dataclasses import dataclass, fields, replace
from math import fsum
from time import perf_counter
from types import MappingProxyType

from .baselines import BASELINE_METHODS, select_baseline
from .contract import SolveParams
from .evaluation import EvaluationMetrics, evaluate
from .optimization import solve
from .synthetic import SyntheticConfig, SyntheticNetwork, generate_network
from .validation import InvalidInstanceError, number, unique

DEFAULT_METHODS = ("B0", "B1", "B2", "B3", "exhaustive")
BASELINE_SEED_OFFSET = 1_000_000
EVALUATION_SEED_OFFSET = 2_000_000


@dataclass(frozen=True)
class BenchmarkRow:
    case: str
    seed: int
    budget_fraction: float
    method: str
    budget: float
    status: str
    runtime_s: float
    error: str | None
    selected_repair_ids: tuple[str, ...] | None
    total_cost: float | None
    budget_usage: float | None
    accessibility_before: float | None
    accessibility_after: float | None
    delta_a: float | None
    gain_per_budget: float | None
    gain_per_spend: float | None
    delta_a_by_profile: Mapping[str, float]
    optimality_gap: float | None = None

    def to_dict(self) -> dict[str, object]:
        values = {field.name: getattr(self, field.name) for field in fields(self)}
        values["delta_a_by_profile"] = dict(self.delta_a_by_profile)
        return values


def _metrics_row(
    case: str,
    seed: int,
    fraction: float,
    method: str,
    budget: float,
    runtime: float,
    selected: tuple[str, ...],
    metrics: EvaluationMetrics,
) -> BenchmarkRow:
    if not metrics.budget_feasible:
        raise RuntimeError("benchmark method returned an over-budget portfolio")
    return BenchmarkRow(
        case,
        seed,
        fraction,
        method,
        budget,
        "ok",
        runtime,
        None,
        selected,
        metrics.total_cost,
        metrics.total_cost / budget if budget else None,
        metrics.before.total,
        metrics.after.total,
        metrics.delta_a_expected,
        metrics.delta_a_expected / budget if budget else None,
        metrics.delta_a_expected / metrics.total_cost if metrics.total_cost else None,
        MappingProxyType(dict(metrics.delta_a_by_profile)),
    )


def _failure_row(
    case: str,
    seed: int,
    budget_fraction: float,
    method: str,
    budget: float,
    runtime: float,
    error: TimeoutError | InvalidInstanceError,
) -> BenchmarkRow:
    return BenchmarkRow(
        case,
        seed,
        budget_fraction,
        method,
        budget,
        "timeout" if isinstance(error, TimeoutError) else "error",
        runtime,
        str(error),
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        MappingProxyType({}),
    )


def run_case(
    network: SyntheticNetwork,
    *,
    case: str,
    seed: int,
    budget_fraction: float,
    method: str,
    time_limit_s: float = 30,
) -> BenchmarkRow:
    """Measure selection plus complete result generation and final evaluation."""
    if type(seed) is not int or seed < 0:
        raise InvalidInstanceError("seed must be a nonnegative integer")
    number(budget_fraction, "budget_fraction")
    if budget_fraction > 1 or method not in DEFAULT_METHODS:
        raise InvalidInstanceError(
            "budget_fraction must be <= 1 and method must be supported"
        )
    budget = budget_fraction * fsum(r.cost for r in network.instance.repairs)
    params = SolveParams(
        budget, method, 1, seed + EVALUATION_SEED_OFFSET, None, time_limit_s
    )
    start = perf_counter()
    try:
        selected = (
            select_baseline(network, params, seed=seed + BASELINE_SEED_OFFSET)
            if method in BASELINE_METHODS
            else solve(network.instance, params).selected_repair_ids
        )
        metrics = evaluate(network.instance, selected, params)
    except (TimeoutError, InvalidInstanceError) as error:
        return _failure_row(
            case, seed, budget_fraction, method, budget, perf_counter() - start, error
        )
    return _metrics_row(
        case,
        seed,
        budget_fraction,
        method,
        budget,
        perf_counter() - start,
        selected,
        metrics,
    )


def _with_gaps(rows: tuple[BenchmarkRow, ...]) -> tuple[BenchmarkRow, ...]:
    exact = next(
        (row for row in rows if row.method == "exhaustive" and row.status == "ok"), None
    )
    if exact is None or exact.delta_a is None or exact.delta_a == 0:
        return rows
    results = []
    for row in rows:
        if row.delta_a is not None:
            if row.delta_a > exact.delta_a:
                raise RuntimeError("benchmark gain exceeds exhaustive reference")
            row = replace(
                row, optimality_gap=(exact.delta_a - row.delta_a) / exact.delta_a
            )
        results.append(row)
    return tuple(results)


def benchmark_network(
    network: SyntheticNetwork,
    *,
    case: str,
    seed: int,
    budget_fractions: tuple[float, ...],
    methods: tuple[str, ...] = DEFAULT_METHODS,
    time_limit_s: float = 30,
) -> tuple[BenchmarkRow, ...]:
    if not budget_fractions or not methods:
        raise InvalidInstanceError("budget fractions and methods must be nonempty")
    unique(budget_fractions, "budget fractions")
    unique(methods, "methods")
    rows: list[BenchmarkRow] = []
    for fraction in budget_fractions:
        batch = tuple(
            run_case(
                network,
                case=case,
                seed=seed,
                budget_fraction=fraction,
                method=method,
                time_limit_s=time_limit_s,
            )
            for method in methods
        )
        rows.extend(_with_gaps(batch))
    return tuple(rows)


def run_sweep(
    config: SyntheticConfig,
    *,
    seeds: tuple[int, ...],
    budget_fractions: tuple[float, ...],
    methods: tuple[str, ...] = DEFAULT_METHODS,
    time_limit_s: float = 30,
) -> tuple[BenchmarkRow, ...]:
    if not seeds:
        raise InvalidInstanceError("seeds must be nonempty")
    unique(seeds, "seeds")
    rows: list[BenchmarkRow] = []
    for seed in seeds:
        network = generate_network(config, seed=seed)
        case = f"grid_{config.width}x{config.height}_c{config.clustering:g}"
        rows.extend(
            benchmark_network(
                network,
                case=case,
                seed=seed,
                budget_fractions=budget_fractions,
                methods=methods,
                time_limit_s=time_limit_s,
            )
        )
    return tuple(rows)
