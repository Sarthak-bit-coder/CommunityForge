"""Reproduces docs/PILOT_FINDING.md from the loaded Fremont pilot network.

Usage: DATABASE_URL=postgresql+psycopg://... uv run python scripts/pilot_finding.py
Every barrier is treated as present (presence_prob = 1): the question is "if OpenStreetMap is
right". Output is modeled, never an inspection or a compliance finding.
"""

import os
import sys
from collections import Counter
from dataclasses import replace

from accessforge_engine import SolveParams, evaluate
from accessforge_engine.contract import ProblemInstance
from accessforge_engine.evaluation import evaluate_route_impacts
from sqlalchemy import create_engine

from accessforge_api.pilot_network import load_pilot_network

ANALYSIS_BUDGET = 100.0  # above the 20 repair units, so no subset is budget-infeasible
TIME_LIMIT_S = 600.0
SEED = 1
GAIN_TOLERANCE = 1e-6


def _params() -> SolveParams:
    return SolveParams(ANALYSIS_BUDGET, "B3", 1, SEED, None, TIME_LIMIT_S)


def _gain(instance: ProblemInstance, repairs: list[str]) -> float:
    return evaluate(instance, tuple(repairs), _params()).delta_a_expected


def minimal_set(instance: ProblemInstance) -> list[str]:
    """Drop each repair, in ID order, whose removal keeps the gain of fixing everything."""
    keep = sorted(r.id for r in instance.repairs)
    target = _gain(instance, keep)
    for repair in list(keep):
        trial = [r for r in keep if r != repair]
        if abs(_gain(instance, trial) - target) < GAIN_TOLERANCE:
            keep = trial
    return keep


def main() -> None:
    pilot = load_pilot_network(create_engine(os.environ["DATABASE_URL"]))
    if pilot is None:
        sys.exit("No pilot network loaded. Run the ingest first.")
    base = pilot.network.instance
    instance = replace(
        base, barriers=tuple(replace(b, presence_prob=1.0) for b in base.barriers)
    )
    repairs = sorted(r.id for r in instance.repairs)
    print(f"Fix all {len(repairs)}: gain {_gain(instance, repairs):.1f}")
    singles = [r for r in repairs if _gain(instance, [r]) > GAIN_TOLERANCE]
    print(f"Repairs with any gain on their own: {len(singles)}")
    keep = minimal_set(instance)
    print(f"Minimal set ({len(keep)}): gain {_gain(instance, keep):.1f}")
    for repair in keep:
        rest = [r for r in keep if r != repair]
        print(f"  without {repair}: gain {_gain(instance, rest):.1f}")
    opened = [
        t for t in evaluate_route_impacts(instance, tuple(keep), _params())
        if t.modeled_reach_after > t.modeled_reach_before
    ]  # fmt: skip
    origins = {o.id: o.weight for o in instance.origins}
    categories = {d.id: d.category for d in instance.destinations}
    blocks = {t.origin_id for t in opened}
    print(
        f"Trips opened: {len(opened)}, profiles {sorted({t.profile_id for t in opened})}"
    )
    print(
        f"Census blocks: {len(blocks)}, residents {sum(origins[b] for b in blocks):.0f}"
    )
    print(
        f"Destinations: {dict(Counter(categories[t.destination_id] for t in opened))}"
    )


if __name__ == "__main__":
    main()
