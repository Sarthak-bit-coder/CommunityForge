"""Adapter from labeled networks (fictional or the Fremont pilot) to the engine.

No selection logic here.
"""

import hashlib
import json
from collections.abc import Mapping
from dataclasses import fields, is_dataclass
from enum import Enum
from functools import lru_cache
from math import fsum

from accessforge_engine import EvaluationMetrics, SolveParams, evaluate, solve
from accessforge_engine.baselines import BASELINE_METHODS, select_baseline
from accessforge_engine.evaluation import evaluate_route_impacts
from accessforge_engine.optimization import COST_PERTURBATION_FRACTION, ENGINE_VERSION
from accessforge_engine.synthetic import (
    SyntheticConfig,
    SyntheticNetwork,
    complementarity_case,
    generate_network,
)

from .planning_schemas import (
    BarrierView,
    DestinationView,
    EdgeView,
    ExplanationView,
    MethodPlanView,
    NetworkView,
    NodeView,
    OriginView,
    PlanningDataset,
    PlanningMethod,
    PlanView,
    ProfileView,
    RepairView,
    RouteImpactView,
)

PLAN_TIME_LIMIT_S = 10.0
# Fixed so every visitor sees the same demonstration; all barriers are certain.
DEMO_SEED = 1
DEMO_SCENARIOS = 1
GRID_WIDTH = 4
GRID_HEIGHT = 3
# Exhaustive search stays well inside the engine's 20-repair limit.
GRID_BARRIERS = 8
PLAN_CACHE_SIZE = 256


@lru_cache(maxsize=len(PlanningDataset))
def demo_network(dataset: PlanningDataset) -> SyntheticNetwork:
    if dataset == PlanningDataset.corridor:
        return complementarity_case()
    clustering = 1.0 if dataset == PlanningDataset.grid_clustered else 0.0
    config = SyntheticConfig(
        width=GRID_WIDTH,
        height=GRID_HEIGHT,
        barrier_count=GRID_BARRIERS,
        clustering=clustering,
    )
    return generate_network(config, seed=DEMO_SEED)


def _network_view(
    network: SyntheticNetwork, names: Mapping[str, str | None]
) -> NetworkView:
    instance = network.instance
    return NetworkView(
        nodes=tuple(
            NodeView(id=key, x_m=x, y_m=y) for key, (x, y) in network.positions.items()
        ),
        edges=tuple(
            EdgeView(id=e.id, u=e.u, v=e.v, length_m=e.length_m) for e in instance.edges
        ),
        barriers=tuple(
            BarrierView(
                id=b.id,
                edge_id=b.edge_id,
                node_id=b.node_id,
                type=b.type,
                severity=b.severity,
            )
            for b in instance.barriers
        ),
        repairs=tuple(
            RepairView(id=r.id, barrier_ids=r.barrier_ids, cost=r.cost)
            for r in instance.repairs
        ),
        origins=tuple(
            OriginView(id=o.id, node_id=o.node_id, weight=o.weight, group=o.group)
            for o in instance.origins
        ),
        destinations=tuple(
            DestinationView(
                id=d.id,
                node_id=d.node_id,
                category=d.category,
                weight=d.weight,
                name=names.get(d.id),
            )
            for d in instance.destinations
        ),
        profiles=tuple(
            ProfileView(
                id=p.id,
                weight=p.weight,
                impassable_types=tuple(sorted(p.impassable_types)),
                threshold_m=p.threshold_m,
            )
            for p in instance.profiles
        ),
    )


def _method_plan(
    network: SyntheticNetwork,
    method: PlanningMethod,
    budget: float,
    time_limit_s: float,
) -> tuple[MethodPlanView, EvaluationMetrics]:
    params = SolveParams(
        budget, method.value, DEMO_SCENARIOS, DEMO_SEED, None, time_limit_s
    )
    explanations: tuple[ExplanationView, ...] = ()
    if method.value in BASELINE_METHODS:
        selected = select_baseline(network, params, seed=DEMO_SEED)
    else:
        result = solve(network.instance, params)
        selected = result.selected_repair_ids
        explanations = tuple(
            ExplanationView(
                repair_id=item.repair_id,
                marginal_delta_a=item.marginal_delta_a,
                profiles_benefiting=item.profiles_benefiting,
                destination_categories=item.destination_categories,
                complementary_repair_ids=item.complementary_repair_ids,
                stable_under_cost_perturbation=item.stable_under_cost_perturbation,
            )
            for item in result.explanations
        )
    metrics = evaluate(network.instance, selected, params)
    plan = MethodPlanView(
        method=method,
        selected_repair_ids=selected,
        total_cost=metrics.total_cost,
        accessibility_after=metrics.after.total,
        delta_a=metrics.delta_a_expected,
        delta_a_by_profile=dict(metrics.delta_a_by_profile),
        delta_a_by_group=dict(metrics.delta_a_by_group),
        optimality_proven=method == PlanningMethod.exhaustive,
        explanations=explanations,
        route_impacts=tuple(
            RouteImpactView.model_validate(impact, from_attributes=True)
            for impact in evaluate_route_impacts(network.instance, selected, params)
        ),
    )
    return plan, metrics


def network_snapshot_id(network: SyntheticNetwork) -> str:
    """SHA-256 of the exact instance and engine version that plans and routes evaluate."""
    payload = {"engine_version": ENGINE_VERSION, "instance": network.instance}
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, default=_canonical).encode()
    ).hexdigest()


def _canonical(value: object) -> object:
    if is_dataclass(value) and not isinstance(value, type):
        return {f.name: getattr(value, f.name) for f in fields(value)}
    if isinstance(value, Mapping):
        return dict(value)  # e.g. mappingproxy edge attributes
    if isinstance(value, (set, frozenset)):
        return sorted(value)  # frozensets have no stable order across processes
    if isinstance(value, Enum):
        return value.value
    raise TypeError(f"cannot canonicalise {type(value).__name__}")


@lru_cache(maxsize=PLAN_CACHE_SIZE)
def run_plan(dataset: PlanningDataset, budget: float) -> PlanView:
    """Fictional networks only. Deterministic for a dataset and budget, so runs are cached."""
    if dataset == PlanningDataset.fremont_pilot:
        raise ValueError("the Fremont pilot plans come from pilot_plans, not run_plan")
    return build_plan(demo_network(dataset), dataset, budget, PLAN_TIME_LIMIT_S, {})


def build_plan(
    network: SyntheticNetwork,
    dataset: PlanningDataset,
    budget: float,
    time_limit_s: float,
    destination_names: Mapping[str, str | None],
) -> PlanView:
    results = tuple(
        _method_plan(network, method, budget, time_limit_s) for method in PlanningMethod
    )
    return PlanView(
        dataset=dataset,
        synthetic=dataset != PlanningDataset.fremont_pilot,
        budget=budget,
        total_repair_cost=fsum(r.cost for r in network.instance.repairs),
        accessibility_before=results[0][1].before.total,
        cost_perturbation_fraction=COST_PERTURBATION_FRACTION,
        engine_version=ENGINE_VERSION,
        snapshot_id=network_snapshot_id(network),
        network=_network_view(network, destination_names),
        plans=tuple(plan for plan, _ in results),
    )
