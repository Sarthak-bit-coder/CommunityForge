from datetime import UTC, datetime
from uuid import uuid4

import pytest
from conftest import UNIT_DATABASE_URL
from pydantic import ValidationError

from accessforge_api.config import Settings
from accessforge_api.schemas import (
    BarrierInput,
    EvidenceInput,
    LocationInput,
    VerificationStatus,
)


def test_settings_accept_only_explicit_postgres_driver_and_redact_secrets() -> None:
    settings = Settings(database_url=UNIT_DATABASE_URL, _env_file=None)
    assert settings.database_url.get_secret_value() == UNIT_DATABASE_URL
    assert "placeholder" not in repr(settings)
    for url in (
        "sqlite:///data.db",
        "postgresql://localhost/db",
        "not-a-url",
        "postgresql+psycopg://localhost",
    ):
        with pytest.raises(ValidationError) as error:
            Settings(database_url=url, _env_file=None)
        assert url not in str(error.value)


@pytest.mark.parametrize(
    "longitude,latitude",
    [
        (181, 0),
        (-181, 0),
        (0, 91),
        (0, -91),
        (float("nan"), 0),
        (float("inf"), 0),
        (True, 0),
        ("37", 0),
    ],
)
def test_location_rejects_invalid_coordinates(
    longitude: float, latitude: float
) -> None:
    with pytest.raises(ValidationError):
        LocationInput(longitude=longitude, latitude=latitude)


def test_valid_locations_are_frozen_and_reject_unknown_data() -> None:
    location = LocationInput(longitude=-180, latitude=90)
    with pytest.raises(ValidationError):
        location.latitude = 0  # type: ignore[misc]
    with pytest.raises(ValidationError):
        LocationInput.model_validate(
            {"longitude": 0, "latitude": 0, "reporter": "not stored"}
        )


def test_barrier_validation_defaults_and_limits() -> None:
    valid = {
        "location_id": uuid4(),
        "type": "obstruction",
        "description": " Example ",
        "severity": 3,
        "presence_prob": 0.5,
    }
    barrier = BarrierInput.model_validate(valid)
    assert barrier.description == "Example"
    assert barrier.state == VerificationStatus.unverified
    for changes in (
        {"severity": 0},
        {"severity": 6},
        {"severity": True},
        {"presence_prob": -0.1},
        {"presence_prob": 1.1},
        {"presence_prob": float("nan")},
        {"type": "unknown"},
        {"state": "approved"},
        {"description": " \n"},
        {"description": "a" * 2001},
    ):
        with pytest.raises(ValidationError):
            BarrierInput.model_validate({**valid, **changes})


def test_evidence_requires_aware_timestamp_and_source_reference() -> None:
    valid = {
        "barrier_id": uuid4(),
        "source": "city_record",
        "source_ref": "record-1",
        "source_version": "2026-11",
        "observed_at": datetime.now(UTC),
    }
    assert EvidenceInput.model_validate(valid).source_ref == "record-1"
    for changes in (
        {"observed_at": datetime(2026, 1, 1)},
        {"source_ref": " "},
        {"source_version": ""},
        {"source": "unlisted"},
    ):
        with pytest.raises(ValidationError):
            EvidenceInput.model_validate({**valid, **changes})
