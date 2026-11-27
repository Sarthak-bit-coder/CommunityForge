"""Public report contracts; verification and evidence source are server-owned."""

from typing import Annotated
from uuid import UUID

from pydantic import AwareDatetime, Field

from .schemas import (
    DESCRIPTION_MAX_LENGTH,
    BarrierType,
    EvidenceSource,
    FrozenInput,
    LocationInput,
    VerificationStatus,
)

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
MAX_PAGE = 10_000


class ReportCreate(FrozenInput):
    type: BarrierType
    description: Annotated[str, Field(min_length=1, max_length=DESCRIPTION_MAX_LENGTH)]
    location: LocationInput
    severity: Annotated[int, Field(ge=1, le=5, strict=True)]


class EvidenceView(FrozenInput):
    source: EvidenceSource
    source_ref: str
    source_version: str | None
    observed_at: AwareDatetime
    recorded_at: AwareDatetime


# Free text is public only after a reviewer confirms it; see redact_for_public.
PUBLIC_TEXT_STATES = frozenset(
    {
        VerificationStatus.confirmed,
        VerificationStatus.repair_planned,
        VerificationStatus.repair_completed,
        VerificationStatus.resolved,
    }
)


class ReportView(FrozenInput):
    id: UUID
    barrier_id: UUID
    type: BarrierType
    # None means hidden from the public until a reviewer confirms the report.
    description: str | None
    location: LocationInput
    severity: int
    state: VerificationStatus
    created_at: AwareDatetime
    evidence: tuple[EvidenceView, ...]


class ReportSummary(FrozenInput):
    """Aggregate counts only; no report text, location, or identity."""

    total: int
    by_state: dict[VerificationStatus, int]
    by_type: dict[BarrierType, int]
    first_report_at: AwareDatetime | None
    last_report_at: AwareDatetime | None


def redact_for_public(report: ReportView) -> ReportView:
    if report.state in PUBLIC_TEXT_STATES:
        return report
    return report.model_copy(update={"description": None})
