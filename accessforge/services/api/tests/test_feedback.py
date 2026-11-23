"""Feedback is anonymous, bounded, write-only, rate limited, and persisted for real."""

from collections.abc import Iterator
from io import StringIO

import pytest
from alembic import command
from alembic.config import Config
from conftest import UNIT_DATABASE_URL
from fastapi.testclient import TestClient
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session
from test_api import application

from accessforge_api.database import get_session
from accessforge_api.models import Feedback
from accessforge_api.report_limits import FEEDBACK_PER_WINDOW

VALID = {"topic": "accessibility", "message": "  The map legend is hard to read.  "}


@pytest.mark.parametrize(
    "payload",
    [
        {**VALID, "topic": "praise"},
        {**VALID, "message": "   "},
        {**VALID, "message": "x" * 2001},
        {**VALID, "website": "http://spam.example"},
        {**VALID, "email": "someone@example.com"},
    ],
)
def test_rejects_invalid_honeypot_and_identity_fields(payload: dict[str, str]) -> None:
    with TestClient(application()) as client:
        assert client.post("/feedback", json=payload).status_code == 422


def test_feedback_has_no_public_read_route_and_no_identity_columns() -> None:
    with TestClient(application()) as client:
        assert client.get("/feedback").status_code == 405
    assert set(Feedback.__table__.c.keys()) == {"id", "topic", "message", "created_at"}


def test_rate_limit_refuses_before_touching_the_database() -> None:
    app = application()
    with TestClient(app) as client:
        for _ in range(FEEDBACK_PER_WINDOW):
            app.state.feedback_limiter.check("testclient")
        response = client.post("/feedback", json=VALID)
    assert response.status_code == 429
    assert "Retry-After" in response.headers


def test_downgrade_drops_only_feedback(
    migration_config: Config, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("DATABASE_URL", UNIT_DATABASE_URL)
    migration_config.output_buffer = output = StringIO()
    command.downgrade(migration_config, "0005_feedback:0004_network", sql=True)
    sql = output.getvalue()
    assert "DROP TABLE feedback;" in sql
    assert sql.count("DROP TABLE") == 1


@pytest.fixture
def feedback_client(postgis_engine: Engine) -> Iterator[TestClient]:
    app = application()

    def real_session() -> Iterator[Session]:
        with Session(postgis_engine) as session:
            yield session

    app.dependency_overrides[get_session] = real_session
    with TestClient(app) as client:
        yield client


def test_feedback_persists_trimmed_message_only(
    feedback_client: TestClient, postgis_engine: Engine
) -> None:
    response = feedback_client.post("/feedback", json=VALID)
    assert response.status_code == 201
    assert response.json()["data"] == {"received": True}
    with Session(postgis_engine) as session:
        stored = session.scalars(select(Feedback)).one()
    assert (stored.topic, stored.message) == (
        "accessibility",
        "The map legend is hard to read.",
    )
