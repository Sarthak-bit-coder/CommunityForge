"""Frozen inputs using the field names and order of ARCHITECTURE.md §3.

Graph, evaluation inputs, and optimization results implement the declared contract.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from types import MappingProxyType

from .validation import InvalidInstanceError, identifier, number, unique

MIN_SEVERITY = 1
MAX_SEVERITY = 5


@dataclass(frozen=True)
class Node:
    id: str

    def __post_init__(self) -> None:
        identifier(self.id, "node.id")


@dataclass(frozen=True)
class Edge:
    id: str
    u: str
    v: str
    length_m: float
    attrs: Mapping[str, float | str]

    def __post_init__(self) -> None:
        for name in ("id", "u", "v"):
            identifier(getattr(self, name), f"edge.{name}")
        number(self.length_m, "edge.length_m")
        attrs = dict(self.attrs)
        for key, value in attrs.items():
            identifier(key, "edge attribute key")
            if not isinstance(value, str):
                number(value, f"edge.attrs[{key}]", signed=True)
        if "incline" in attrs:
            number(attrs["incline"], "edge.incline", signed=True)
        object.__setattr__(self, "attrs", MappingProxyType(attrs))


@dataclass(frozen=True)
class Barrier:
    id: str
    edge_id: str | None
    node_id: str | None
    type: str
    severity: int
    presence_prob: float

    def __post_init__(self) -> None:
        identifier(self.id, "barrier.id")
        identifier(self.type, "barrier.type")
        if (self.edge_id is None) == (self.node_id is None):
            raise InvalidInstanceError(
                "barrier requires exactly one edge_id or node_id"
            )
        identifier(
            self.edge_id if self.edge_id is not None else self.node_id,
            "barrier location",
        )
        if (
            type(self.severity) is not int
            or not MIN_SEVERITY <= self.severity <= MAX_SEVERITY
        ):
            raise InvalidInstanceError("barrier.severity must be an integer in [1, 5]")
        number(self.presence_prob, "barrier.presence_prob")
        if self.presence_prob > 1:
            raise InvalidInstanceError("barrier.presence_prob must be in [0, 1]")


@dataclass(frozen=True)
class Repair:
    id: str
    barrier_ids: tuple[str, ...]
    cost: float
    cost_low: float
    cost_high: float

    def __post_init__(self) -> None:
        identifier(self.id, "repair.id")
        if isinstance(self.barrier_ids, (str, bytes)):
            raise InvalidInstanceError("repair.barrier_ids must be a collection of IDs")
        ids = tuple(self.barrier_ids)
        for barrier_id in ids:
            identifier(barrier_id, "repair.barrier_id")
        unique(ids, "repair barrier IDs")
        object.__setattr__(self, "barrier_ids", ids)
        for name in ("cost", "cost_low", "cost_high"):
            number(getattr(self, name), f"repair.{name}")
        if not self.cost_low <= self.cost <= self.cost_high:
            raise InvalidInstanceError("repair requires cost_low <= cost <= cost_high")


@dataclass(frozen=True)
class Profile:
    id: str
    weight: float
    max_incline: float | None
    impassable_types: frozenset[str]
    penalties: Mapping[str, float]
    threshold_m: float

    def __post_init__(self) -> None:
        identifier(self.id, "profile.id")
        number(self.weight, "profile.weight")
        number(self.threshold_m, "profile.threshold_m")
        if self.max_incline is not None:
            number(self.max_incline, "profile.max_incline")
        if isinstance(self.impassable_types, (str, bytes)):
            raise InvalidInstanceError(
                "profile.impassable_types must be a collection of types"
            )
        types = frozenset(self.impassable_types)
        for barrier_type in types:
            identifier(barrier_type, "profile.impassable_type")
        penalties = dict(self.penalties)
        for key, value in penalties.items():
            identifier(key, "profile penalty type")
            number(value, "profile.penalty")
        object.__setattr__(self, "impassable_types", types)
        object.__setattr__(self, "penalties", MappingProxyType(penalties))


@dataclass(frozen=True)
class Origin:
    id: str
    node_id: str
    weight: float
    group: str

    def __post_init__(self) -> None:
        for name in ("id", "node_id", "group"):
            identifier(getattr(self, name), f"origin.{name}")
        number(self.weight, "origin.weight")


@dataclass(frozen=True)
class Destination:
    id: str
    node_id: str
    category: str
    weight: float

    def __post_init__(self) -> None:
        for name in ("id", "node_id", "category"):
            identifier(getattr(self, name), f"destination.{name}")
        number(self.weight, "destination.weight")


@dataclass(frozen=True)
class ProblemInstance:
    edges: tuple[Edge, ...]
    barriers: tuple[Barrier, ...]
    repairs: tuple[Repair, ...]
    profiles: tuple[Profile, ...]
    origins: tuple[Origin, ...]
    destinations: tuple[Destination, ...]
    nodes: tuple[Node, ...]

    def __post_init__(self) -> None:
        for name, model in (
            ("edges", Edge),
            ("barriers", Barrier),
            ("repairs", Repair),
            ("profiles", Profile),
            ("origins", Origin),
            ("destinations", Destination),
            ("nodes", Node),
        ):
            items = tuple(getattr(self, name))
            if any(not isinstance(item, model) for item in items):
                raise InvalidInstanceError(
                    f"{name} must contain {model.__name__} values"
                )
            unique(tuple(item.id for item in items), f"{name} IDs")
            object.__setattr__(self, name, items)
        self._validate_references()
        if not self.profiles or not any(p.weight > 0 for p in self.profiles):
            raise InvalidInstanceError("profiles require positive total weight")

    def _validate_references(self) -> None:
        nodes = {node.id for node in self.nodes}
        edges = {edge.id for edge in self.edges}
        barriers = {barrier.id for barrier in self.barriers}
        for edge in self.edges:
            if edge.u not in nodes or edge.v not in nodes:
                raise InvalidInstanceError(f"edge {edge.id}: dangling node reference")
        for barrier in self.barriers:
            if (barrier.edge_id is not None and barrier.edge_id not in edges) or (
                barrier.node_id is not None and barrier.node_id not in nodes
            ):
                raise InvalidInstanceError(f"barrier {barrier.id}: dangling location")
        for repair in self.repairs:
            if not set(repair.barrier_ids) <= barriers:
                raise InvalidInstanceError(
                    f"repair {repair.id}: dangling barrier reference"
                )
        locations: tuple[Origin | Destination, ...] = (
            *self.origins,
            *self.destinations,
        )
        for item in locations:
            if item.node_id not in nodes:
                raise InvalidInstanceError(
                    f"{item.id}: dangling origin/destination node"
                )


@dataclass(frozen=True)
class SolveParams:
    budget: float
    method: str
    n_scenarios: int
    seed: int
    equity: None
    time_limit_s: float

    def __post_init__(self) -> None:
        number(self.budget, "budget")
        identifier(self.method, "method")
        if type(self.n_scenarios) is not int or self.n_scenarios <= 0:
            raise InvalidInstanceError("n_scenarios must be a positive integer")
        if type(self.seed) is not int or self.seed < 0:
            raise InvalidInstanceError("seed must be a nonnegative integer")
        number(self.time_limit_s, "time_limit_s")
        if self.time_limit_s == 0:
            raise InvalidInstanceError("time_limit_s must be positive")
        if self.equity is not None:
            raise InvalidInstanceError("equity is not implemented; use None")


@dataclass(frozen=True)
class Explanation:
    """Measured portfolio-removal effects, not additive benefit attribution."""

    repair_id: str
    marginal_delta_a: float
    profiles_benefiting: tuple[str, ...]
    destination_categories: tuple[str, ...]
    bundle_id: str | None
    complementary_repair_ids: tuple[str, ...]
    stable_under_cost_perturbation: bool

    def __post_init__(self) -> None:
        for name in (
            "profiles_benefiting",
            "destination_categories",
            "complementary_repair_ids",
        ):
            object.__setattr__(self, name, tuple(getattr(self, name)))


@dataclass(frozen=True)
class SolveResult:
    """Completed optimization of modeled accessibility on fixed scenarios."""

    method: str
    selected_repair_ids: tuple[str, ...]
    total_cost: float
    delta_a_expected: float
    delta_a_by_profile: Mapping[str, float]
    delta_a_by_group: Mapping[str, float]
    explanations: tuple[Explanation, ...]
    diagnostics: Mapping[str, float]
    engine_version: str

    def __post_init__(self) -> None:
        for name in ("selected_repair_ids", "explanations"):
            object.__setattr__(self, name, tuple(getattr(self, name)))
        for name in ("delta_a_by_profile", "delta_a_by_group", "diagnostics"):
            object.__setattr__(self, name, MappingProxyType(dict(getattr(self, name))))
