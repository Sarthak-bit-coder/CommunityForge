"""Add anonymous site feedback; no identity or client columns by design."""

import sqlalchemy as sa
from alembic import op

revision = "0005_feedback"
down_revision = "0004_network"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "feedback",
        sa.Column(
            "id",
            sa.Uuid(),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("topic", sa.String(16), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.clock_timestamp(),
        ),
        sa.CheckConstraint(
            "topic IN ('usability', 'accessibility', 'data', 'other')",
            name="ck_feedback_topic",
        ),
        sa.CheckConstraint(
            "char_length(message) BETWEEN 1 AND 2000 AND message ~ '[^[:space:]]'",
            name="ck_feedback_message",
        ),
    )


def downgrade() -> None:
    op.drop_table("feedback")
