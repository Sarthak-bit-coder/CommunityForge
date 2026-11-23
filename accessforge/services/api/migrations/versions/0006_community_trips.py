"""Add trip nominations, anonymous support and append-only field evidence."""
from alembic import op

revision = "0006_community_trips"
down_revision = "0005_feedback"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""CREATE TABLE community_trip (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), start_key text NOT NULL,
        end_key text NOT NULL CHECK (end_key <> start_key),
        start_name text NOT NULL, end_name text NOT NULL,
        purpose varchar(32) NOT NULL CHECK (purpose IN
        ('essential_services','public_transit','education','recreation','community_access')),
        field_nominated boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(start_key,end_key,purpose))""")
    op.execute("""CREATE TABLE trip_support (
        trip_id uuid REFERENCES community_trip(id), token_hash varchar(64),
        PRIMARY KEY(trip_id,token_hash))""")
    op.execute("""CREATE TABLE trip_event (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), trip_id uuid NOT NULL REFERENCES community_trip(id),
        kind varchar(32) NOT NULL CHECK (kind IN ('field_obstructed','field_clear','city_repair_record','report_linked')),
        observed_on date NOT NULL, reference text, report_id uuid REFERENCES report(id),
        reviewer_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        CHECK ((kind='city_repair_record') = (reference IS NOT NULL)),
        CHECK ((kind='report_linked') = (report_id IS NOT NULL)))""")
    op.create_index("ix_trip_event_trip_id","trip_event",["trip_id"])
    op.execute("""CREATE FUNCTION protect_trip_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Trip evidence is append-only'; END $$""")
    op.execute("""CREATE TRIGGER immutable_trip_evidence BEFORE UPDATE OR DELETE OR TRUNCATE
        ON trip_event FOR EACH STATEMENT EXECUTE FUNCTION protect_trip_evidence()""")


def downgrade() -> None:
    op.drop_table("trip_event")
    op.execute("DROP FUNCTION protect_trip_evidence()")
    op.drop_table("trip_support")
    op.drop_table("community_trip")
