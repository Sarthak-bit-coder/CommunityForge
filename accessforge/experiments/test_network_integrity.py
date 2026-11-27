"""Exercise the read-only integrity query with disposable PostGIS fixtures."""

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy import Connection, create_engine, text
from sqlalchemy.engine import make_url

AUDIT_SQL = Path(__file__).with_name("network_integrity.sql").read_text()


@pytest.fixture
def network_db() -> Iterator[Connection]:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL required for PostGIS")
    assert (make_url(url).database or "").endswith("_test")
    engine = create_engine(
        url, hide_parameters=True, connect_args={"connect_timeout": 5}
    )
    try:
        with engine.connect() as connection:
            # Temporary tables allow bad imports to be tested without touching application data.
            connection.execute(
                text("""
                CREATE TEMP TABLE network_node (id text, geom geometry);
                CREATE TEMP TABLE network_edge (
                    id text, from_node text, to_node text, geom geometry, length_m double precision
                );
                CREATE TEMP TABLE origin (id text, geom geometry, node_id text);
                CREATE TEMP TABLE destination (id text, geom geometry, node_id text);
                """)
            )
            yield connection
    finally:
        engine.dispose()


def _issues(connection: Connection) -> set[tuple[str, str, str]]:
    issues = set()
    for kind, record_id, issue in connection.execute(text(AUDIT_SQL)):
        assert (
            isinstance(kind, str)
            and isinstance(record_id, str)
            and isinstance(issue, str)
        )
        issues.add((kind, record_id, issue))
    return issues


def _add_valid_edge(connection: Connection, start: str, end: str, west: float) -> None:
    connection.execute(
        text("""
            INSERT INTO network_node VALUES
                (:u, ST_SetSRID(ST_MakePoint(:west, 37.55), 4326)),
                (:v, ST_SetSRID(ST_MakePoint(:west + 0.001, 37.55), 4326));
            """),
        {"u": start, "v": end, "west": west},
    )
    connection.execute(
        text("""
            INSERT INTO network_edge
            SELECT :u, :u, :v, geom, ST_Length(ST_Transform(geom, 32610))
            FROM (
                SELECT ST_MakeLine(u.geom, v.geom) AS geom
                FROM network_node u, network_node v WHERE u.id = :u AND v.id = :v
            ) line
            """),
        {"u": start, "v": end},
    )


def test_connected_network_and_attached_trip_pass(network_db: Connection) -> None:
    _add_valid_edge(network_db, "a", "b", -121.98)
    network_db.execute(
        text("""
        INSERT INTO origin SELECT 'home', geom, id FROM network_node WHERE id = 'a';
        INSERT INTO destination SELECT 'clinic', geom, id FROM network_node WHERE id = 'b';
        """)
    )
    assert _issues(network_db) == set()


def test_valid_vertex_does_not_establish_access_from_an_offset_trip_endpoint(
    network_db: Connection,
) -> None:
    _add_valid_edge(network_db, "a", "b", -121.98)
    network_db.execute(
        text("""
        INSERT INTO origin VALUES ('home', 'SRID=4326;POINT(-121.981 37.55)', 'a');
        INSERT INTO destination VALUES ('clinic', 'SRID=4326;POINT(-121.978 37.55)', 'b');
        """)
    )
    assert _issues(network_db) == {
        ("origin", "home", "unverified_access_leg"),
        ("destination", "clinic", "unverified_access_leg"),
    }


def test_disconnected_components_and_shape_point_snap_are_reported(
    network_db: Connection,
) -> None:
    _add_valid_edge(network_db, "a", "b", -121.98)
    _add_valid_edge(network_db, "c", "d", -121.97)
    network_db.execute(
        text("""
        INSERT INTO network_node VALUES ('shape', 'SRID=4326;POINT(-121.9795 37.55)');
        INSERT INTO origin SELECT 'home', geom, id FROM network_node WHERE id = 'shape';
        """)
    )
    assert _issues(network_db) == {
        ("node", "c", "outside_first_component"),
        ("node", "d", "outside_first_component"),
        ("origin", "home", "not_on_network"),
    }


def test_invalid_geometries_references_and_lengths_are_reported(
    network_db: Connection,
) -> None:
    _add_valid_edge(network_db, "a", "b", -121.98)
    network_db.execute(
        text("""
        INSERT INTO network_node VALUES ('swapped', 'SRID=4326;POINT(37.55 -121.98)');
        INSERT INTO network_edge VALUES
            ('bad_axis', 'a', 'b',
             'SRID=4326;LINESTRING(-121.98 37.55, 37.55 -121.98, -121.979 37.55)', 1),
            ('empty', 'a', 'b', 'SRID=4326;LINESTRING EMPTY', 1),
            ('missing', 'a', 'b', NULL, 1),
            ('wrong_srid', 'a', 'b', 'SRID=32610;LINESTRING(100 200, 101 200)', 1);
        INSERT INTO network_edge
        SELECT 'dangling', from_node, 'unknown', geom, length_m FROM network_edge WHERE id = 'a';
        INSERT INTO network_edge
        SELECT 'reversed', to_node, from_node, geom, length_m FROM network_edge WHERE id = 'a';
        INSERT INTO network_edge
        SELECT 'wrong_length', from_node, to_node, geom, 2 * length_m
        FROM network_edge WHERE id = 'a';
        UPDATE network_edge SET length_m = 'NaN' WHERE id = 'a';
        """)
    )
    assert _issues(network_db) == {
        ("edge", "a", "invalid_length"),
        ("edge", "bad_axis", "invalid_line"),
        ("edge", "dangling", "invalid_reference"),
        ("edge", "empty", "invalid_line"),
        ("edge", "missing", "invalid_line"),
        ("edge", "reversed", "endpoint_mismatch"),
        ("edge", "wrong_length", "invalid_length"),
        ("edge", "wrong_srid", "invalid_line"),
        ("network", "", "no_usable_edges"),
        ("node", "swapped", "invalid_point"),
    }
