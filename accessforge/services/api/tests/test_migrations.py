from io import StringIO

import pytest
from alembic import command
from alembic.config import Config
from conftest import UNIT_DATABASE_URL

from accessforge_api.models import Barrier, EvidenceProvenance, Location, Report


def test_offline_migration_contains_spatial_constraints_and_safe_rollback(
    migration_config: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("DATABASE_URL", UNIT_DATABASE_URL)
    output = StringIO()
    migration_config.output_buffer = output
    command.upgrade(migration_config, "head", sql=True)
    sql = output.getvalue()
    assert "CREATE EXTENSION IF NOT EXISTS postgis" in sql
    assert "geometry(POINT,4326)" in sql
    assert "USING gist" in sql
    assert "ck_barrier_probability" in sql
    assert "verification_status" in sql
    assert "FOREIGN KEY" in sql
    assert "CREATE TABLE report" in sql
    assert "ck_report_description" in sql
    assert "ix_report_created_at_id" in sql
    assert "CREATE TABLE report_review" in sql
    assert "BEFORE UPDATE OR DELETE OR TRUNCATE" in sql
    output.seek(0)
    output.truncate()
    command.downgrade(migration_config, "0003_report_reviews:base", sql=True)
    rollback = output.getvalue()
    assert (
        rollback.index("DROP TABLE report_review")
        < rollback.index("DROP TABLE report;")
        < rollback.index("DROP TABLE evidence_provenance")
        < rollback.index("DROP TABLE barrier")
        < rollback.index("DROP TABLE location")
    )
    assert "DROP EXTENSION" not in rollback


def test_schema_has_required_foreign_keys_and_no_reporter_identity_fields() -> None:
    assert Location.__table__.c.geom.type.srid == 4326
    assert len(Barrier.__table__.foreign_keys) == 1
    assert len(EvidenceProvenance.__table__.foreign_keys) == 1
    assert len(Report.__table__.foreign_keys) == 1
    for table in (
        Location.__table__,
        Barrier.__table__,
        EvidenceProvenance.__table__,
        Report.__table__,
    ):
        assert not {"reporter_name", "reporter_email", "disability", "photo"} & set(
            table.c.keys()
        )


def test_report_only_downgrade_preserves_foundation(
    migration_config: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("DATABASE_URL", UNIT_DATABASE_URL)
    output = StringIO()
    migration_config.output_buffer = output
    command.downgrade(migration_config, "0002_reports:0001_foundation", sql=True)
    sql = output.getvalue()
    assert "DROP TABLE report" in sql
    for table in ("barrier", "location", "evidence_provenance"):
        assert f"DROP TABLE {table}" not in sql


def test_review_only_downgrade_keeps_report_and_barrier_tables(
    migration_config: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("DATABASE_URL", UNIT_DATABASE_URL)
    output = StringIO()
    migration_config.output_buffer = output
    command.downgrade(migration_config, "0003_report_reviews:0002_reports", sql=True)
    sql = output.getvalue()
    assert "DROP TABLE report_review;" in sql
    assert "DROP FUNCTION reject_report_review_mutation()" in sql
    for table in ("report", "barrier", "location", "evidence_provenance"):
        assert f"DROP TABLE {table};" not in sql
