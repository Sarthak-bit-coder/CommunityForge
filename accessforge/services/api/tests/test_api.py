import json
import logging
from uuid import UUID

import pytest
from conftest import UNIT_DATABASE_URL
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from accessforge_api.config import Settings
from accessforge_api.logging import JsonFormatter
from accessforge_api.main import create_app
from accessforge_api.schemas import LocationInput


def application() -> FastAPI:
    return create_app(Settings(database_url=UNIT_DATABASE_URL, _env_file=None))


def test_liveness_requires_no_database_connection_and_disposes_engine() -> None:
    app = application()
    with TestClient(app) as client:
        response = client.get("/health/live")
        assert response.status_code == 200
        assert response.json() == {"data": {"status": "ok"}, "error": None, "meta": {}}
        UUID(response.headers["X-Request-ID"])
        assert app.state.engine.url.database == "accessforge_test"


def test_readiness_fails_safely_when_database_is_unavailable() -> None:
    with TestClient(application()) as client:
        response = client.get("/health/ready")
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "database_unavailable"
        assert "placeholder" not in response.text
        assert "SELECT" not in response.text


def test_only_documented_routes_exist() -> None:
    app = application()
    assert set(app.openapi()["paths"]) == {
        "/feedback",
        "/health/live",
        "/health/ready",
        "/network/streets",
        "/planning/plans",
        "/reports",
        "/reports/summary",
        "/reports/{report_id}",
        "/reports/{report_id}/reviews",
        "/reviewer/session",
        "/routing/analysis",
        "/trips",
        "/trips/{trip_id}",
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/reports", json={"description": "not stored"})
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "http_error"


def test_invalid_payload_uses_sanitized_field_errors() -> None:
    app = application()

    @app.post("/_test_validation")
    def check_location(location: LocationInput) -> LocationInput:
        return location

    with TestClient(app) as client:
        response = client.post(
            "/_test_validation", json={"latitude": "private-input", "longitude": 0}
        )
        assert response.status_code == 422
        error = response.json()["error"]
        assert error["code"] == "validation_error"
        assert error["details"][0]["field"] == "body.latitude"
        assert "private-input" not in response.text
        assert "input" not in error["details"][0]


def test_unexpected_errors_do_not_leak_details() -> None:
    app = application()

    @app.get("/_test_error")
    def fail() -> None:
        raise RuntimeError("private internal details")

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/_test_error")
        assert response.status_code == 500
        assert response.json()["error"]["code"] == "internal_error"
        assert "private internal details" not in response.text
        UUID(response.headers["X-Request-ID"])


def test_http_error_preserves_required_headers_but_hides_arbitrary_detail() -> None:
    app = application()

    @app.get("/_test_http")
    def fail() -> None:
        raise HTTPException(405, "private detail", headers={"Allow": "GET"})

    with TestClient(app) as client:
        response = client.get("/_test_http")
        assert response.status_code == 405
        assert response.headers["Allow"] == "GET"
        assert "private detail" not in response.text


def test_startup_requires_database_configuration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.chdir("/private/tmp")
    with pytest.raises(ValidationError), TestClient(create_app()):
        pass


def test_json_logger_has_only_allowlisted_fields() -> None:
    record = logging.LogRecord(
        "test", logging.WARNING, "", 0, "database_unavailable", (), None
    )
    record.request_id = "example-id"
    record.body = "private payload"
    result = json.loads(JsonFormatter().format(record))
    assert result["event"] == "database_unavailable"
    assert result["request_id"] == "example-id"
    assert "private payload" not in str(result)
    assert result["level"] == "WARNING"
