"""Shared validated domain inputs; report contracts live in report_schemas."""

from enum import Enum
from typing import Annotated
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

DESCRIPTION_MAX_LENGTH = 2000
SOURCE_REFERENCE_MAX_LENGTH = 500
SOURCE_VERSION_MAX_LENGTH = 100


class BarrierType(str, Enum):
    missing_curb_ramp = "missing_curb_ramp"
    surface_problem = "surface_problem"
    obstruction = "obstruction"
    no_sidewalk = "no_sidewalk"
    steep_slope = "steep_slope"


class VerificationStatus(str, Enum):
    unverified = "unverified"
    confirmed = "confirmed"
    rejected = "rejected"
    repair_planned = "repair_planned"
    repair_completed = "repair_completed"
    resolved = "resolved"


class EvidenceSource(str, Enum):
    community_report = "community_report"
    city_record = "city_record"
    field_verification = "field_verification"
    open_map_data = "open_map_data"


class FrozenInput(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_strip_whitespace=True,
        hide_input_in_errors=True,
    )


class LocationInput(FrozenInput):
    longitude: Annotated[
        float, Field(ge=-180, le=180, allow_inf_nan=False, strict=True)
    ]
    latitude: Annotated[float, Field(ge=-90, le=90, allow_inf_nan=False, strict=True)]


class BarrierInput(FrozenInput):
    location_id: UUID
    type: BarrierType
    description: Annotated[str, Field(min_length=1, max_length=DESCRIPTION_MAX_LENGTH)]
    severity: Annotated[int, Field(ge=1, le=5, strict=True)]
    state: VerificationStatus = VerificationStatus.unverified
    presence_prob: Annotated[float, Field(ge=0, le=1, allow_inf_nan=False, strict=True)]


class EvidenceInput(FrozenInput):
    barrier_id: UUID
    source: EvidenceSource
    source_ref: Annotated[
        str, Field(min_length=1, max_length=SOURCE_REFERENCE_MAX_LENGTH)
    ]
    source_version: (
        Annotated[str, Field(min_length=1, max_length=SOURCE_VERSION_MAX_LENGTH)] | None
    ) = None
    observed_at: AwareDatetime
