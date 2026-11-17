"""Liveness is independent of the database; readiness requires PostgreSQL/PostGIS."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import get_session
from .responses import Envelope, Health

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live", response_model=Envelope[Health])
def live() -> Envelope[Health]:
    return Envelope(data=Health(status="ok"))


@router.get("/ready", response_model=Envelope[Health])
def ready(session: Annotated[Session, Depends(get_session)]) -> Envelope[Health]:
    session.execute(text("SELECT PostGIS_Version()")).scalar_one()
    return Envelope(data=Health(status="ready"))
