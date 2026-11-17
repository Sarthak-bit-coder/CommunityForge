"""Public planning contracts; every figure is a modeled engine output."""

from enum import Enum
from typing import Annotated

from pydantic import Field

from .schemas import FrozenInput

# Bounds the request, not a cost estimate; synthetic totals are far smaller.
MAX_BUDGET = 1_000_000.0
Budget = Annotated[float, Field(ge=0, le=MAX_BUDGET, allow_inf_nan=False)]


class PlanningDataset(str, Enum):
    """Synthetic demonstration networks only; no real street data is loaded."""

    corridor = "corridor"
    grid_scattered = "grid_scattered"
    grid_clustered = "grid_clustered"


class PlanningMethod(str, Enum):
    exhaustive = "exhaustive"
    greedy = "B3"
    severity_first = "B1"
    proximity_density = "B2"


class NodeView(FrozenInput):
    id: str
    x_m: float
    y_m: float


class EdgeView(FrozenInput):
    id: str
    u: str
    v: str
    length_m: float


class BarrierView(FrozenInput):
    id: str
    edge_id: str | None
    node_id: str | None
    type: str
    severity: int


class RepairView(FrozenInput):
    id: str
    barrier_ids: tuple[str, ...]
    cost: float


class OriginView(FrozenInput):
    id: str
    node_id: str
    weight: float
    group: str


class DestinationView(FrozenInput):
    id: str
    node_id: str
    category: str
    weight: float


class ProfileView(FrozenInput):
    id: str
    weight: float
    impassable_types: tuple[str, ...]
    threshold_m: float


class NetworkView(FrozenInput):
    nodes: tuple[NodeView, ...]
    edges: tuple[EdgeView, ...]
    barriers: tuple[BarrierView, ...]
    repairs: tuple[RepairView, ...]
    origins: tuple[OriginView, ...]
    destinations: tuple[DestinationView, ...]
    profiles: tuple[ProfileView, ...]


class ExplanationView(FrozenInput):
    repair_id: str
    marginal_delta_a: float
    profiles_benefiting: tuple[str, ...]
    destination_categories: tuple[str, ...]
    complementary_repair_ids: tuple[str, ...]
    stable_under_cost_perturbation: bool


class MethodPlanView(FrozenInput):
    method: PlanningMethod
    selected_repair_ids: tuple[str, ...]
    total_cost: float
    accessibility_after: float
    delta_a: float
    delta_a_by_profile: dict[str, float]
    delta_a_by_group: dict[str, float]
    optimality_proven: bool
    # Present only for engine solvers; proxy rankings produce no explanations.
    explanations: tuple[ExplanationView, ...]


class PlanView(FrozenInput):
    dataset: PlanningDataset
    synthetic: bool
    budget: float
    total_repair_cost: float
    accessibility_before: float
    cost_perturbation_fraction: float
    engine_version: str
    network: NetworkView
    plans: tuple[MethodPlanView, ...]
