"""Review policy and fail-closed HTTP checks; no mocked database repositories."""

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from test_api import application

from accessforge_api.review_schemas import (
    ReviewConflict,
    ReviewInput,
    ReviewStatus,
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


@pytest.mark.parametrize(
    "headers", [{}, {"Authorization": "Bearer fabricated", "X-Role": "admin"}]
)
def test_no_public_review_write_or_private_history_is_exposed(
    headers: dict[str, str],
) -> None:
    with TestClient(application()) as client:
        for suffix in ("reviews", "review", "verify", "transitions"):
            path = f"/reports/{uuid4()}/{suffix}"
            for method in ("POST", "PATCH", "PUT", "DELETE", "GET"):
                response = client.request(
                    method,
                    path,
                    headers=headers,
                    json={"status": "verified", "reason": "Attempt"},
                )
                assert response.status_code == 404
                assert response.json()["data"] is None
        paths = client.get("/openapi.json").json()["paths"]
        assert not any("review" in path or "transition" in path for path in paths)
