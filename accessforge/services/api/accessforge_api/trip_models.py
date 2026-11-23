"""Public trip nominations retain source keys across replacement network imports."""

from datetime import date, datetime
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class CommunityTrip(Base):
    __tablename__ = "community_trip"
    __table_args__ = (
        UniqueConstraint("start_key", "end_key", "purpose"),
        CheckConstraint("start_key <> end_key"),
        CheckConstraint(
            "purpose IN ('essential_services','public_transit','education','recreation','community_access')"
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    start_key: Mapped[str] = mapped_column(Text)
    end_key: Mapped[str] = mapped_column(Text)
    start_name: Mapped[str] = mapped_column(Text)
    end_name: Mapped[str] = mapped_column(Text)
    purpose: Mapped[str] = mapped_column(String(32))
    field_nominated: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class TripSupport(Base):
    __tablename__ = "trip_support"

    trip_id: Mapped[UUID] = mapped_column(
        ForeignKey("community_trip.id"), primary_key=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)


class TripEvent(Base):
    __tablename__ = "trip_event"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('field_obstructed','field_clear','city_repair_record','report_linked')"
        ),
        CheckConstraint("(kind = 'city_repair_record') = (reference IS NOT NULL)"),
        CheckConstraint("(kind = 'report_linked') = (report_id IS NOT NULL)"),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    trip_id: Mapped[UUID] = mapped_column(ForeignKey("community_trip.id"), index=True)
    kind: Mapped[str] = mapped_column(String(32))
    observed_on: Mapped[date] = mapped_column(Date)
    reference: Mapped[str | None] = mapped_column(Text)
    report_id: Mapped[UUID | None] = mapped_column(ForeignKey("report.id"))
    reviewer_id: Mapped[UUID] = mapped_column(Uuid)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.clock_timestamp()
    )
