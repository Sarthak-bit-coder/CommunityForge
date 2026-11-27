"""Trusted in-process operations only; never mount without staff authentication."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Barrier, Report, ReportReview
from .review_schemas import ReportNotFound, ReviewInput, ReviewView, review_transition


def _view(record: ReportReview) -> ReviewView:
    return ReviewView.model_validate(record, from_attributes=True)


def review_report(
    session: Session, report_id: UUID, payload: ReviewInput, *, reviewer_id: UUID
) -> ReviewView:
    """Caller must establish a trusted verifier/admin identity before invoking this."""
    if not isinstance(reviewer_id, UUID):
        raise TypeError("A trusted reviewer UUID is required.")
    with session.begin():
        # Lock the shared barrier so even reports referring to one barrier serialize.
        barrier = session.scalar(
            select(Barrier)
            .join(Report, Report.barrier_id == Barrier.id)
            .where(Report.id == report_id)
            .with_for_update(of=Barrier)
            .execution_options(populate_existing=True)
        )
        if barrier is None:
            raise ReportNotFound("Report not found.")
        target = review_transition(barrier.state, payload.status)
        audit = ReportReview(
            report_id=report_id,
            reviewer_id=reviewer_id,
            from_state=barrier.state.value,
            to_state=target.value,
            reason=payload.reason,
        )
        barrier.state = target
        session.add(audit)
        session.flush()
        result = _view(audit)
    return result


def review_history(session: Session, report_id: UUID) -> tuple[ReviewView, ...]:
    """Private audit read; reviewer identities/reasons are not added to public DTOs."""
    if session.get(Report, report_id) is None:
        raise ReportNotFound("Report not found.")
    return tuple(
        _view(record)
        for record in session.scalars(
            select(ReportReview)
            .where(ReportReview.report_id == report_id)
            .order_by(ReportReview.reviewed_at, ReportReview.id)
        )
    )
