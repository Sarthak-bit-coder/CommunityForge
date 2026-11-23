"""Public, rate-limited repair planning over fictional networks and the Fremont pilot."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from .pilot_plans import PlanNotReadyError, pilot_plan
from .planning_adapter import run_plan
from .planning_schemas import Budget, PlanningDataset, PlanView
from .report_limits import limit_planning
from .responses import Envelope

router = APIRouter(prefix="/planning", tags=["planning"])
SNAPSHOT_ID_MAX_LENGTH = 64
PLAN_NOT_READY_RETRY_S = "30"


def resolve_plan(dataset: PlanningDataset, budget: float) -> PlanView:
    """Raises HTTPException for an unknown pilot budget, a pilot plan still computing, or a
    timeout."""
    try:
        if dataset == PlanningDataset.fremont_pilot:
            return pilot_plan(budget)
        return run_plan(dataset, budget)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    except PlanNotReadyError as error:
        raise HTTPException(
            503,
            "The Fremont pilot plans are still being computed. Try again shortly.",
            headers={"Retry-After": PLAN_NOT_READY_RETRY_S},
        ) from error
    except TimeoutError as error:
        # The engine returns no partial portfolio; neither does this route.
        raise HTTPException(503) from error


@router.get(
    "/plans",
    response_model=Envelope[PlanView],
    dependencies=[Depends(limit_planning)],
)
def get_plan(
    dataset: PlanningDataset,
    budget: Annotated[Budget, Query()],
    snapshot_id: Annotated[
        str | None, Query(min_length=1, max_length=SNAPSHOT_ID_MAX_LENGTH)
    ] = None,
) -> Envelope[PlanView]:
    """Modeled estimates, never an inspection or safe route."""
    plan = resolve_plan(dataset, budget)
    if snapshot_id not in (None, plan.snapshot_id):
        # The caller's snapshot predates the current network; rerun the plan.
        raise HTTPException(409, "snapshot_id is stale")
    return Envelope(data=plan)
