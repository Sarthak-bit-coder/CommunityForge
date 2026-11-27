"""Public, rate-limited route analysis over synthetic demonstration networks."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from .pilot_plans import PlanNotReadyError
from .planning import PLAN_NOT_READY_RETRY_S
from .planning_schemas import Budget, PlanningDataset
from .report_limits import limit_planning
from .responses import Envelope
from .routing_adapter import StaleSnapshotError, analyze_demo_route
from .routing_schemas import RouteAnalysisView

router = APIRouter(prefix="/routing", tags=["routing"])
ID_MAX_LENGTH = 64


@router.get(
    "/analysis",
    response_model=Envelope[RouteAnalysisView],
    dependencies=[Depends(limit_planning)],
)
def get_route_analysis(
    dataset: PlanningDataset,
    origin: Annotated[str, Query(min_length=1, max_length=ID_MAX_LENGTH)],
    destination: Annotated[str, Query(min_length=1, max_length=ID_MAX_LENGTH)],
    profile: Annotated[str, Query(min_length=1, max_length=ID_MAX_LENGTH)],
    budget: Annotated[Budget, Query()],
    snapshot_id: Annotated[
        str | None, Query(min_length=1, max_length=ID_MAX_LENGTH)
    ] = None,
) -> Envelope[RouteAnalysisView]:
    """Modeled routes on fictional networks, never a safe-route determination."""
    try:
        view = analyze_demo_route(
            dataset,
            origin,
            destination,
            profile,
            budget,
            expected_snapshot_id=snapshot_id,
        )
    except LookupError as error:
        # The demo network has no such origin, destination or profile.
        raise HTTPException(404) from error
    except StaleSnapshotError as error:
        # The caller's snapshot_id predates the current network; rerun the analysis.
        raise HTTPException(409, "snapshot_id is stale") from error
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    except PlanNotReadyError as error:
        raise HTTPException(
            503,
            "The Fremont pilot plans are still being computed. Try again shortly.",
            headers={"Retry-After": PLAN_NOT_READY_RETRY_S},
        ) from error
    except TimeoutError as error:
        raise HTTPException(503) from error
    return Envelope(data=view)
