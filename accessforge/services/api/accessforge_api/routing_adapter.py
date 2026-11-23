"""Connects labeled networks and recommended repairs to the route analysis."""

from accessforge_engine.optimization import ENGINE_VERSION

from .pilot_plans import pilot_network, pilot_plan
from .planning_adapter import demo_network, network_snapshot_id, run_plan
from .planning_schemas import PlanningDataset, PlanningMethod
from .routing_core import RouteQuery, compare_routes
from .routing_schemas import RouteAnalysisView, TripImpactView


class StaleSnapshotError(Exception):
    """The requested snapshot is not the current network snapshot."""

    def __init__(self, current_snapshot_id: str) -> None:
        super().__init__(current_snapshot_id)
        self.current_snapshot_id = current_snapshot_id


def analyze_demo_route(
    dataset: PlanningDataset,
    origin_id: str,
    destination_id: str,
    profile_id: str,
    budget: float,
    expected_snapshot_id: str | None = None,
) -> RouteAnalysisView:
    """Raises LookupError for an origin, destination or profile the demo network lacks.

    Raises StaleSnapshotError when expected_snapshot_id names a different snapshot.
    """
    if dataset == PlanningDataset.fremont_pilot:
        planned = pilot_plan(budget)
        network = pilot_network().network
    else:
        planned = run_plan(dataset, budget)
        network = demo_network(dataset)
    snapshot_id = network_snapshot_id(network)
    if expected_snapshot_id not in (None, snapshot_id):
        raise StaleSnapshotError(snapshot_id)
    if planned.snapshot_id != snapshot_id:
        raise StaleSnapshotError(snapshot_id)
    plan = next(
        item for item in planned.plans if item.method == PlanningMethod.exhaustive
    )
    comparison = compare_routes(
        network.instance,
        RouteQuery(origin_id, destination_id, profile_id),
        plan.selected_repair_ids,
    )
    return RouteAnalysisView(
        **comparison.model_dump(),
        dataset=dataset.value,
        synthetic=planned.synthetic,
        budget=budget,
        engine_version=ENGINE_VERSION,
        snapshot_id=snapshot_id,
        origin_id=origin_id,
        destination_id=destination_id,
        profile_id=profile_id,
        recommended_repair_ids=plan.selected_repair_ids,
        recommended_cost=plan.total_cost,
        route_impacts=tuple(
            TripImpactView(
                **impact.model_dump(),
                current_distance_m=comparison.current.distance_m,
                modeled_distance_m=comparison.after_repairs.distance_m,
            )
            for impact in plan.route_impacts
            if (impact.profile_id, impact.origin_id, impact.destination_id)
            == (profile_id, origin_id, destination_id)
        ),
    )
