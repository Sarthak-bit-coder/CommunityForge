"""Real PostGIS transaction, locking, and append-only audit proofs."""

from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session
from test_reports_unit import PAYLOAD
from test_reviews import REVIEWER_ID, REVIEWER_KEY, reviewer_app

from accessforge_api.database import get_session
from accessforge_api.models import Barrier, ReportReview
from accessforge_api.report_repository import create_report, get_report
from accessforge_api.report_schemas import ReportCreate
from accessforge_api.review_repository import review_history, review_report
from accessforge_api.review_schemas import ReportNotFound, ReviewConflict, ReviewInput

pytestmark = pytest.mark.integration


def pending(engine: Engine) -> UUID:
    with Session(engine) as session:
        return create_report(session, ReportCreate.model_validate(PAYLOAD)).id


@pytest.mark.parametrize(
    "status,target", [("verified", "confirmed"), ("rejected", "rejected")]
)
def test_review_updates_state_and_records_private_audit(
    postgis_engine: Engine, status: str, target: str
) -> None:
    report_id = pending(postgis_engine)
    reviewer = uuid4()
    with Session(postgis_engine) as session:
        result = review_report(
            session,
            report_id,
            ReviewInput.model_validate(
                {"status": status, "reason": "Site review; no photo available"}
            ),
            reviewer_id=reviewer,
        )
        assert result.reviewer_id == reviewer and result.to_state.value == target
        assert result.reviewed_at.tzinfo is not None
        assert review_history(session, report_id) == (result,)
        report = get_report(session, report_id)
        assert report is not None and report.state.value == target
        assert "reviewer_id" not in report.model_dump()
        assert session.scalar(select(Barrier.presence_prob)) == 0.5
    with Session(postgis_engine) as session, pytest.raises(ReviewConflict):
        review_report(
            session,
            report_id,
            ReviewInput(status="verified", reason="Repeat"),
            reviewer_id=reviewer,
        )


def test_missing_review_and_history(postgis_engine: Engine) -> None:
    with Session(postgis_engine) as session:
        with pytest.raises(ReportNotFound):
            review_report(
                session,
                uuid4(),
                ReviewInput(status="verified", reason="Assessment"),
                reviewer_id=uuid4(),
            )
        with pytest.raises(ReportNotFound):
            review_history(session, uuid4())


def test_failed_audit_insert_rolls_back_state(postgis_engine: Engine) -> None:
    report_id = pending(postgis_engine)
    with postgis_engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE report_review ADD CONSTRAINT test_fail_audit CHECK (false)"
            )
        )
    with Session(postgis_engine) as session, pytest.raises(DBAPIError):
        review_report(
            session,
            report_id,
            ReviewInput(status="rejected", reason="Assessment"),
            reviewer_id=uuid4(),
        )
    with Session(postgis_engine) as session:
        report = get_report(session, report_id)
        assert report is not None and report.state.value == "unverified"
        assert session.scalar(select(func.count()).select_from(ReportReview)) == 0


@pytest.mark.parametrize(
    "statement",
    [
        "UPDATE report_review SET reason = 'changed'",
        "DELETE FROM report_review",
        "TRUNCATE report_review",
    ],
)
def test_audit_cannot_be_changed_or_removed(
    postgis_engine: Engine, statement: str
) -> None:
    report_id = pending(postgis_engine)
    with Session(postgis_engine) as session:
        review_report(
            session,
            report_id,
            ReviewInput(status="verified", reason="Assessment"),
            reviewer_id=uuid4(),
        )
    with postgis_engine.begin() as connection, pytest.raises(DBAPIError):
        connection.execute(text(statement))


def test_competing_reviewers_cannot_both_transition(postgis_engine: Engine) -> None:
    report_id = pending(postgis_engine)

    def attempt(status: str) -> str:
        with Session(postgis_engine) as session:
            try:
                review_report(
                    session,
                    report_id,
                    ReviewInput.model_validate(
                        {"status": status, "reason": "Assessment"}
                    ),
                    reviewer_id=uuid4(),
                )
                return "accepted"
            except ReviewConflict:
                return "conflict"

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(attempt, ["verified", "rejected"])) == [
            "accepted",
            "conflict",
        ]
    with Session(postgis_engine) as session:
        assert len(review_history(session, report_id)) == 1


def test_cached_pending_state_cannot_override_a_committed_review(
    postgis_engine: Engine,
) -> None:
    report_id = pending(postgis_engine)
    with Session(postgis_engine, expire_on_commit=False) as stale_session:
        cached = stale_session.scalar(select(Barrier))
        assert cached is not None and cached.state.value == "unverified"
        stale_session.commit()
        with Session(postgis_engine) as reviewer_session:
            review_report(
                reviewer_session,
                report_id,
                ReviewInput(status="verified", reason="First assessment"),
                reviewer_id=uuid4(),
            )
        assert cached.state.value == "unverified"
        with pytest.raises(ReviewConflict):
            review_report(
                stale_session,
                report_id,
                ReviewInput(status="rejected", reason="Stale assessment"),
                reviewer_id=uuid4(),
            )
    with Session(postgis_engine) as session:
        history = review_history(session, report_id)
        assert len(history) == 1
        assert history[0].to_state.value == "confirmed"


def test_signed_in_reviewer_verifies_a_report_over_http_once(
    postgis_engine: Engine,
) -> None:
    app = reviewer_app()

    def real_session() -> Iterator[Session]:
        with Session(postgis_engine) as session:
            yield session

    app.dependency_overrides[get_session] = real_session
    with TestClient(app, base_url="https://testserver") as client:
        report = client.post("/reports", json=PAYLOAD).json()["data"]
        path = f"/reports/{report['id']}/reviews"
        decision = {"status": "verified", "reason": "Checked on site"}
        assert client.post(path, json=decision).status_code == 401
        assert client.get(f"/reports/{report['id']}").json()["data"]["state"] == (
            "unverified"
        )

        client.post("/reviewer/session", json={"key": REVIEWER_KEY})
        review = client.post(path, json=decision)
        assert review.status_code == 201
        assert review.json()["data"]["reviewer_id"] == str(REVIEWER_ID)
        public = client.get(f"/reports/{report['id']}").json()["data"]
        assert public["state"] == "confirmed"
        assert "reviewer_id" not in public and "reason" not in public

        assert client.post(path, json=decision).status_code == 409
        history = client.get(path).json()["data"]
        assert [item["reason"] for item in history] == ["Checked on site"]
        missing = f"/reports/{uuid4()}/reviews"
        assert client.post(missing, json=decision).status_code == 404
