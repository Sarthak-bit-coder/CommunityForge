"""Public community trip creation and retrieval."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from . import trip_repository
from .auth import MaybeReviewer
from .database import get_session
from .report_limits import limit_planning, limit_submission
from .report_schemas import DEFAULT_PAGE_SIZE, MAX_PAGE, MAX_PAGE_SIZE
from .responses import Envelope
from .trip_schemas import Nomination, TripCatalog, TripDetail, TripReceipt

router = APIRouter(prefix="/trips", tags=["community trips"])
DatabaseSession = Annotated[Session, Depends(get_session)]


@router.post("", status_code=201, dependencies=[Depends(limit_submission)])
def create_trip(
    payload: Nomination,
    reviewer: MaybeReviewer,
    session: DatabaseSession,
    response: Response,
) -> Envelope[TripReceipt]:
    if payload.source == "field" and reviewer is None:
        raise HTTPException(401)
    result = trip_repository.create(session, payload)
    if result is None:
        raise HTTPException(422)
    trip_id, created = result
    response.status_code = 201 if created else 200
    response.headers["Location"] = f"/trips/{trip_id}"
    return Envelope(data=TripReceipt(id=trip_id))


@router.get("")
def list_trips(
    session: DatabaseSession,
    page: Annotated[int, Query(ge=1, le=MAX_PAGE)] = 1,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
) -> Envelope[TripCatalog]:
    data, total = trip_repository.catalog(session, page, limit)
    return Envelope(data=data, meta={"page": page, "limit": limit, "total": total})


@router.get("/{trip_id}", dependencies=[Depends(limit_planning)])
def get_trip(trip_id: UUID, session: DatabaseSession) -> Envelope[TripDetail]:
    result = trip_repository.detail(session, trip_id)
    if result is None:
        raise HTTPException(404)
    return Envelope(data=result)
