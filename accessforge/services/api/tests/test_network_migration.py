"""Migration 0004: network tables go up and down cleanly and never drop OSM evidence silently."""

from io import StringIO

import pytest
from alembic import command
from alembic.config import Config
from conftest import UNIT_DATABASE_URL
from sqlalchemy import Engine, inspect, text
from sqlalchemy.exc import IntegrityError

NETWORK_TABLES = {
    "data_source",
    "network_node",
    "network_edge",
    "destination",
    "origin",
}


def _offline(
    config: Config, monkeypatch: pytest.MonkeyPatch, step: str, up: bool
) -> str:
    monkeypatch.setenv("DATABASE_URL", UNIT_DATABASE_URL)
    output = StringIO()
    config.output_buffer = output
    (command.upgrade if up else command.downgrade)(config, step, sql=True)
    return output.getvalue()


def test_upgrade_creates_network_tables_and_open_map_evidence(
    migration_config: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    sql = _offline(
        migration_config, monkeypatch, "0003_report_reviews:0004_network", True
    )
    for table in NETWORK_TABLES:
        assert f"CREATE TABLE {table}" in sql
    assert "geometry(LINESTRING,4326)" in sql
    assert "'open_map_data'" in sql


def test_downgrade_drops_only_network_tables_dependents_first(
    migration_config: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    sql = _offline(
        migration_config, monkeypatch, "0004_network:0003_report_reviews", False
    )
    assert (
        sql.index("DROP TABLE origin")
        < sql.index("DROP TABLE network_edge")
        < sql.index("DROP TABLE network_node")
        < sql.index("DROP TABLE data_source")
    )
    for table in ("barrier", "location", "evidence_provenance", "report"):
        assert f"DROP TABLE {table};" not in sql


@pytest.mark.integration
def test_downgrade_refuses_to_discard_open_map_evidence(
    postgis_engine: Engine, migration_config: Config
) -> None:
    with postgis_engine.begin() as connection:
        location = connection.scalar(text(
            "INSERT INTO location(geom) VALUES (ST_SetSRID(ST_MakePoint(-121.97, 37.55), 4326)) RETURNING id"
        ))  # fmt: skip
        barrier = connection.scalar(
            text(
                "INSERT INTO barrier(location_id,type,description,severity,presence_prob)"
                " VALUES (:l,'missing_curb_ramp','raised kerb',4,0.5) RETURNING id"
            ),
            {"l": location},
        )
        connection.execute(
            text(
                "INSERT INTO evidence_provenance(barrier_id,source,source_ref,observed_at)"
                " VALUES (:b,'open_map_data','osm:node/1',now())"
            ),
            {"b": barrier},
        )
        migration_config.attributes["connection"] = connection
        with pytest.raises(IntegrityError):
            command.downgrade(migration_config, "0003_report_reviews")


@pytest.mark.integration
def test_network_roundtrip_on_real_postgis(
    postgis_engine: Engine, migration_config: Config
) -> None:
    with postgis_engine.begin() as connection:
        migration_config.attributes["connection"] = connection
        command.downgrade(migration_config, "0003_report_reviews")
        assert not NETWORK_TABLES & set(inspect(connection).get_table_names())
        command.upgrade(migration_config, "head")
        assert NETWORK_TABLES <= set(inspect(connection).get_table_names())
