"""Pilot-area network, destinations and origins, each row tied to a catalogued data source."""

from datetime import datetime
from uuid import UUID

from geoalchemy2 import Geometry, WKBElement
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base
from .schemas import SOURCE_REFERENCE_MAX_LENGTH, SOURCE_VERSION_MAX_LENGTH

SOURCE_ID_MAX_LENGTH = 64
CATEGORY_MAX_LENGTH = 32
BLOCK_GEOID_LENGTH = 15
NODE_KINDS = ("junction", "curb_ramp")
EDGE_KINDS = ("sidewalk", "crossing", "footway", "steps", "street")
DESTINATION_CATEGORIES = (
    "grocery",
    "healthcare",
    "transit",
    "education",
    "civic",
    "park",
)


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


def _uuid_pk() -> Mapped[UUID]:
    return mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )


def _source_fk() -> Mapped[str]:
    return mapped_column(
        ForeignKey("data_source.id", ondelete="RESTRICT"), nullable=False, index=True
    )


class DataSource(Base):
    """One row per loaded dataset: what it is, its license, and when it was fetched."""

    __tablename__ = "data_source"

    id: Mapped[str] = mapped_column(String(SOURCE_ID_MAX_LENGTH), primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    license: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[str] = mapped_column(
        String(SOURCE_VERSION_MAX_LENGTH), nullable=False
    )
    retrieved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )


class NetworkNode(Base):
    __tablename__ = "network_node"
    __table_args__ = (
        UniqueConstraint("source_id", "source_ref", name="uq_network_node_source_ref"),
        CheckConstraint(_in("kind", NODE_KINDS), name="ck_network_node_kind"),
    )

    id: Mapped[UUID] = _uuid_pk()
    geom: Mapped[WKBElement] = mapped_column(
        Geometry("POINT", srid=4326, spatial_index=True), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    source_id: Mapped[str] = _source_fk()
    source_ref: Mapped[str] = mapped_column(
        String(SOURCE_REFERENCE_MAX_LENGTH), nullable=False
    )


class NetworkEdge(Base):
    __tablename__ = "network_edge"
    __table_args__ = (
        UniqueConstraint("source_id", "source_ref", name="uq_network_edge_source_ref"),
        CheckConstraint(_in("kind", EDGE_KINDS), name="ck_network_edge_kind"),
        CheckConstraint("length_m > 0", name="ck_network_edge_length"),
        CheckConstraint("from_node <> to_node", name="ck_network_edge_not_loop"),
    )

    id: Mapped[UUID] = _uuid_pk()
    from_node: Mapped[UUID] = mapped_column(
        ForeignKey("network_node.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    to_node: Mapped[UUID] = mapped_column(
        ForeignKey("network_node.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    geom: Mapped[WKBElement] = mapped_column(
        Geometry("LINESTRING", srid=4326, spatial_index=True), nullable=False
    )
    length_m: Mapped[float] = mapped_column(Float, nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    surface: Mapped[str | None] = mapped_column(String(CATEGORY_MAX_LENGTH))
    source_id: Mapped[str] = _source_fk()
    source_ref: Mapped[str] = mapped_column(
        String(SOURCE_REFERENCE_MAX_LENGTH), nullable=False
    )


class Destination(Base):
    __tablename__ = "destination"
    __table_args__ = (
        UniqueConstraint("source_id", "source_ref", name="uq_destination_source_ref"),
        CheckConstraint(
            _in("category", DESTINATION_CATEGORIES), name="ck_destination_category"
        ),
        CheckConstraint("weight > 0", name="ck_destination_weight"),
    )

    id: Mapped[UUID] = _uuid_pk()
    geom: Mapped[WKBElement] = mapped_column(
        Geometry("POINT", srid=4326, spatial_index=True), nullable=False
    )
    category: Mapped[str] = mapped_column(String(CATEGORY_MAX_LENGTH), nullable=False)
    name: Mapped[str | None] = mapped_column(Text)
    weight: Mapped[float] = mapped_column(
        Float, nullable=False, server_default=text("1.0")
    )
    node_id: Mapped[UUID] = mapped_column(
        ForeignKey("network_node.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    source_id: Mapped[str] = _source_fk()
    source_ref: Mapped[str] = mapped_column(
        String(SOURCE_REFERENCE_MAX_LENGTH), nullable=False
    )


class Origin(Base):
    """A 2020 census block; disability_rate is a modeled tract-level adult estimate."""

    __tablename__ = "origin"
    __table_args__ = (
        CheckConstraint("population > 0", name="ck_origin_population"),
        CheckConstraint(
            "disability_rate IS NULL OR disability_rate BETWEEN 0 AND 1",
            name="ck_origin_disability_rate",
        ),
        CheckConstraint(
            "(disability_rate IS NULL) = (disability_source_id IS NULL)",
            name="ck_origin_disability_source",
        ),
    )

    id: Mapped[str] = mapped_column(String(BLOCK_GEOID_LENGTH), primary_key=True)
    geom: Mapped[WKBElement] = mapped_column(
        Geometry("POINT", srid=4326, spatial_index=True), nullable=False
    )
    population: Mapped[int] = mapped_column(Integer, nullable=False)
    disability_rate: Mapped[float | None] = mapped_column(Float)
    node_id: Mapped[UUID] = mapped_column(
        ForeignKey("network_node.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    source_id: Mapped[str] = _source_fk()
    disability_source_id: Mapped[str | None] = mapped_column(
        ForeignKey("data_source.id", ondelete="RESTRICT"), index=True
    )
