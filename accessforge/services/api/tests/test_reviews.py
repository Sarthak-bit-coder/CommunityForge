"""Review policy and reviewer-key authorization; persistence is tested on PostGIS."""

from collections.abc import Callable
from datetime import UTC, datetime
from hashlib import sha256
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from conftest import UNIT_DATABASE_URL
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from test_api import application

from accessforge_api.auth import parse_reviewer_keys, reviewer_for_key
from accessforge_api.config import Settings
from accessforge_api.main import create_app
from accessforge_api.report_limits import REPORTS_PER_WINDOW
from accessforge_api.review_schemas import (
    ReportNotFound,
    ReviewConflict,
    ReviewInput,
    ReviewStatus,
    ReviewView,
    review_transition,
)
from accessforge_api.schemas import VerificationStatus


@pytest.mark.parametrize(
    "decision,target", [("verified", "confirmed"), ("rejected", "rejected")]
)
def test_pending_review_transitions(decision: str, target: str) -> None:
    payload = ReviewInput(status=decision, reason="  Documented site assessment  ")
    assert payload.reason == "Documented site assessment"
    assert (
        review_transition(VerificationStatus.unverified, payload.status).value == target
    )


@pytest.mark.parametrize("current", list(VerificationStatus))
@pytest.mark.parametrize("decision", list(ReviewStatus))
def test_only_pending_can_be_reviewed(
    current: VerificationStatus, decision: ReviewStatus
) -> None:
    if current == VerificationStatus.unverified and decision != ReviewStatus.pending:
        assert review_transition(current, decision) in (
            VerificationStatus.confirmed,
            VerificationStatus.rejected,
        )
    else:
        with pytest.raises(ReviewConflict):
            review_transition(current, decision)


@pytest.mark.parametrize(
    "fields",
    [
        {"status": "unknown", "reason": "Assessment"},
        {"status": "verified", "reason": "  "},
        {"status": "rejected", "reason": "x" * 2001},
        {"status": "verified"},
        {"status": "verified", "reason": "Assessment", "reviewer_id": str(uuid4())},
    ],
)
def test_review_rejects_invalid_data_and_client_identity(
    fields: dict[str, str],
) -> None:
    with pytest.raises(ValidationError):
        ReviewInput.model_validate(fields)


REVIEWER_ID = uuid4()
REVIEWER_KEY = "test-only-reviewer-key"  # A fixture, not a deployed credential.
KEY_DIGEST = sha256(REVIEWER_KEY.encode()).hexdigest()
REVIEW = {"status": "verified", "reason": "Attempt"}


def reviewer_app() -> FastAPI:
    return create_app(
        Settings(
            database_url=UNIT_DATABASE_URL,
            reviewer_keys=f"{REVIEWER_ID}:{KEY_DIGEST}",
            _env_file=None,
        )
    )


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": "Bearer fabricated", "X-Role": "admin"},
        {"Authorization": f"Basic {REVIEWER_KEY}"},
        {"X-Reviewer-Id": str(REVIEWER_ID)},
    ],
)
@pytest.mark.parametrize("make_app", [application, reviewer_app])
def test_review_routes_refuse_requests_without_a_valid_key(
    headers: dict[str, str], make_app: Callable[[], FastAPI]
) -> None:
    with (
        patch("accessforge_api.reviews.review_repository.review_report") as review,
        patch("accessforge_api.reviews.review_repository.review_history") as history,
        TestClient(make_app()) as client,
    ):
        path = f"/reports/{uuid4()}/reviews"
        assert client.post(path, headers=headers, json=REVIEW).status_code == 401
        assert client.get(path, headers=headers).status_code == 401
        assert client.get("/reviewer/session", headers=headers).status_code == 401
        for suffix in ("review", "verify", "transitions"):
            other = f"/reports/{uuid4()}/{suffix}"
            assert client.post(other, headers=headers, json=REVIEW).status_code == 404
    review.assert_not_called()
    history.assert_not_called()


def test_no_reviewer_keys_configured_means_no_one_can_sign_in() -> None:
    with TestClient(application()) as client:
        response = client.post("/reviewer/session", json={"key": REVIEWER_KEY})
    assert response.status_code == 401
    assert "set-cookie" not in response.headers


def example_review(report_id: UUID) -> ReviewView:
    return ReviewView(
        id=uuid4(),
        report_id=report_id,
        reviewer_id=REVIEWER_ID,
        from_state=VerificationStatus.unverified,
        to_state=VerificationStatus.confirmed,
        reason="Attempt",
        reviewed_at=datetime.now(UTC),
    )


