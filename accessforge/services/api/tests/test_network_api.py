"""Pilot street geometry is served read-only, with its license, from real PostGIS."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text
from sqlalchemy.orm import Session
from test_api import application

from accessforge_api.database import get_session

pytestmark = pytest.mark.integration


@pytest.fixture
def network_client(postgis_engine: Engine) -> Iterator[TestClient]:
    app = application()

    def real_session() -> Iterator[Session]:
        with Session(postgis_engine) as session:
            yield session

    app.dependency_overrides[get_session] = real_session
    with TestClient(app) as client:
        yield client


def test_no_loaded_network_returns_empty_lines(network_client: TestClient) -> None:
    data = network_client.get("/network/streets").json()["data"]
    assert data == {"lines": [], "attribution": [], "truncated": False}


def test_loaded_edge_is_served_with_license_and_caching(
    network_client: TestClient, postgis_engine: Engine
) -> None:
    with postgis_engine.begin() as connection:
        connection.execute(
            text("""
            INSERT INTO data_source VALUES
              ('osm', 'OpenStreetMap', 'ODbL 1.0, © OpenStreetMap contributors',
               'https://www.openstreetmap.org', 'test', now());
            INSERT INTO network_node (id, geom, kind, source_id, source_ref) VALUES
              ('00000000-0000-4000-8000-000000000001',
               ST_SetSRID(ST_MakePoint(-121.98, 37.55), 4326), 'junction', 'osm', 'n1'),
              ('00000000-0000-4000-8000-000000000002',
               ST_SetSRID(ST_MakePoint(-121.97, 37.56), 4326), 'junction', 'osm', 'n2');
            INSERT INTO network_edge
              (from_node, to_node, geom, length_m, kind, source_id, source_ref)
            VALUES ('00000000-0000-4000-8000-000000000001',
                    '00000000-0000-4000-8000-000000000002',
                    ST_GeomFromText('LINESTRING(-121.98 37.55, -121.97 37.56)', 4326),
                    1400, 'sidewalk', 'osm', 'w1');
            """)
        )
    response = network_client.get("/network/streets")
    assert response.headers["Cache-Control"] == "public, max-age=3600"
    assert response.json()["data"] == {
        "lines": [[[-121.98, 37.55], [-121.97, 37.56]]],
        "attribution": ["ODbL 1.0, © OpenStreetMap contributors"],
        "truncated": False,
    }
