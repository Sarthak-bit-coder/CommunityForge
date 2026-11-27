"""Cumulative-opportunity accessibility estimates, without portfolio optimization."""

from collections import Counter, defaultdict
from collections.abc import Iterable, Iterator, Mapping
from dataclasses import dataclass
from math import fsum
from random import Random
from types import MappingProxyType

import networkx as nx

from .contract import ProblemInstance, SolveParams
from .graph import BLOCKED_BY_BARRIER, build_graph
from .validation import InvalidInstanceError, identifier, number, unique

ReachKey = tuple[str, str, str]  # profile ID, origin ID, destination ID


@dataclass(frozen=True)
class Accessibility:
    """Modeled expected opportunities; profile/group scores include profile weight.

    Sparse reach probabilities omit unreachable pairs, whose probability is zero.
    These probabilities describe the sampled model, not route safety.
    """

    total: float
    by_profile: Mapping[str, float]
    by_group: Mapping[str, float]
    reachable_probabilities: Mapping[ReachKey, float]


@dataclass(frozen=True)
class EvaluationMetrics:
    before: Accessibility
    after: Accessibility
    total_cost: float
    budget_feasible: bool
    n_scenarios: int

    @property
    def delta_a_expected(self) -> float:
        return self.after.total - self.before.total

    @property
    def delta_a_by_profile(self) -> Mapping[str, float]:
        return MappingProxyType(
            {
                key: value - self.before.by_profile[key]
                for key, value in self.after.by_profile.items()
            }
        )

    @property
    def delta_a_by_group(self) -> Mapping[str, float]:
        return MappingProxyType(
            {
                key: value - self.before.by_group[key]
                for key, value in self.after.by_group.items()
            }
        )


@dataclass(frozen=True)
class RouteImpact:
    """Modeled reachability change for one traveler profile and trip."""

    profile_id: str
    origin_id: str
    destination_id: str
    modeled_reach_before: float
    modeled_reach_after: float
    contributing_repair_ids: tuple[str, ...]


def _finite_sum(values: Iterable[float]) -> float:
    try:
        value = fsum(values)
    except OverflowError as error:
        raise InvalidInstanceError("evaluation totals must be finite") from error
    number(value, "evaluation total")
    return value


def _selected_repairs(
    instance: ProblemInstance, selected: Iterable[str]
) -> tuple[frozenset[str], float]:
    if isinstance(selected, (str, bytes)):
        raise InvalidInstanceError("selected_repair_ids must be a collection of IDs")
    ids = tuple(selected)
    for repair_id in ids:
        identifier(repair_id, "selected repair ID")
    unique(ids, "selected repair IDs")
    repairs = {repair.id: repair for repair in instance.repairs}
    if not set(ids) <= repairs.keys():
        raise InvalidInstanceError("selection contains unknown repair IDs")
    removed = frozenset(b for key in ids for b in repairs[key].barrier_ids)
    return removed, _finite_sum(repairs[key].cost for key in ids)


def _scenarios(
    instance: ProblemInstance, *, n_scenarios: int, seed: int
) -> Iterator[frozenset[str]]:
    """Independent Bernoulli presence is an explicit modeling assumption."""
    random = Random(seed)
    barriers = sorted(instance.barriers, key=lambda b: b.id)
    for _ in range(n_scenarios):
        yield frozenset(
            b.id
            for b in barriers
            if b.presence_prob == 1
            or (0 < b.presence_prob < 1 and random.random() < b.presence_prob)
        )


def _reachable(
    instance: ProblemInstance, present: frozenset[str], *, directed: bool
) -> Iterator[ReachKey]:
    origins_by_node: dict[str, list[str]] = defaultdict(list)
    for origin in instance.origins:
        origins_by_node[origin.node_id].append(origin.id)

    for profile in instance.profiles:
        graph = build_graph(
            instance, profile.id, directed=directed, present_barrier_ids=present
        )
        for node_id, origin_ids in origins_by_node.items():
            if graph.nodes[node_id].get(BLOCKED_BY_BARRIER):
                continue
            distances = nx.single_source_dijkstra_path_length(
                graph, node_id, cutoff=profile.threshold_m, weight="weight"
            )
            destinations = [
                item.id for item in instance.destinations if item.node_id in distances
            ]
            for origin_id in origin_ids:
                for destination_id in destinations:
                    yield profile.id, origin_id, destination_id