def test_bearer_key_binds_the_review_to_the_configured_reviewer() -> None:
    report_id = uuid4()
    with (
        patch(
            "accessforge_api.reviews.review_repository.review_report",
            return_value=example_review(report_id),
        ) as review,
        TestClient(reviewer_app()) as client,
    ):
        response = client.post(
            f"/reports/{report_id}/reviews",
            headers={"Authorization": f"Bearer {REVIEWER_KEY}"},
            json={**REVIEW, "reason": "  Attempt  "},
        )
    assert response.status_code == 201
    assert response.json()["data"]["to_state"] == "confirmed"
    assert review.call_args.kwargs == {"reviewer_id": REVIEWER_ID}
    assert review.call_args.args[1:] == (
        report_id,
        ReviewInput(status="verified", reason="Attempt"),
    )


def test_review_body_cannot_name_a_reviewer() -> None:
    with TestClient(reviewer_app()) as client:
        response = client.post(
            f"/reports/{uuid4()}/reviews",
            headers={"Authorization": f"Bearer {REVIEWER_KEY}"},
            json={**REVIEW, "reviewer_id": str(uuid4())},
        )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "failure,status", [(ReportNotFound("x"), 404), (ReviewConflict("x"), 409)]
)
def test_missing_and_already_reviewed_reports_are_distinguished(
    failure: Exception, status: int
) -> None:
    headers = {"Authorization": f"Bearer {REVIEWER_KEY}"}
    path = f"/reports/{uuid4()}/reviews"
    with (
        patch(
            "accessforge_api.reviews.review_repository.review_report",
            side_effect=failure,
        ),
        patch(
            "accessforge_api.reviews.review_repository.review_history",
            side_effect=failure,
        ),
        TestClient(reviewer_app()) as client,
    ):
        assert client.post(path, headers=headers, json=REVIEW).status_code == status
        if status == 404:
            assert client.get(path, headers=headers).status_code == 404


def test_session_cookie_is_http_only_strict_and_rejects_cross_site_writes() -> None:
    report_id = uuid4()
    with (
        patch(
            "accessforge_api.reviews.review_repository.review_report",
            return_value=example_review(report_id),
        ),
        patch(
            "accessforge_api.reviews.review_repository.review_history",
            return_value=(example_review(report_id),),
        ),
        TestClient(reviewer_app(), base_url="https://testserver") as client,
    ):
        signed_in = client.post("/reviewer/session", json={"key": REVIEWER_KEY})
        assert signed_in.status_code == 200
        assert signed_in.json()["data"] == {"reviewer_id": str(REVIEWER_ID)}
        cookie = signed_in.headers["set-cookie"].lower()
        assert all(flag in cookie for flag in ("httponly", "secure", "samesite=strict"))
        assert REVIEWER_KEY not in signed_in.text

        path = f"/reports/{report_id}/reviews"
        assert client.get("/reviewer/session").status_code == 200
        assert client.post(path, json=REVIEW).status_code == 201
        assert client.get(path).json()["data"][0]["reviewer_id"] == str(REVIEWER_ID)
        for site in ("cross-site", "same-site", "none"):
            forged = client.post(path, json=REVIEW, headers={"Sec-Fetch-Site": site})
            assert forged.status_code == 401

        assert client.delete("/reviewer/session").status_code == 204
        assert client.get("/reviewer/session").status_code == 401


def test_repeated_wrong_keys_lock_out_before_a_right_key_is_evaluated() -> None:
    with TestClient(reviewer_app()) as client:
        for _ in range(REPORTS_PER_WINDOW):
            assert (
                client.post("/reviewer/session", json={"key": "wrong"}).status_code
                == 401
            )
        locked = client.post("/reviewer/session", json={"key": REVIEWER_KEY})
        assert locked.status_code == 429
        assert int(locked.headers["Retry-After"]) >= 1
        bearer = client.get(
            "/reviewer/session", headers={"Authorization": f"Bearer {REVIEWER_KEY}"}
        )
        assert bearer.status_code == 429


@pytest.mark.parametrize(
    "value",
    ["not-a-pair", f"{uuid4()}:abc", f"nobody:{KEY_DIGEST}", f"{uuid4()}:{'g' * 64}"],
)
def test_malformed_reviewer_keys_fail_at_startup_without_echoing_input(
    value: str,
) -> None:
    with pytest.raises(ValidationError) as error:
        Settings(database_url=UNIT_DATABASE_URL, reviewer_keys=value, _env_file=None)
    assert value not in str(error.value)


def test_reviewer_keys_parse_case_insensitively_and_ignore_blanks() -> None:
    keys = parse_reviewer_keys(f" {REVIEWER_ID}:{KEY_DIGEST.upper()} , ,")
    assert reviewer_for_key(REVIEWER_KEY, keys) == REVIEWER_ID
    assert reviewer_for_key("other", keys) is None
