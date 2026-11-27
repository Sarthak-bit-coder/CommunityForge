"""Small-instance exhaustive reference and fully recomputed single-repair greedy."""

from dataclasses import dataclass, replace
from fractions import Fraction
from itertools import combinations
from math import fsum, inf
from sys import float_info
from time import monotonic
from collections.abc import Mapping

from .contract import Explanation, ProblemInstance, SolveParams, SolveResult
from .evaluation import EvaluationMetrics, evaluate
from .validation import InvalidInstanceError

ENGINE_VERSION = "0.1.0"
MAX_EXHAUSTIVE_REPAIRS = 20
COST_PERTURBATION_FRACTION = 0.30
EXHAUSTIVE_METHOD = "exhaustive"
GREEDY_METHODS = frozenset({"B3", "greedy"})


@dataclass(frozen=True)
class _Run:
    instance: ProblemInstance
    params: SolveParams
    directed: bool
    deadline: float

    def check_deadline(self) -> None:
        if monotonic() >= self.deadline:
            raise TimeoutError("optimization time limit exceeded; no result returned")

    def evaluate(self, ids: tuple[str, ...]) -> EvaluationMetrics:
        self.check_deadline()
        metrics = evaluate(self.instance, ids, self.params, directed=self.directed)
        self.check_deadline()
        return metrics

    def cost(self, ids: tuple[str, ...]) -> float:
        costs = {repair.id: repair.cost for repair in self.instance.repairs}
        try:
            return fsum(costs[key] for key in ids)
        except OverflowError:
            # An overflowing nonnegative sum exceeds every finite budget.
            return inf


def _portfolio_key(
    ids: tuple[str, ...], metrics: EvaluationMetrics
) -> tuple[float, float, int, tuple[str, ...]]:
    return -metrics.delta_a_expected, metrics.total_cost, len(ids), ids


def _exhaustive(run: _Run) -> tuple[str, ...]:
    if len(run.instance.repairs) > MAX_EXHAUSTIVE_REPAIRS:
        raise InvalidInstanceError(
            f"exhaustive supports at most {MAX_EXHAUSTIVE_REPAIRS} repairs"
        )
    ids = tuple(sorted(r.id for r in run.instance.repairs))
    best: tuple[str, ...] = ()
    best_key = _portfolio_key(best, run.evaluate(best))
    for size in range(1, len(ids) + 1):
        for candidate in combinations(ids, size):
            run.check_deadline()
            if run.cost(candidate) > run.params.budget:
                continue
            key = _portfolio_key(candidate, run.evaluate(candidate))
            if key < best_key:
                best, best_key = candidate, key
    return best


def _greedy(run: _Run) -> tuple[str, ...]:
    selected: tuple[str, ...] = ()
    current = run.evaluate(selected)
    repairs = sorted(run.instance.repairs, key=lambda repair: repair.id)
    while True:
        best: tuple[str, ...] | None = None
        best_priority: tuple[bool, Fraction] | None = None
        best_metrics = current
        for repair in repairs:
            run.check_deadline()
            if repair.id in selected:
                continue
            candidate = tuple(sorted((*selected, repair.id)))
            if run.cost(candidate) > run.params.budget:
                continue
            metrics = run.evaluate(candidate)
            gain = metrics.delta_a_expected - current.delta_a_expected
            if gain <= 0:
                continue
            ratio = (
                Fraction(gain) / Fraction(repair.cost)
                if repair.cost
                else Fraction(gain)
            )
            priority = repair.cost == 0, ratio
            if best_priority is None or priority > best_priority:
                best, best_priority, best_metrics = candidate, priority, metrics
        if best is None:
            return selected
        selected, current = best, best_metrics


def _search(run: _Run) -> tuple[str, ...]:
    return _exhaustive(run) if run.params.method == EXHAUSTIVE_METHOD else _greedy(run)


def _cost_stability(run: _Run, selected: tuple[str, ...]) -> set[str]:
    stable = set(selected)
    for factor in (1 - COST_PERTURBATION_FRACTION, 1 + COST_PERTURBATION_FRACTION):
        # Uniform cost scaling is equivalent to inverse scaling of the budget.
        # Every representable portfolio cost fits once the scaled budget overflows.
        budget = min(run.params.budget / factor, float_info.max)
        perturbed = replace(run, params=replace(run.params, budget=budget))
        stable.intersection_update(_search(perturbed))
    return stable


def _categories(
    instance: ProblemInstance, full: EvaluationMetrics, without: EvaluationMetrics
) -> tuple[str, ...]:
    profiles = {p.id for p in instance.profiles if p.weight > 0}
    origins = {o.id for o in instance.origins if o.weight > 0}
    destinations = {d.id: d.category for d in instance.destinations if d.weight > 0}
    return tuple(
        sorted(
            {
                destinations[d]
                for (p, o, d), chance in full.after.reachable_probabilities.items()
                if p in profiles
                and o in origins
                and d in destinations
                and chance > without.after.reachable_probabilities.get((p, o, d), 0)
            }
        )
    )


def _partners(
    run: _Run,
    selected: tuple[str, ...],
    repair_id: str,
    loss: float,
    removals: Mapping[str, EvaluationMetrics],
) -> tuple[str, ...]:
    partners = []
    for other in selected:
        if other == repair_id:
            continue
        without_both = run.evaluate(
            tuple(key for key in selected if key not in (repair_id, other))
        )
        conditional_loss = removals[other].after.total - without_both.after.total
        if loss > conditional_loss:
            partners.append(other)
    return tuple(partners)


def _explanations(
    run: _Run, selected: tuple[str, ...], full: EvaluationMetrics
) -> tuple[Explanation, ...]:
    if not selected:
        return ()
    stable = _cost_stability(run, selected)
    removals = {
        key: run.evaluate(tuple(r for r in selected if r != key)) for key in selected
    }
    explanations = []
    for key in selected:
        without = removals[key]
        loss = full.after.total - without.after.total
        profiles = tuple(
            sorted(
                profile
                for profile, value in full.after.by_profile.items()
                if value > without.after.by_profile[profile]
            )
        )
        explanations.append(
            Explanation(
                key,
                loss,
                profiles,
                _categories(run.instance, full, without),
                None,
                _partners(run, selected, key, loss, removals),
                key in stable,
            )
        )
    return tuple(explanations)


def solve(
    instance: ProblemInstance, params: SolveParams, *, directed: bool = False
) -> SolveResult:
    """Optimize fixed-sample modeled gain; return only a completed run.

    Exhaustive search proves optimality for the evaluated sample, not the true
    distribution. Greedy is a baseline without an approximation guarantee.
    Dependencies mean joint access effects; the contract has no prerequisites.
    """
    if params.method != EXHAUSTIVE_METHOD and params.method not in GREEDY_METHODS:
        raise InvalidInstanceError("method must be 'exhaustive', 'B3', or 'greedy'")
    run = _Run(instance, params, directed, monotonic() + params.time_limit_s)
    selected = _search(run)
    metrics = run.evaluate(selected)
    explanations = _explanations(run, selected, metrics)
    run.check_deadline()
    return SolveResult(
        params.method,
        selected,
        metrics.total_cost,
        metrics.delta_a_expected,
        metrics.delta_a_by_profile,
        metrics.delta_a_by_group,
        explanations,
        {
            "optimality_proven": float(params.method == EXHAUSTIVE_METHOD),
            "n_scenarios": float(metrics.n_scenarios),
            "cost_perturbation_fraction": COST_PERTURBATION_FRACTION,
        },
        ENGINE_VERSION,
    )
