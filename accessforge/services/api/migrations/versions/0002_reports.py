"""Add original report records without altering foundation tables or existing rows."""

import sqlalchemy as sa
from alembic import op

revision = "0002_reports"
down_revision = "0001_foundation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "report",
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
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "char_length(description) BETWEEN 1 AND 2000 AND description ~ '[^[:space:]]'",
            name="ck_report_description",
        ),
    )
    op.create_index("ix_report_barrier_id", "report", ["barrier_id"])
    op.create_index("ix_report_created_at_id", "report", ["created_at", "id"])


def downgrade() -> None:
    # Submitted barrier/location/provenance records deliberately survive this downgrade.
    op.drop_table("report")
