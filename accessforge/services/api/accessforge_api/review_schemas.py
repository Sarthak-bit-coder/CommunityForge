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
    repair_planned = "repair_planned"
    repair_completed = "repair_completed"
    resolved = "resolved"


# The only allowed lifecycle steps (PRODUCT_REQUIREMENTS §7). Migration
# 0007_repair_tracking enforces the same (from_state, to_state) pairs in the database.
REVIEW_TRANSITIONS: dict[
    tuple[VerificationStatus, ReviewStatus], VerificationStatus
] = {
    (
        VerificationStatus.unverified,
        ReviewStatus.verified,
    ): VerificationStatus.confirmed,
    (VerificationStatus.unverified, ReviewStatus.rejected): VerificationStatus.rejected,
    (
        VerificationStatus.confirmed,
        ReviewStatus.repair_planned,
    ): VerificationStatus.repair_planned,
    (
        VerificationStatus.repair_planned,
        ReviewStatus.repair_completed,
    ): VerificationStatus.repair_completed,
    (
        VerificationStatus.repair_completed,
        ReviewStatus.resolved,
    ): VerificationStatus.resolved,
}


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
    """The decision is not an allowed next step from the barrier's current state."""


class ReportNotFound(LookupError):
    """The report does not exist."""


def review_transition(
    current: VerificationStatus, decision: ReviewStatus
) -> VerificationStatus:
    target = REVIEW_TRANSITIONS.get((current, decision))
    if target is None:
        raise ReviewConflict(
            f"A report in state '{current.value}' cannot move to '{decision.value}'."
        )
    return target
