"""Regression tests: unmoderated text stays private, and proxies cannot be spoofed."""

from hashlib import sha256
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest
from conftest import UNIT_DATABASE_URL
from fastapi.testclient import TestClient
from pydantic import ValidationError
from test_reports_unit import example_report

from accessforge_api.config import Settings
from accessforge_api.main import create_app
from accessforge_api.report_limits import _peer
from accessforge_api.report_schemas import redact_for_public
from accessforge_api.schemas import VerificationStatus

KEY = "reviewer-key-for-tests-only"
REVIEWER = uuid4()


def client() -> TestClient:
    settings = Settings(
        database_url=UNIT_DATABASE_URL,
        reviewer_keys=f"{REVIEWER}:{sha256(KEY.encode()).hexdigest()}",
        _env_file=None,
    )
    return TestClient(create_app(settings))


@pytest.mark.parametrize("state", list(VerificationStatus))
def test_only_confirmed_or_later_text_is_public(state: VerificationStatus) -> None:
    report = example_report().model_copy(update={"state": state})
    hidden = state in (VerificationStatus.unverified, VerificationStatus.rejected)
    assert (redact_for_public(report).description is None) is hidden


@pytest.mark.parametrize("path", ["/reports", "/reports/{id}"])
def test_anonymous_reads_hide_pending_text_and_reviewers_see_it(path: str) -> None:
    report = example_report()
    with (
        patch(
            "accessforge_api.reports.report_repository.list_reports",
            return_value=((report,), 1),
        ),
        patch(
            "accessforge_api.reports.report_repository.get_report", return_value=report
        ),
        client() as http,
    ):
        url = path.format(id=report.id)
        public = http.get(url)
        private = http.get(url, headers={"Authorization": f"Bearer {KEY}"})
        wrong = http.get(url, headers={"Authorization": "Bearer wrong"})

    def text(response):  # type: ignore[no-untyped-def]
        data = response.json()["data"]
        return (data[0] if isinstance(data, list) else data)["description"]

    assert text(public) is None
    assert "Cache-Control" not in public.headers
    assert text(private) == "Example barrier"
    assert private.headers["Cache-Control"] == "private, no-store"
    assert wrong.status_code == 401


def _request(host: str, forwarded: str | None, trusted: frozenset[str]) -> object:
    headers = {"X-Forwarded-For": forwarded} if forwarded is not None else {}
    return SimpleNamespace(
        client=SimpleNamespace(host=host),
        headers=headers,
        app=SimpleNamespace(state=SimpleNamespace(trusted_proxies=trusted)),
    )


@pytest.mark.parametrize(
    "host,forwarded,trusted,expected",
    [
        ("203.0.113.9", "198.51.100.1", frozenset(), "203.0.113.9"),
        ("10.0.0.2", "1.1.1.1, 198.51.100.7", frozenset({"10.0.0.2"}), "198.51.100.7"),
        ("10.0.0.2", "not-an-ip", frozenset({"10.0.0.2"}), "10.0.0.2"),
        ("10.0.0.2", None, frozenset({"10.0.0.2"}), "10.0.0.2"),
    ],
)
def test_forwarded_address_trusted_only_from_configured_proxy(
    host: str, forwarded: str | None, trusted: frozenset[str], expected: str
) -> None:
    assert _peer(_request(host, forwarded, trusted)) == expected  # type: ignore[arg-type]


def test_invalid_trusted_proxy_setting_fails_startup() -> None:
    with pytest.raises(ValidationError):
        Settings(
            database_url=UNIT_DATABASE_URL,
            trusted_proxy_ips="proxy.local",
            _env_file=None,
        )
