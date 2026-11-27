"""Precomputed Fremont pilot plans.

Exhaustive search on the real network takes about 40 s at a budget of 2 repair units and does not
finish at 3 (measured 2026-11-18), far past a web request. The plans are computed once in a
background thread at startup and served from memory.
"""

import logging
import threading

from sqlalchemy import Engine

from .pilot_network import PilotNetwork, load_pilot_network
from .planning_adapter import build_plan
from .planning_schemas import PlanningDataset, PlanView

logger = logging.getLogger(__name__)

# Repair units. Larger budgets are out of reach of exhaustive search on this network.
PILOT_BUDGETS = (0.0, 1.0, 2.0)
PILOT_TIME_LIMIT_S = 180.0

_network: list[PilotNetwork] = []  # at most one; a list so the thread can publish it
_plans: dict[float, PlanView] = {}


class PlanNotReadyError(Exception):
    """The pilot plan is still being computed, or no pilot network is loaded."""


def pilot_network() -> PilotNetwork:
    if not _network:
        raise PlanNotReadyError
    return _network[0]


def pilot_plan(budget: float) -> PlanView:
    """Raises ValueError for a budget that is not precomputed, PlanNotReadyError before it is."""
    if budget not in PILOT_BUDGETS:
        raise ValueError(f"budget must be one of {PILOT_BUDGETS} repair units")
    plan = _plans.get(budget)
    if plan is None:
        raise PlanNotReadyError
    return plan


def _compute(engine: Engine) -> None:
    try:
        pilot = load_pilot_network(engine)
        if pilot is None:
            logger.info("no Fremont pilot network loaded; pilot plans disabled")
            return
        _network.append(pilot)
        for budget in PILOT_BUDGETS:
            _plans[budget] = build_plan(
                pilot.network,
                PlanningDataset.fremont_pilot,
                budget,
                PILOT_TIME_LIMIT_S,
                pilot.destination_names,
            )
            logger.info("Fremont pilot plan ready at budget %s", budget)
    except Exception:
        # A failed precompute must not stop the API; pilot requests keep answering 503.
        logger.exception("Fremont pilot plan precompute failed")


def start_precompute(engine: Engine) -> threading.Thread:
    thread = threading.Thread(
        target=_compute, args=(engine,), name="pilot-plans", daemon=True
    )
    thread.start()
    return thread
