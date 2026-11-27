"""Transport tests stub the repository boundary; PostgreSQL behavior is tested separately."""

from datetime import UTC, datetime
from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session
from test_api import application

from accessforge_api.report_limits import REPORTS_PER_WINDOW, ReportLimiter
from accessforge_api.report_repository import _views, report_query
from accessforge_api.report_schemas import EvidenceView, ReportCreate, ReportView
from accessforge_api.schemas import (
    BarrierType,
    EvidenceSource,
    LocationInput,
    VerificationStatus,
)

PAYLOAD = {
    "type": "obstruction",
    "description": " Example barrier ",
    "severity": 3,
    "location": {"longitude": -121.9886, "latitude": 37.5485},
}


def example_report() -> ReportView:
    now = datetime.now(UTC)
    report_id = uuid4()
    return ReportView(
        id=report_id,
        barrier_id=uuid4(),
        type=BarrierType.obstruction,
        description="Example barrier",
        severity=3,
        location=LocationInput(longitude=-121.9886, latitude=37.5485),
        state=VerificationStatus.unverified,
        created_at=now,
        evidence=(
            EvidenceView(
                source=EvidenceSource.community_report,
                source_ref=str(report_id),
                source_version=None,
                observed_at=now,
                recorded_at=now,
            ),
        ),
    )


def test_post_response_contract_without_claiming_database_persistence() -> None:
    report = example_report()
    with (
        patch(
            "accessforge_api.reports.report_repository.create_report",
            return_value=report,
        ) as create,
        TestClient(application()) as client,
    ):
        response = client.post("/reports", json=PAYLOAD)
    assert response.status_code == 201
    assert response.headers["Location"] == f"/reports/{report.id}"
    assert response.json()["data"]["state"] == "unverified"
    assert response.json()["data"]["evidence"][0]["source"] == "community_report"
    assert create.call_args.args[1].description == "Example barrier"


def test_get_missing_report_and_filtered_page_contract() -> None:
    app = application()
    report = example_report()
    with (
        patch(
            "accessforge_api.reports.report_repository.get_report", return_value=None
        ),
        TestClient(app) as client,
    ):
        response = client.get(f"/reports/{uuid4()}")
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "http_error"
    with (
        patch(
            "accessforge_api.reports.report_repository.get_report", return_value=report
        ),
        patch(
            "accessforge_api.reports.report_repository.list_reports",
            return_value=((report,), 5),
        ) as listing,
        TestClient(app) as client,
    ):
        assert client.get(f"/reports/{report.id}").json()["data"]["id"] == str(
            report.id
        )
        response = client.get(
            "/reports?page=2&limit=2&type=obstruction&state=unverified"
        )
        assert response.status_code == 200
        assert response.json()["meta"] == {"page": 2, "limit": 2, "total": 5}
        assert listing.call_args.kwargs == {
            "page": 2,
            "limit": 2,
            "barrier_type": BarrierType.obstruction,
            "state": VerificationStatus.unverified,
        }


@pytest.mark.parametrize(
    "change",
    [
        {"type": "unknown"},
        {"description": "  "},
        {"description": "x" * 2001},
        {"severity": 0},
        {"severity": True},
        {"location": {"longitude": 181, "latitude": 0}},
        {"location": {"longitude": 0, "latitude": -91}},
        {"location": {"longitude": "0", "latitude": 0}},
        {"state": "confirmed"},
        {"source": "field_verification"},
        {"presence_prob": 1},
        {"reporter_email": "not-collected"},
    ],
)
def test_submission_validation_rejects_invalid_or_privileged_fields(
    change: dict[str, object],
) -> None:
    with TestClient(application()) as client:
        response = client.post("/reports", json={**PAYLOAD, **change})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


@pytest.mark.parametrize(
    "query",
    [
        "page=0",
        "page=10001",
        "limit=0",
        "limit=101",
        "page=invalid",
        "type=unknown",
        "state=approved",
    ],
)
def test_invalid_pagination_and_filters_are_rejected(query: str) -> None:
    with TestClient(application()) as client:
        assert client.get(f"/reports?{query}").status_code == 422


def test_malformed_id_has_safe_validation_response() -> None:
    with TestClient(application()) as client:
        response = client.get("/reports/not-a-uuid")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_read_model_is_frozen_and_create_model_trims_text() -> None:
    assert ReportCreate.model_validate(PAYLOAD).description == "Example barrier"
    with pytest.raises(ValidationError):
        example_report().state = VerificationStatus.confirmed  # type: ignore[misc]


def test_query_binds_filters_instead_of_interpolating_them() -> None:
    query = report_query(BarrierType.obstruction, VerificationStatus.unverified)
    compiled = query.compile(dialect=postgresql.dialect())
    assert "JOIN barrier" in str(compiled) and "JOIN location" in str(compiled)
    assert "ST_AsEWKB(ST_X" not in str(compiled)
    assert set(compiled.params.values()) == {
        BarrierType.obstruction,
        VerificationStatus.unverified,
    }
    # Empty result conversion never tries a database query.
    with Session() as session:
        assert _views(session, ()) == ()


def test_submission_rate_limit_expires_and_does_not_trust_forwarded_headers() -> None:
    limiter = ReportLimiter()
    with patch("accessforge_api.report_limits.monotonic", return_value=0):
        for _ in range(REPORTS_PER_WINDOW):
            limiter.check("peer")
        with pytest.raises(HTTPException) as error:
            limiter.check("peer")
        assert error.value.status_code == 429
    with patch("accessforge_api.report_limits.monotonic", return_value=61):
        limiter.check("peer")
    report = example_report()
    with (
        patch(
            "accessforge_api.reports.report_repository.create_report",
            return_value=report,
        ),
        TestClient(application()) as client,
    ):
        for i in range(REPORTS_PER_WINDOW):
            assert (
                client.post(
                    "/reports", json=PAYLOAD, headers={"X-Forwarded-For": str(i)}
                ).status_code
                == 201
            )
        blocked = client.post("/reports", json=PAYLOAD)
        assert blocked.status_code == 429
        assert "Retry-After" in blocked.headers
