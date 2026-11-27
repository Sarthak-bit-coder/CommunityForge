"""Add catalogued data sources, the pedestrian network, destinations and origins.

Also allows 'open_map_data' evidence so OSM-derived barriers keep honest provenance.
Downgrade fails while any open_map_data evidence exists, rather than losing it.
"""

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geometry

revision = "0004_network"
down_revision = "0003_report_reviews"
branch_labels = None
depends_on = None

OLD_SOURCES = "'community_report', 'city_record', 'field_verification'"
NEW_SOURCES = f"{OLD_SOURCES}, 'open_map_data'"


def _id() -> "sa.Column[object]":
    return sa.Column(
        "id", sa.Uuid(), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )


def _fk(name: str, target: str, nullable: bool = False) -> "sa.Column[object]":
    column_type = sa.String(64) if target == "data_source.id" else sa.Uuid()
    return sa.Column(
        name, column_type, sa.ForeignKey(target, ondelete="RESTRICT"), nullable=nullable
    )


def _geom(kind: str) -> "sa.Column[object]":
    return sa.Column(
        "geom", Geometry(kind, srid=4326, spatial_index=False), nullable=False
    )


def _indexes(table: str, *columns: str) -> None:
    op.create_index(f"idx_{table}_geom", table, ["geom"], postgresql_using="gist")
    for column in columns:
        op.create_index(f"ix_{table}_{column}", table, [column])


def _create_source_and_nodes() -> None:
    op.create_table(
        "data_source",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("license", sa.Text(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("version", sa.String(100), nullable=False),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "network_node",
        _id(),
        _geom("POINT"),
        sa.Column("kind", sa.String(16), nullable=False),
        _fk("source_id", "data_source.id"),
        sa.Column("source_ref", sa.String(500), nullable=False),
        sa.UniqueConstraint(
            "source_id", "source_ref", name="uq_network_node_source_ref"
        ),
        sa.CheckConstraint(
            "kind IN ('junction', 'curb_ramp')", name="ck_network_node_kind"
        ),
    )
    _indexes("network_node", "source_id")


def _create_edges() -> None:
    op.create_table(
        "network_edge",
        _id(),
        _fk("from_node", "network_node.id"),
        _fk("to_node", "network_node.id"),
        _geom("LINESTRING"),
        sa.Column("length_m", sa.Float(), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("surface", sa.String(32), nullable=True),
        _fk("source_id", "data_source.id"),
        sa.Column("source_ref", sa.String(500), nullable=False),
        sa.UniqueConstraint(
            "source_id", "source_ref", name="uq_network_edge_source_ref"
        ),
        sa.CheckConstraint(
            "kind IN ('sidewalk', 'crossing', 'footway', 'steps', 'street')",
            name="ck_network_edge_kind",
        ),
        sa.CheckConstraint("length_m > 0", name="ck_network_edge_length"),
        sa.CheckConstraint("from_node <> to_node", name="ck_network_edge_not_loop"),
    )
    _indexes("network_edge", "from_node", "to_node", "source_id")


def _create_destinations_and_origins() -> None:
    op.create_table(
        "destination",
        _id(),
        _geom("POINT"),
        sa.Column("category", sa.String(32), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("weight", sa.Float(), nullable=False, server_default=sa.text("1.0")),
        _fk("node_id", "network_node.id"),
        _fk("source_id", "data_source.id"),
        sa.Column("source_ref", sa.String(500), nullable=False),
        sa.UniqueConstraint(
            "source_id", "source_ref", name="uq_destination_source_ref"
        ),
        sa.CheckConstraint(
            "category IN ('grocery', 'healthcare', 'transit', 'education', 'civic', 'park')",
            name="ck_destination_category",
        ),
        sa.CheckConstraint("weight > 0", name="ck_destination_weight"),
    )
    _indexes("destination", "node_id", "source_id")
    op.create_table(
        "origin",
        sa.Column("id", sa.String(15), primary_key=True),
        _geom("POINT"),
        sa.Column("population", sa.Integer(), nullable=False),
        sa.Column("disability_rate", sa.Float(), nullable=True),
        _fk("node_id", "network_node.id"),
        _fk("source_id", "data_source.id"),
        _fk("disability_source_id", "data_source.id", nullable=True),
        sa.CheckConstraint("population > 0", name="ck_origin_population"),
        sa.CheckConstraint(
            "disability_rate IS NULL OR disability_rate BETWEEN 0 AND 1",
            name="ck_origin_disability_rate",
        ),
        sa.CheckConstraint(
            "(disability_rate IS NULL) = (disability_source_id IS NULL)",
            name="ck_origin_disability_source",
        ),
    )
    _indexes("origin", "node_id", "source_id", "disability_source_id")


def _set_evidence_sources(values: str) -> None:
    op.drop_constraint("evidence_source", "evidence_provenance", type_="check")
    op.create_check_constraint(
        "evidence_source", "evidence_provenance", f"source IN ({values})"
    )


def upgrade() -> None:
    _create_source_and_nodes()
    _create_edges()
    _create_destinations_and_origins()
    _set_evidence_sources(NEW_SOURCES)


def downgrade() -> None:
    _set_evidence_sources(OLD_SOURCES)
    for table in (
        "origin",
        "destination",
        "network_edge",
        "network_node",
        "data_source",
    ):
        op.drop_table(table)
