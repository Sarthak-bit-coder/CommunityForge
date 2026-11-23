"""Hand-built OSM data with known answers, and a disposable migrated PostGIS schema."""

import os
from collections.abc import Iterator
from pathlib import Path
from typing import Any
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.engine import make_url

from accessforge_ingest.areas import BBox

API_ROOT = Path(__file__).resolve().parents[3] / "services" / "api"
AREA = BBox(37.0, -122.0, 37.01, -121.99)


def node(i: int, lat: float, lon: float, **tags: str) -> dict[str, Any]:
    return {"type": "node", "id": i, "lat": lat, "lon": lon, "tags": tags, "version": 2,
            "timestamp": "2025-01-02T03:04:05Z"}  # fmt: skip


def way(i: int, nodes: list[int], **tags: str) -> dict[str, Any]:
    return {"type": "way", "id": i, "nodes": nodes, "tags": tags}


@pytest.fixture
def elements() -> list[dict[str, Any]]:
    """
    Sidewalk 10: 1-2-3, crossing 11: 3-4 (4 is a raised kerb), street 12: 4-5,
    island footway 13: 6-7 (disconnected), motorway 14: 1-5 (not walkable),
    road 15 with sidewalk=separate: 2-5 (not walkable), clinic node 20, park way 21.
    """
    return [
        node(1, 37.001, -121.999), node(2, 37.002, -121.999), node(3, 37.003, -121.999),
        node(4, 37.003, -121.998, kerb="raised"), node(5, 37.003, -121.997, kerb="lowered"),
        node(6, 37.008, -121.995), node(7, 37.009, -121.995),
        node(20, 37.004, -121.996, amenity="clinic", name="Clinic"),
        node(30, 37.005, -121.991), node(31, 37.006, -121.991), node(32, 37.006, -121.992),
        way(10, [1, 2, 3], highway="footway", footway="sidewalk", surface="concrete"),
        way(11, [3, 4], highway="footway", footway="crossing"),
        way(12, [4, 5], highway="residential"),
        way(13, [6, 7], highway="path"),
        way(14, [1, 5], highway="motorway"),
        way(15, [2, 5], highway="tertiary", sidewalk="separate"),
        way(21, [30, 31, 32, 30], leisure="park"),
    ]  # fmt: skip


@pytest.fixture
def postgis_engine() -> Iterator[Engine]:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL not set; real PostGIS integration unavailable")
    if not (make_url(url).database or "").endswith("_test"):
        pytest.fail("TEST_DATABASE_URL must point at a disposable *_test database")
    schema = f"test_{uuid4().hex}"
    admin = create_engine(url, hide_parameters=True)
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))  # generated identifier
    engine = create_engine(
        url,
        hide_parameters=True,
        connect_args={"options": f"-c search_path={schema},public"},
    )
    try:
        config = Config(str(API_ROOT / "alembic.ini"))
        config.set_main_option("script_location", str(API_ROOT / "migrations"))
        with engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
        yield engine
    finally:
        engine.dispose()
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()
