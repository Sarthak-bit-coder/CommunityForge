"""PostGIS storage with matching database constraints and explicit provenance."""

from datetime import datetime
from uuid import UUID

from geoalchemy2 import Geometry, WKBElement
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base
from .review_schemas import REVIEW_TRANSITIONS
from .schemas import (
    DESCRIPTION_MAX_LENGTH,
    SOURCE_REFERENCE_MAX_LENGTH,
    SOURCE_VERSION_MAX_LENGTH,
    BarrierType,
    EvidenceSource,
    VerificationStatus,
)


class Location(Base):
    __tablename__ = "location"
    __table_args__ = (
        CheckConstraint(
            "NOT ST_IsEmpty(geom) AND ST_X(geom) BETWEEN -180 AND 180 AND ST_Y(geom) BETWEEN -90 AND 90",
            name="ck_location_coordinates",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    geom: Mapped[WKBElement] = mapped_column(
        Geometry("POINT", srid=4326, spatial_index=True), nullable=False
    )


class Barrier(Base):
    __tablename__ = "barrier"
    __table_args__ = (
        CheckConstraint("severity BETWEEN 1 AND 5", name="ck_barrier_severity"),
        CheckConstraint("presence_prob BETWEEN 0 AND 1", name="ck_barrier_probability"),
        CheckConstraint(
            f"char_length(description) BETWEEN 1 AND {DESCRIPTION_MAX_LENGTH} AND description ~ '[^[:space:]]'",
            name="ck_barrier_description",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    location_id: Mapped[UUID] = mapped_column(
        ForeignKey("location.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    type: Mapped[BarrierType] = mapped_column(
        Enum(
            BarrierType,
            name="barrier_type",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
        ),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    state: Mapped[VerificationStatus] = mapped_column(
        Enum(
            VerificationStatus,
            name="verification_status",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
        ),
        nullable=False,
        server_default=text("'unverified'"),
    )
    presence_prob: Mapped[float] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class EvidenceProvenance(Base):
    __tablename__ = "evidence_provenance"
    __table_args__ = (
        CheckConstraint("length(btrim(source_ref)) > 0", name="ck_evidence_source_ref"),
        CheckConstraint(
            "source_version IS NULL OR length(btrim(source_version)) > 0",
            name="ck_evidence_source_version",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    barrier_id: Mapped[UUID] = mapped_column(
        ForeignKey("barrier.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    source: Mapped[EvidenceSource] = mapped_column(
        Enum(
            EvidenceSource,
            name="evidence_source",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
        ),
        nullable=False,
    )
    source_ref: Mapped[str] = mapped_column(
        String(SOURCE_REFERENCE_MAX_LENGTH), nullable=False
    )
    source_version: Mapped[str | None] = mapped_column(
        String(SOURCE_VERSION_MAX_LENGTH)
    )
    observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Report(Base):
    """Original submission text is preserved separately from the barrier description."""

    __tablename__ = "report"
    __table_args__ = (
        Index("ix_report_created_at_id", "created_at", "id"),
        CheckConstraint(
            f"char_length(description) BETWEEN 1 AND {DESCRIPTION_MAX_LENGTH} AND description ~ '[^[:space:]]'",
            name="ck_report_description",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    barrier_id: Mapped[UUID] = mapped_column(
        ForeignKey("barrier.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


REVIEW_TRANSITION_SQL = "(from_state, to_state) IN ({})".format(
    ", ".join(
        f"('{current.value}', '{target.value}')"
        for (current, _), target in REVIEW_TRANSITIONS.items()
    )
)


class ReportReview(Base):
    """Private reviewer identity and reason; database-enforced append-only audit."""

    __tablename__ = "report_review"
    __table_args__ = (
        CheckConstraint(REVIEW_TRANSITION_SQL, name="ck_review_transition"),
        CheckConstraint(
            f"char_length(reason) BETWEEN 1 AND {DESCRIPTION_MAX_LENGTH} AND reason ~ '[^[:space:]]'",
            name="ck_review_reason",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    report_id: Mapped[UUID] = mapped_column(
        ForeignKey("report.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    reviewer_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    from_state: Mapped[str] = mapped_column(String(16), nullable=False)
    to_state: Mapped[str] = mapped_column(String(16), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.clock_timestamp()
    )


class Feedback(Base):
    """Anonymous site feedback: no name, contact, address, or client identifier."""

    __tablename__ = "feedback"
    __table_args__ = (
        CheckConstraint(
            "topic IN ('usability', 'accessibility', 'data', 'other')",
            name="ck_feedback_topic",
        ),
        CheckConstraint(
            f"char_length(message) BETWEEN 1 AND {DESCRIPTION_MAX_LENGTH} AND message ~ '[^[:space:]]'",
            name="ck_feedback_message",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    topic: Mapped[str] = mapped_column(String(16), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.clock_timestamp()
    )


# Register network tables on the shared metadata used by Alembic and drift tests.
from . import network_models  # noqa: F401
