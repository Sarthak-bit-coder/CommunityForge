"""Add private append-only review audit; preserve existing report/state contracts."""

import sqlalchemy as sa
from alembic import op

revision = "0003_report_reviews"
down_revision = "0002_reports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "report_review",
        sa.Column(
            "id",
            sa.Uuid(),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "report_id",
            sa.Uuid(),
            sa.ForeignKey("report.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("reviewer_id", sa.Uuid(), nullable=False),
        sa.Column("from_state", sa.String(16), nullable=False),
        sa.Column("to_state", sa.String(16), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "reviewed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.clock_timestamp(),
        ),
        sa.CheckConstraint("from_state = 'unverified'", name="ck_review_from_state"),
        sa.CheckConstraint(
            "to_state IN ('confirmed', 'rejected')", name="ck_review_to_state"
        ),
        sa.CheckConstraint(
            "char_length(reason) BETWEEN 1 AND 2000 AND reason ~ '[^[:space:]]'",
            name="ck_review_reason",
        ),
    )
    op.create_index("ix_report_review_report_id", "report_review", ["report_id"])
    # A statement trigger also blocks TRUNCATE and zero-row modifications.
    op.execute("""
        CREATE FUNCTION reject_report_review_mutation() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
            RAISE EXCEPTION 'report review audit is append-only';
        END; $$
    """)
    op.execute("""
        CREATE TRIGGER report_review_append_only
        BEFORE UPDATE OR DELETE OR TRUNCATE ON report_review
        FOR EACH STATEMENT EXECUTE FUNCTION reject_report_review_mutation()
    """)


def downgrade() -> None:
    op.drop_table("report_review")
    op.execute("DROP FUNCTION reject_report_review_mutation()")
