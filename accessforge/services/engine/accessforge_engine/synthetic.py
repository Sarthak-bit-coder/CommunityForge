"""Seeded synthetic grids and one deliberately complementary corridor fixture."""

from collections.abc import Mapping
from dataclasses import dataclass
from random import Random
from types import MappingProxyType

from .contract import (
    Barrier,
    Destination,
    Edge,
    Node,
    Origin,
    ProblemInstance,
    Profile,
    Repair,
    MIN_SEVERITY,
    MAX_SEVERITY,
)
from .validation import InvalidInstanceError, number

BARRIER_TYPES = ("step", "rough", "signal")
DESTINATION_CATEGORIES = ("health", "transit", "grocery")
POPULATION_MIN = 20
POPULATION_MAX = 100


@dataclass(frozen=True)
class SyntheticConfig:
    width: int = 3
    height: int = 3
    barrier_count: int = 6
    cost_min: int = 10
    cost_max: int = 30
    clustering: float = 0
    edge_length_m: float = 25
    threshold_m: float = 150

    def __post_init__(self) -> None:
        for name in ("width", "height", "barrier_count", "cost_min", "cost_max"):
            value = getattr(self, name)
            if type(value) is not int or value < 0:
                raise InvalidInstanceError(f"{name} must be a nonnegative integer")
        if self.width < 2 or self.height < 1:
            raise InvalidInstanceError("grid requires width >= 2 and height >= 1")
        edge_count = self.height * (self.width - 1) + self.width * (self.height - 1)
        if self.barrier_count > edge_count:
            raise InvalidInstanceError("barrier_count exceeds grid edge count")
        if self.cost_min > self.cost_max:
            raise InvalidInstanceError("cost_min must not exceed cost_max")
        number(self.clustering, "clustering")
        number(self.edge_length_m, "edge_length_m")
        number(self.threshold_m, "threshold_m")
        if self.clustering > 1 or self.edge_length_m == 0:
            raise InvalidInstanceError(
                "clustering must be <= 1; edge_length_m must be positive"
            )


@dataclass(frozen=True)
class SyntheticNetwork:
    instance: ProblemInstance
    positions: Mapping[str, tuple[float, float]]

    def __post_init__(self) -> None:
        if set(self.positions) != {node.id for node in self.instance.nodes}:
            raise InvalidInstanceError("positions must cover exactly the network nodes")
        positions = {}
        for key, point in self.positions.items():
            if len(point) != 2:
                raise InvalidInstanceError("positions must be coordinate pairs")
            for coordinate in point:
                number(coordinate, "synthetic coordinate", signed=True)
            positions[key] = tuple(point)
        object.__setattr__(self, "positions", MappingProxyType(positions))


def _node_id(x: int, y: int) -> str:
    return f"n{x}_{y}"


def _edges(config: SyntheticConfig) -> tuple[Edge, ...]:
    edges: list[Edge] = []
    for y in range(config.height):
        for x in range(config.width):
            for dx, dy in ((1, 0), (0, 1)):
                if x + dx < config.width and y + dy < config.height:
                    edges.append(
                        Edge(
                            f"e{len(edges):04}",
                            _node_id(x, y),
                            _node_id(x + dx, y + dy),
                            config.edge_length_m,
                            {"incline": 0.0},
                        )
                    )
    return tuple(edges)


def _barrier_edges(
    edges: tuple[Edge, ...], count: int, clustering: float, *, seed: int
) -> tuple[Edge, ...]:
    random = Random(seed)
    remaining = list(edges)
    clustered: list[Edge] = []
    connected: set[str] = set()
    for _ in range(round(count * clustering)):
        frontier = [
            edge
            for edge in remaining
            if not connected or edge.u in connected or edge.v in connected
        ]
        edge = random.choice(frontier)
        clustered.append(edge)
        connected.update((edge.u, edge.v))
        remaining.remove(edge)
    return tuple(clustered + random.sample(remaining, count - len(clustered)))


def _profiles(threshold_m: float) -> tuple[Profile, ...]:
    return (
        Profile(
            "wheelchair", 0.5, 0.08, frozenset({"step"}), {"rough": 2}, threshold_m
        ),
        Profile(
            "low_vision", 0.25, None, frozenset({"signal"}), {"rough": 0.5}, threshold_m
        ),
        Profile("pedestrian", 0.25, None, frozenset(), {"rough": 0.25}, threshold_m),
    )


def _repair_candidates(
    config: SyntheticConfig, placements: tuple[Edge, ...], *, seed: int
) -> tuple[tuple[Barrier, ...], tuple[Repair, ...]]:
    random = Random(seed)
    barriers = tuple(
        Barrier(
            f"b{i}",
            edge.id,
            None,
            random.choice(BARRIER_TYPES),
            random.randint(MIN_SEVERITY, MAX_SEVERITY),
            1,
        )
        for i, edge in enumerate(placements)
    )
    costs = tuple(random.randint(config.cost_min, config.cost_max) for _ in barriers)
    repairs = tuple(
        Repair(f"r{i}", (b.id,), costs[i], costs[i], costs[i])
        for i, b in enumerate(barriers)
    )
    return barriers, repairs


def generate_network(config: SyntheticConfig, *, seed: int) -> SyntheticNetwork:
    if type(seed) is not int or seed < 0:
        raise InvalidInstanceError("seed must be a nonnegative integer")
    random = Random(seed)
    edges = _edges(config)
    placements = _barrier_edges(
        edges, config.barrier_count, config.clustering, seed=random.getrandbits(64)
    )
    barriers, repairs = _repair_candidates(
        config, placements, seed=random.getrandbits(64)
    )
    origins = tuple(
        Origin(
            f"o{y}",
            _node_id(0, y),
            random.randint(POPULATION_MIN, POPULATION_MAX),
            f"row{y}",
        )
        for y in range(config.height)
    )
    destinations = tuple(
        Destination(
            f"d{y}",
            _node_id(config.width - 1, y),
            DESTINATION_CATEGORIES[y % len(DESTINATION_CATEGORIES)],
            1,
        )
        for y in range(config.height)
    )
    positions = {
        _node_id(x, y): (x * config.edge_length_m, y * config.edge_length_m)
        for y in range(config.height)
        for x in range(config.width)
    }
    instance = ProblemInstance(
        edges,
        barriers,
        repairs,
        _profiles(config.threshold_m),
        origins,
        destinations,
        tuple(Node(key) for key in positions),
    )
    return SyntheticNetwork(instance, positions)


def complementarity_case() -> SyntheticNetwork:
    """Two hard serial barriers: neither repair alone benefits the wheelchair profile."""
    instance = ProblemInstance(
        (
            Edge("e0", "a", "b", 25, {"incline": 0}),
            Edge("e1", "b", "c", 25, {"incline": 0}),
        ),
        (
            Barrier("b0", "e0", None, "step", 3, 1),
            Barrier("b1", "e1", None, "step", 3, 1),
        ),
        (Repair("r0", ("b0",), 10, 10, 10), Repair("r1", ("b1",), 10, 10, 10)),
        (
            Profile("wheelchair", 0.5, 0.08, frozenset({"step"}), {}, 100),
            Profile("pedestrian", 0.5, None, frozenset(), {}, 100),
        ),
        (Origin("home", "a", 10, "corridor"),),
        (Destination("clinic", "c", "health", 2),),
        (Node("a"), Node("b"), Node("c")),
    )
    return SyntheticNetwork(instance, {"a": (0, 0), "b": (25, 0), "c": (50, 0)})
