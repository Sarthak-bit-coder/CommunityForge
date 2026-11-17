"""Real PostGIS report transport and transaction tests; no repository/DB mocks."""

from collections.abc import Iterator
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select, text, update
from sqlalchemy.orm import Session
from test_api import application
from test_reports_unit import PAYLOAD

from accessforge_api.database import get_session
from accessforge_api.models import Barrier, EvidenceProvenance, Location, Report
from accessforge_api.schemas import VerificationStatus

pytestmark = pytest.mark.integration


@pytest.fixture
def report_client(postgis_engine: Engine) -> Iterator[TestClient]:
    app = application()

    def real_session() -> Iterator[Session]:
        with Session(postgis_engine) as session:
            yield session

    app.dependency_overrides[get_session] = real_session
    with TestClient(app) as client:
        yield client


def test_submission_persists_unverified_barrier_location_report_and_evidence(
    report_client: TestClient, postgis_engine: Engine
) -> None:
    response = report_client.post("/reports", json=PAYLOAD)
    assert response.status_code == 201
    report = response.json()["data"]
    assert report["state"] == "unverified"
    assert report["description"] == "Example barrier"
    assert report["location"] == PAYLOAD["location"]
    assert report["evidence"][0]["source"] == "community_report"
    assert report["evidence"][0]["source_ref"] == report["id"]
    assert report_client.get(response.headers["Location"]).json()["data"] == report
    with Session(postgis_engine) as session:
        assert all(
            session.scalar(select(func.count()).select_from(model)) == 1
            for model in (Report, Barrier, Location, EvidenceProvenance)
        )
        assert session.scalar(select(Barrier.presence_prob)) == 0.5


def test_filter_pagination_and_original_description(
    report_client: TestClient, postgis_engine: Engine
) -> None:
    created = [
        report_client.post(
            "/reports",
            json={
                **PAYLOAD,
                "type": "surface_problem" if i % 2 else "obstruction",
                "description": f"Synthetic report {i}",
            },
        ).json()["data"]
        for i in range(5)
    ]
    with Session(postgis_engine) as session, session.begin():
        session.execute(
            update(Barrier)
            .where(Barrier.id == created[0]["barrier_id"])
            .values(
                state=VerificationStatus.confirmed,
                description="Updated barrier assessment",
            )
        )
        session.execute(
            update(Report).values(created_at=datetime(2026, 1, 1, tzinfo=UTC))
        )
    filtered = report_client.get("/reports?type=obstruction&state=confirmed").json()
    assert filtered["meta"]["total"] == 1
    assert filtered["data"][0]["id"] == created[0]["id"]
    assert filtered["data"][0]["description"] == "Synthetic report 0"
    page1 = report_client.get("/reports?page=1&limit=2").json()
    page2 = report_client.get("/reports?page=2&limit=2").json()
    expected = sorted((r["id"] for r in created), reverse=True)
    assert [r["id"] for r in page1["data"]] == expected[:2]
    assert [r["id"] for r in page2["data"]] == expected[2:4]
    assert page1["meta"] == {"page": 1, "limit": 2, "total": 5}
    empty = report_client.get("/reports?page=4&limit=2").json()
    assert empty["data"] == [] and empty["meta"]["total"] == 5


def test_missing_report_and_empty_filtered_list(report_client: TestClient) -> None:
    assert report_client.get(f"/reports/{uuid4()}").status_code == 404
    assert report_client.get("/reports?state=resolved").json()["data"] == []


def test_failed_provenance_insert_rolls_back_the_entire_submission(
    report_client: TestClient, postgis_engine: Engine
) -> None:
    with postgis_engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE evidence_provenance ADD CONSTRAINT test_reject_evidence CHECK (false)"
            )
        )
    response = report_client.post("/reports", json=PAYLOAD)
    assert response.status_code == 503
    assert "INSERT" not in response.text
    with Session(postgis_engine) as session:
        assert all(
            session.scalar(select(func.count()).select_from(model)) == 0
            for model in (Report, Barrier, Location, EvidenceProvenance)
        )


def test_reports_migration_preserves_foundation_data_on_downgrade(
    report_client: TestClient, postgis_engine: Engine, migration_config: Config
) -> None:
    assert report_client.post("/reports", json=PAYLOAD).status_code == 201
    with postgis_engine.begin() as connection:
        migration_config.attributes["connection"] = connection
        command.downgrade(migration_config, "0001_foundation")
        for table in ("location", "barrier", "evidence_provenance"):
            assert connection.scalar(text(f"SELECT count(*) FROM {table}")) == 1
        command.upgrade(migration_config, "head")
        assert connection.scalar(text("SELECT count(*) FROM report")) == 0
