"""Fixed synthetic B0–B2 per-defect ranking policies; no portfolio lookahead."""

from fractions import Fraction
from math import fsum, hypot, pi
from random import Random

from .contract import Barrier, Repair, SolveParams
from .synthetic import SyntheticNetwork
from .validation import InvalidInstanceError

PROXIMITY_SCALE_M = 100.0
DENSITY_RADIUS_M = 100.0
BASELINE_METHODS = frozenset({"B0", "B1", "B2"})


def _location(network: SyntheticNetwork, barrier: Barrier) -> tuple[float, float]:
    if barrier.node_id is not None:
        return network.positions[barrier.node_id]
    edge = next(edge for edge in network.instance.edges if edge.id == barrier.edge_id)
    u, v = network.positions[edge.u], network.positions[edge.v]
    return (u[0] + v[0]) / 2, (u[1] + v[1]) / 2


def _defect_score(network: SyntheticNetwork, barrier: Barrier) -> float:
    x, y = _location(network, barrier)
    proximity = fsum(
        d.weight
        / (
            1
            + hypot(
                x - network.positions[d.node_id][0], y - network.positions[d.node_id][1]
            )
            / PROXIMITY_SCALE_M
        )
        for d in network.instance.destinations
    )
    density = fsum(
        o.weight
        for o in network.instance.origins
        if hypot(
            x - network.positions[o.node_id][0], y - network.positions[o.node_id][1]
        )
        <= DENSITY_RADIUS_M
    ) / (pi * DENSITY_RADIUS_M**2)
    return barrier.severity * proximity * density


def _score_key(score: float, repair: Repair) -> tuple[bool, Fraction, str]:
    ratio = Fraction(score) / Fraction(repair.cost) if repair.cost else Fraction(score)
    return not (repair.cost == 0 and score > 0), -ratio, repair.id


def _pack(order: list[Repair], budget: float) -> tuple[str, ...]:
    selected: list[Repair] = []
    for repair in order:
        try:
            affordable = fsum(r.cost for r in (*selected, repair)) <= budget
        except OverflowError:
            affordable = False  # Nonnegative overflowing costs exceed a finite budget.
        if affordable:
            selected.append(repair)
    return tuple(sorted(repair.id for repair in selected))


def select_baseline(
    network: SyntheticNetwork, params: SolveParams, *, seed: int
) -> tuple[str, ...]:
    """Rank once, then scan all repairs and skip unaffordable candidates."""
    if params.method not in BASELINE_METHODS:
        raise InvalidInstanceError("baseline method must be B0, B1, or B2")
    if type(seed) is not int or seed < 0:
        raise InvalidInstanceError("baseline seed must be a nonnegative integer")
    repairs = sorted(network.instance.repairs, key=lambda repair: repair.id)
    barriers = {b.id: b for b in network.instance.barriers}
    if params.method == "B0":
        Random(seed).shuffle(repairs)
    elif params.method == "B1":
        repairs.sort(
            key=lambda r: (
                -max((barriers[key].severity for key in r.barrier_ids), default=0),
                r.cost,
                r.id,
            )
        )
    else:
        scores = {
            r.id: fsum(_defect_score(network, barriers[key]) for key in r.barrier_ids)
            for r in repairs
        }
        repairs.sort(key=lambda r: _score_key(scores[r.id], r))
    return _pack(repairs, params.budget)
