"""Route-analysis contracts; every route is a modeled path on a fictional network."""

from enum import Enum

from .planning_schemas import RouteImpactView
from .schemas import FrozenInput


class RouteStatus(str, Enum):
    """accessible: a route exists with every recorded barrier present.
    uncertain: a route exists only if some unverified barrier is absent.
    no_route: no route within the profile's threshold, given the recorded barriers."""

    accessible = "accessible"
    uncertain = "uncertain"
    no_route = "no_route"


class RouteReason(str, Enum):
    barrier = "barrier"
    distance_or_disconnected = "distance_or_disconnected"


class RouteBarrierView(FrozenInput):
    id: str
    edge_id: str | None
    node_id: str | None
    type: str
    severity: int
    # True only for confirmed presence; unverified barriers are modeled as uncertain.
    verified: bool
    blocks_profile: bool


class RouteOutcome(FrozenInput):
    status: RouteStatus
    reason: RouteReason | None
    generalized_cost: float | None
    distance_m: float | None
    node_ids: tuple[str, ...]
    edge_ids: tuple[str, ...]
    barriers_on_route: tuple[RouteBarrierView, ...]


class RouteComparison(FrozenInput):
    threshold_m: float
    current: RouteOutcome
    after_repairs: RouteOutcome
    # Barriers on the unobstructed shortest path: the ones that can cut this trip.
    affecting_barriers: tuple[RouteBarrierView, ...]
    limitations: tuple[str, ...]


class TripImpactView(RouteImpactView):
    current_distance_m: float | None
    modeled_distance_m: float | None


class RouteAnalysisView(RouteComparison):
    dataset: str
    synthetic: bool
    budget: float
    engine_version: str
    snapshot_id: str
    origin_id: str
    destination_id: str
    profile_id: str
    recommended_repair_ids: tuple[str, ...]
    recommended_cost: float
    route_impacts: tuple[TripImpactView, ...] = ()
