"""Anonymous JSON report submission and public retrieval, without photos or auth."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from . import report_repository
from .auth import MaybeReviewer
from .database import get_session
from .report_limits import limit_submission
from .report_schemas import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE,
    MAX_PAGE_SIZE,
    ReportCreate,
    ReportSummary,
    ReportView,
    redact_for_public,
)
from .responses import Envelope
from .schemas import BarrierType, VerificationStatus

router = APIRouter(prefix="/reports", tags=["reports"])
DatabaseSession = Annotated[Session, Depends(get_session)]


@router.post(
    "",
    status_code=201,
    response_model=Envelope[ReportView],
    dependencies=[Depends(limit_submission)],
)
def submit_report(
    payload: ReportCreate, session: DatabaseSession, response: Response
) -> Envelope[ReportView]:
    report = report_repository.create_report(session, payload)
    response.headers["Location"] = f"/reports/{report.id}"
    return Envelope(data=report)


def _visible(
    report: ReportView, reviewer: UUID | None, response: Response
) -> ReportView:
    if reviewer is None:
        return redact_for_public(report)
    # Reviewer responses carry unmoderated text; keep them out of shared caches.
    response.headers["Cache-Control"] = "private, no-store"
    return report


@router.get("", response_model=Envelope[tuple[ReportView, ...]])
def get_reports(
    session: DatabaseSession,
    reviewer: MaybeReviewer,
    response: Response,
    page: Annotated[int, Query(ge=1, le=MAX_PAGE)] = 1,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
    barrier_type: Annotated[BarrierType | None, Query(alias="type")] = None,
    state: VerificationStatus | None = None,
) -> Envelope[tuple[ReportView, ...]]:
    reports, total = report_repository.list_reports(
        session, page=page, limit=limit, barrier_type=barrier_type, state=state
    )
    visible = tuple(_visible(report, reviewer, response) for report in reports)
    return Envelope(data=visible, meta={"page": page, "limit": limit, "total": total})


# Declared before /{report_id} so "summary" is never parsed as a report ID.
@router.get("/summary", response_model=Envelope[ReportSummary])
def get_summary(session: DatabaseSession) -> Envelope[ReportSummary]:
    return Envelope(data=report_repository.summarize_reports(session))


@router.get("/{report_id}", response_model=Envelope[ReportView])
def get_report(
    report_id: UUID,
    session: DatabaseSession,
    reviewer: MaybeReviewer,
    response: Response,
) -> Envelope[ReportView]:
    report = report_repository.get_report(session, report_id)
    if report is None:
        raise HTTPException(404)
    return Envelope(data=_visible(report, reviewer, response))
