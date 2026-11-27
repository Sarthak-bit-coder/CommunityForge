"""Allow repair lifecycle steps in the append-only review audit.

Replaces the two pending-only checks from 0003 with one check on the exact
(from_state, to_state) pairs in PRODUCT_REQUIREMENTS §7. The pairs are frozen
here on purpose; migrations never import application code.
"""

from alembic import op

revision = "0007_repair_tracking"
down_revision = "0006_community_trips"
branch_labels = None
depends_on = None

TRANSITION_CHECK = (
    "(from_state, to_state) IN ("
    "('unverified', 'confirmed'), "
    "('unverified', 'rejected'), "
    "('confirmed', 'repair_planned'), "
    "('repair_planned', 'repair_completed'), "
    "('repair_completed', 'resolved'))"
)


def upgrade() -> None:
    op.drop_constraint("ck_review_from_state", "report_review", type_="check")
    op.drop_constraint("ck_review_to_state", "report_review", type_="check")
    op.create_check_constraint(
        "ck_review_transition", "report_review", TRANSITION_CHECK
    )


def downgrade() -> None:
    # The audit is append-only, so repair rows cannot be deleted to make room
    # for the narrower 0003 checks. Refuse with a clear message instead.
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM report_review WHERE from_state <> 'unverified') THEN
                RAISE EXCEPTION 'cannot downgrade: report_review holds repair lifecycle rows';
            END IF;
        END $$
    """)
    op.drop_constraint("ck_review_transition", "report_review", type_="check")
    op.create_check_constraint(
        "ck_review_from_state", "report_review", "from_state = 'unverified'"
    )
    op.create_check_constraint(
        "ck_review_to_state", "report_review", "to_state IN ('confirmed', 'rejected')"
    )
