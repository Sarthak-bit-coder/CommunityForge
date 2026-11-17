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


class ReportView(FrozenInput):
    id: UUID
    barrier_id: UUID
    type: BarrierType
    description: str
    location: LocationInput
    severity: int
    state: VerificationStatus
    created_at: AwareDatetime
    evidence: tuple[EvidenceView, ...]
