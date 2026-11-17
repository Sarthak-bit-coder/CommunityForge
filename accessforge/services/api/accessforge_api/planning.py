"""Public, rate-limited repair planning over synthetic demonstration networks."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from .planning_adapter import run_plan
from .planning_schemas import Budget, PlanningDataset, PlanView
from .report_limits import limit_planning
from .responses import Envelope

router = APIRouter(prefix="/planning", tags=["planning"])


@router.get(
    "/plans",
    response_model=Envelope[PlanView],
    dependencies=[Depends(limit_planning)],
)
def get_plan(
    dataset: PlanningDataset, budget: Annotated[Budget, Query()]
) -> Envelope[PlanView]:
    """Modeled estimates on fictional networks, never an inspection or safe route."""
    try:
        return Envelope(data=run_plan(dataset, budget))
    except TimeoutError as error:
        # The engine returns no partial portfolio; neither does this route.
        raise HTTPException(503) from error
