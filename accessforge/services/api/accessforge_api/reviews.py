"""Reviewer-only session and review routes; every route requires a reviewer key."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import Field
from sqlalchemy.orm import Session

from . import review_repository
from .auth import COOKIE_NAME, SESSION_SECONDS, Reviewer, reviewer_for_key
from .database import get_session
from .report_limits import record_failed_sign_in, refuse_locked_out
from .responses import Envelope
from .review_schemas import (
    ReportNotFound,
    ReviewConflict,
    ReviewInput,
    ReviewView,
)
from .schemas import FrozenInput

MAX_KEY_LENGTH = 512

router = APIRouter(tags=["reviews"])
DatabaseSession = Annotated[Session, Depends(get_session)]


class SessionCreate(FrozenInput):
    key: Annotated[str, Field(min_length=1, max_length=MAX_KEY_LENGTH)]


class ReviewerSession(FrozenInput):
    reviewer_id: UUID


@router.post("/reviewer/session", response_model=Envelope[ReviewerSession])
def sign_in(
    payload: SessionCreate, request: Request, response: Response
) -> Envelope[ReviewerSession]:
    refuse_locked_out(request)
    reviewer = reviewer_for_key(payload.key, request.app.state.reviewer_keys)
    if reviewer is None:
        record_failed_sign_in(request)
        raise HTTPException(401)
    response.set_cookie(
        COOKIE_NAME,
        payload.key,
        max_age=SESSION_SECONDS,
        httponly=True,
        secure=request.app.state.reviewer_cookie_secure,
        samesite="strict",
        path="/",
    )
    return Envelope(data=ReviewerSession(reviewer_id=reviewer))


@router.get("/reviewer/session", response_model=Envelope[ReviewerSession])
def current_session(reviewer: Reviewer) -> Envelope[ReviewerSession]:
    return Envelope(data=ReviewerSession(reviewer_id=reviewer))


@router.delete("/reviewer/session", status_code=204)
def sign_out(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


@router.post(
    "/reports/{report_id}/reviews",
    status_code=201,
    response_model=Envelope[ReviewView],
)
def review_report(
    report_id: UUID, payload: ReviewInput, reviewer: Reviewer, session: DatabaseSession
) -> Envelope[ReviewView]:
    try:
        review = review_repository.review_report(
            session, report_id, payload, reviewer_id=reviewer
        )
    except ReportNotFound as error:
        raise HTTPException(404) from error
    except ReviewConflict as error:
        raise HTTPException(409) from error
    return Envelope(data=review)


@router.get(
    "/reports/{report_id}/reviews",
    response_model=Envelope[tuple[ReviewView, ...]],
)
def review_history(
    report_id: UUID, reviewer: Reviewer, session: DatabaseSession
) -> Envelope[tuple[ReviewView, ...]]:
    try:
        history = review_repository.review_history(session, report_id)
    except ReportNotFound as error:
        raise HTTPException(404) from error
    return Envelope(data=history)