def _accessibility(
    instance: ProblemInstance, counts: Counter[ReachKey], n_scenarios: int
) -> Accessibility:
    by_profile: dict[str, list[float]] = {p.id: [] for p in instance.profiles}
    by_group: dict[str, list[float]] = {o.group: [] for o in instance.origins}
    for profile in instance.profiles:
        for origin in instance.origins:
            opportunities = _finite_sum(
                destination.weight
                * (counts[profile.id, origin.id, destination.id] / n_scenarios)
                for destination in instance.destinations
            )
            contribution = profile.weight * origin.weight * opportunities
            number(contribution, "weighted accessibility")
            by_profile[profile.id].append(contribution)
            by_group[origin.group].append(contribution)
    profile_totals = {key: _finite_sum(values) for key, values in by_profile.items()}
    return Accessibility(
        _finite_sum(profile_totals.values()),
        MappingProxyType(profile_totals),
        MappingProxyType(
            {key: _finite_sum(values) for key, values in by_group.items()}
        ),
        MappingProxyType({key: count / n_scenarios for key, count in counts.items()}),
    )


def evaluate(
    instance: ProblemInstance,
    selected_repair_ids: Iterable[str],
    params: SolveParams,
    *,
    directed: bool = False,
) -> EvaluationMetrics:
    """Compare modeled access using matched before/after presence scenarios.

    A = sum(profile weight * origin weight * reachable destination weights).
    Repairs remove their union of barriers, never alter structural attributes,
    and have additive nominal costs. Over-budget portfolios are evaluated and
    flagged, not modified. The three-argument contract uses undirected graphs;
    callers with directed inputs must explicitly set directed=True.
    """
    removed, total_cost = _selected_repairs(instance, selected_repair_ids)
    uncertain = any(0 < b.presence_prob < 1 for b in instance.barriers)
    n_scenarios = params.n_scenarios if uncertain else 1
    before: Counter[ReachKey] = Counter()
    after: Counter[ReachKey] = Counter()
    for present in _scenarios(instance, n_scenarios=n_scenarios, seed=params.seed):
        remaining = present - removed
        trips = _reachable(instance, present, directed=directed)
        if remaining == present:
            for trip in trips:
                before[trip] += 1
                after[trip] += 1
        else:
            before.update(trips)
            after.update(_reachable(instance, remaining, directed=directed))
    return EvaluationMetrics(
        _accessibility(instance, before, n_scenarios),
        _accessibility(instance, after, n_scenarios),
        total_cost,
        total_cost <= params.budget,
        n_scenarios,
    )


def evaluate_route_impacts(
    instance: ProblemInstance,
    selected_repair_ids: tuple[str, ...],
    params: SolveParams,
    *,
    directed: bool = False,
) -> tuple[RouteImpact, ...]:
    """Report trips with increased modeled reach within the profile threshold.

    A repair contributes when omitting it from this portfolio reduces reach
    on the same sampled scenarios. Interchangeable repairs may have zero
    individual contribution. Trips are ordered by profile, origin, destination.
    Portfolios exceeding the supplied budget are rejected.
    """
    full = evaluate(instance, selected_repair_ids, params, directed=directed)
    if not full.budget_feasible:
        raise InvalidInstanceError("repair portfolio exceeds the budget")
    before = full.before.reachable_probabilities
    after = full.after.reachable_probabilities
    contributors: dict[ReachKey, list[str]] = {
        trip: [] for trip, reach in sorted(after.items()) if reach > before.get(trip, 0)
    }
    if not contributors:
        return ()

    for repair_id in sorted(selected_repair_ids):
        other_ids = tuple(key for key in selected_repair_ids if key != repair_id)
        without = evaluate(instance, other_ids, params, directed=directed)
        for trip, repair_ids in contributors.items():
            if after[trip] > without.after.reachable_probabilities.get(trip, 0):
                repair_ids.append(repair_id)

    return tuple(
        RouteImpact(*trip, before.get(trip, 0), after[trip], tuple(repair_ids))
        for trip, repair_ids in contributors.items()
    )
