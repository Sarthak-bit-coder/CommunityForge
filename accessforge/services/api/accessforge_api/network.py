"""Public, read-only pilot-area street geometry for the map background."""

import json
from collections.abc import Sequence
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy import String, func, select
from sqlalchemy.orm import Session

from .database import get_session
from .network_models import DataSource, NetworkEdge
from .responses import Envelope
from .schemas import FrozenInput

router = APIRouter(prefix="/network", tags=["network"])

# The Fremont pilot area has ~1,300 segments; the cap bounds a misconfigured larger load.
MAX_STREET_SEGMENTS = 20_000
COORDINATE_DECIMALS = 6
CACHE_SECONDS = 3600

Point = tuple[float, float]


class StreetNetwork(FrozenInput):
    """Line geometry only. Empty lines mean no pilot network is loaded."""

    lines: tuple[tuple[Point, ...], ...]
    attribution: tuple[str, ...]
    truncated: bool


@router.get("/streets", response_model=Envelope[StreetNetwork])
def get_streets(
    session: Annotated[Session, Depends(get_session)], response: Response
) -> Envelope[StreetNetwork]:
    rows: Sequence[str] = session.scalars(
        select(func.ST_AsGeoJSON(NetworkEdge.geom, COORDINATE_DECIMALS, type_=String))
        .order_by(NetworkEdge.id)
        .limit(MAX_STREET_SEGMENTS + 1)
    ).all()
    licenses = session.scalars(
        select(DataSource.license)
        .where(DataSource.id.in_(select(NetworkEdge.source_id).distinct()))
        .order_by(DataSource.license)
    ).all()
    lines = tuple(
        tuple((x, y) for x, y in json.loads(row)["coordinates"])
        for row in rows[:MAX_STREET_SEGMENTS]
    )
    response.headers["Cache-Control"] = f"public, max-age={CACHE_SECONDS}"
    return Envelope(
        data=StreetNetwork(
            lines=lines,
            attribution=tuple(licenses),
            truncated=len(rows) > MAX_STREET_SEGMENTS,
        )
    )
