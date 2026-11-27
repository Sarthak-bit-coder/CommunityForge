"""Integration fixtures isolate all application tables in a fresh test-only schema."""

import os
from collections.abc import Iterator
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.engine import make_url

API_ROOT = Path(__file__).resolve().parents[1]
# This unreachable local endpoint is a fixture, not a production credential.
UNIT_DATABASE_URL = "postgresql+psycopg://unit:placeholder@127.0.0.1:1/accessforge_test"


@pytest.fixture
def migration_config() -> Config:
    return Config(str(API_ROOT / "alembic.ini"))


@pytest.fixture
def postgis_engine(migration_config: Config) -> Iterator[Engine]:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL not set; real PostGIS integration unavailable")
    parsed = make_url(url)
    if parsed.drivername != "postgresql+psycopg" or not (
        parsed.database or ""
    ).endswith("_test"):
        pytest.fail(
            "TEST_DATABASE_URL must use psycopg and a disposable *_test database"
        )
    admin = create_engine(
        url, hide_parameters=True, connect_args={"connect_timeout": 5}
    )
    schema = f"test_{uuid4().hex}"
    try:
        with admin.begin() as connection:
            connection.execute(text("SELECT PostGIS_Version()"))
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        engine = create_engine(
            url,
            hide_parameters=True,
            connect_args={
                "connect_timeout": 5,
                "options": f"-c search_path={schema},public",
            },
        )
        try:
            with engine.begin() as connection:
                migration_config.attributes["connection"] = connection
                command.upgrade(migration_config, "head")
            yield engine
        finally:
            engine.dispose()
            with admin.begin() as connection:
                # Only this fixture's generated identifier is interpolated.
                connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
    finally:
        admin.dispose()
