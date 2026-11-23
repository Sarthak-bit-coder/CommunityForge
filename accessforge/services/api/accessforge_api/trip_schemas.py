"""Public trip inputs and projections; no free text or participant identity."""

from datetime import date, datetime
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import Field, model_validator

from .schemas import FrozenInput

Purpose = Literal[
    "essential_services",
    "public_transit",
    "education",
    "recreation",
    "community_access",
]
LandmarkKey = Annotated[
    str, Field(max_length=64, pattern=r"^osm:(node|way|relation)/[1-9][0-9]*$")
]


class Nomination(FrozenInput):
    start_key: LandmarkKey
    end_key: LandmarkKey
    purpose: Purpose
    source: Literal["online", "field"] = "online"

    @model_validator(mode="after")
    def distinct_ends(self) -> Self:
        if self.start_key == self.end_key:
            raise ValueError("Choose two different landmarks.")
        return self


class Landmark(FrozenInput):
    key: str
    name: str


class TripReceipt(FrozenInput):
    id: UUID


class TripSummary(TripReceipt):
    start_name: str
    end_name: str
    purpose: Purpose
    field_nominated: bool
    supports: int


class TripCatalog(FrozenInput):
    landmarks: tuple[Landmark, ...]
    trips: tuple[TripSummary, ...]


class PublicEvent(FrozenInput):
    kind: str
    observed_on: date
    recorded_at: datetime
    reference: str | None
    report_id: UUID | None


class ModeledCrossing(FrozenInput):
    node_id: str
    barrier_ids: tuple[str, ...]
    alone_reachable: bool
    location: str


class TripAnalysis(FrozenInput):
    baseline_reachable: bool
    combined_reachable: bool
    length_m: float | None
    edge_ids: tuple[str, ...]
    crossings: tuple[ModeledCrossing, ...]
    coverage_gap_edge_ids: tuple[str, ...]
    attribution: tuple[str, ...]
    coverage_note: str


class TripDetail(TripSummary):
    start_key: str
    end_key: str
    created_at: datetime
    events: tuple[PublicEvent, ...]
    analysis: TripAnalysis | None
