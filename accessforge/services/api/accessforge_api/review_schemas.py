"""Internal review contracts; no client-supplied identity is trusted by HTTP."""

from enum import Enum
from typing import Annotated
from uuid import UUID

from pydantic import AwareDatetime, Field

from .schemas import DESCRIPTION_MAX_LENGTH, FrozenInput, VerificationStatus


class ReviewStatus(str, Enum):
    pending = "pending"
    verified = "verified"
    rejected = "rejected"


class ReviewInput(FrozenInput):
    status: ReviewStatus
    reason: Annotated[str, Field(min_length=1, max_length=DESCRIPTION_MAX_LENGTH)]


class ReviewView(FrozenInput):
    id: UUID
    report_id: UUID
    reviewer_id: UUID
    from_state: VerificationStatus
    to_state: VerificationStatus
    reason: str
    reviewed_at: AwareDatetime


class ReviewConflict(ValueError):
    """This report's barrier is no longer pending, or the decision is invalid."""


class ReportNotFound(LookupError):
    """The report does not exist."""


def review_transition(
    current: VerificationStatus, decision: ReviewStatus
) -> VerificationStatus:
    if current != VerificationStatus.unverified or decision == ReviewStatus.pending:
        raise ReviewConflict("Only pending reports may be verified or rejected.")
    return (
        VerificationStatus.confirmed
        if decision == ReviewStatus.verified
        else VerificationStatus.rejected
    )
