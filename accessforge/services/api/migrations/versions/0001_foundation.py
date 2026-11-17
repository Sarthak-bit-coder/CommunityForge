"""Initial locations, barriers and evidence provenance; PostGIS remains on downgrade."""

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geometry

revision = "0001_foundation"
down_revision = None
branch_labels = None
depends_on = None


BARRIER_TYPE = sa.Enum(
    "missing_curb_ramp",
    "surface_problem",
    "obstruction",
    "no_sidewalk",
    "steep_slope",
    name="barrier_type",
    native_enum=False,
    create_constraint=True,
)

VERIFICATION_STATUS = sa.Enum(
    "unverified",
    "confirmed",
    "rejected",
    "repair_planned",
    "repair_completed",
    "resolved",
    name="verification_status",
    native_enum=False,
    create_constraint=True,
)

EVIDENCE_SOURCE = sa.Enum(
    "community_report",
    "city_record",
    "field_verification",
    name="evidence_source",
    native_enum=False,
    create_constraint=True,
)


def _create_locations() -> None:
    op.create_table(
        "location",
        sa.Column(
            "id",
            sa.Uuid(),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "geom", Geometry("POINT", srid=4326, spatial_index=False), nullable=False
        ),
        sa.CheckConstraint(
            "NOT ST_IsEmpty(geom) AND ST_X(geom) BETWEEN -180 AND 180 AND ST_Y(geom) BETWEEN -90 AND 90",
            name="ck_location_coordinates",
        ),
    )
    op.create_index("idx_location_geom", "location", ["geom"], postgresql_using="gist")


def _create_barriers() -> None:
    op.create_table(
        "barrier",
        sa.Column(
            "id",
            sa.Uuid(),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "location_id",
            sa.Uuid(),
            sa.ForeignKey("location.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "type",
            BARRIER_TYPE,
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("severity", sa.SmallInteger(), nullable=False),
        sa.Column(
            "state",
            VERIFICATION_STATUS,
            nullable=False,
            server_default=sa.text("'unverified'"),
        ),
        sa.Column("presence_prob", sa.Float(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("severity BETWEEN 1 AND 5", name="ck_barrier_severity"),
        sa.CheckConstraint(
            "presence_prob BETWEEN 0 AND 1", name="ck_barrier_probability"
        ),
        sa.CheckConstraint(
            "char_length(description) BETWEEN 1 AND 2000 AND description ~ '[^[:space:]]'",
            name="ck_barrier_description",
        ),
    )
    op.create_index("ix_barrier_location_id", "barrier", ["location_id"])


def _create_evidence() -> None:
    op.create_table(
        "evidence_provenance",
        sa.Column(
            "id",
            sa.Uuid(),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "barrier_id",
            sa.Uuid(),
            sa.ForeignKey("barrier.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "source",
            EVIDENCE_SOURCE,
            nullable=False,
        ),
        sa.Column("source_ref", sa.String(500), nullable=False),
        sa.Column("source_version", sa.String(100), nullable=True),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "length(btrim(source_ref)) > 0", name="ck_evidence_source_ref"
        ),
        sa.CheckConstraint(
            "source_version IS NULL OR length(btrim(source_version)) > 0",
            name="ck_evidence_source_version",
        ),
    )
    op.create_index(
        "ix_evidence_provenance_barrier_id", "evidence_provenance", ["barrier_id"]
    )


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    _create_locations()
    _create_barriers()
    _create_evidence()


def downgrade() -> None:
    op.drop_table("evidence_provenance")
    op.drop_table("barrier")
    op.drop_table("location")
