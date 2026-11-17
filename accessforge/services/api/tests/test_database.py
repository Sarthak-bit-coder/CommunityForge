"""These tests require real PostgreSQL/PostGIS; SQLite and repository mocks are not used."""

import os
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from fastapi.testclient import TestClient
from geoalchemy2 import WKTElement
from sqlalchemy import Connection, Engine, inspect, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session

from accessforge_api.config import Settings
from accessforge_api.database import Base
from accessforge_api.main import create_app
from accessforge_api.models import Barrier, EvidenceProvenance, Location
from accessforge_api.schemas import BarrierType, EvidenceSource, VerificationStatus

pytestmark = pytest.mark.integration


def test_persist_spatial_barrier_and_evidence(postgis_engine: Engine) -> None:
    with Session(postgis_engine) as session:
        location = Location(geom=WKTElement("POINT(-121.9886 37.5485)", srid=4326))
        session.add(location)
        session.flush()
        barrier = Barrier(
            location_id=location.id,
            type=BarrierType.obstruction,
            description="Synthetic test barrier",
            severity=3,
            presence_prob=0.5,
        )
        session.add(barrier)
        session.flush()
        evidence = EvidenceProvenance(
            barrier_id=barrier.id,
            source=EvidenceSource.city_record,
            source_ref="synthetic-test-record",
            observed_at=datetime.now(UTC),
        )
        session.add(evidence)
        session.commit()
        session.expire_all()
        assert session.get(Barrier, barrier.id).state == VerificationStatus.unverified
        assert (
            session.scalar(select(EvidenceProvenance.source_ref))
            == "synthetic-test-record"
        )
        point = session.execute(
            text("SELECT ST_SRID(geom), ST_X(geom), ST_Y(geom) FROM location")
        ).one()
        assert point[0] == 4326
        assert point[1] == pytest.approx(-121.9886)
        assert point[2] == pytest.approx(37.5485)
        assert (
            session.get(EvidenceProvenance, evidence.id).recorded_at.tzinfo is not None
        )


@pytest.mark.parametrize(
    "point,srid",
    [
        ("POINT(181 0)", 4326),
        ("POINT(0 91)", 4326),
        ("POINT EMPTY", 4326),
        ("POINT(0 0)", 3857),
    ],
)
def test_database_rejects_invalid_geometry(
    postgis_engine: Engine, point: str, srid: int
) -> None:
    with postgis_engine.connect() as connection:
        with pytest.raises(DBAPIError):
            connection.execute(
                text(
                    "INSERT INTO location (geom) VALUES (ST_GeomFromText(:point, :srid))"
                ),
                {"point": point, "srid": srid},
            )
        connection.rollback()


@pytest.mark.parametrize(
    "field,value",
    [
        ("severity", 0),
        ("severity", 6),
        ("presence_prob", -0.1),
        ("presence_prob", 1.1),
        ("state", "approved"),
        ("type", "unknown"),
        ("description", "   "),
    ],
)
def test_database_rejects_invalid_barrier_values(
    postgis_engine: Engine, field: str, value: object
) -> None:
    with postgis_engine.connect() as connection:
        location = connection.scalar(
            text(
                "INSERT INTO location (geom) VALUES (ST_SetSRID(ST_MakePoint(0,0),4326)) RETURNING id"
            )
        )
        connection.commit()
        values = {
            "location": location,
            "type": "obstruction",
            "description": "Synthetic example",
            "severity": 3,
            "state": "unverified",
            "presence_prob": 1,
        }
        values[field] = value
        with pytest.raises(IntegrityError):
            connection.execute(
                text(
                    "INSERT INTO barrier(location_id,type,description,severity,state,presence_prob) VALUES (:location,:type,:description,:severity,:state,:presence_prob)"
                ),
                values,
            )
        connection.rollback()


def test_database_enforces_provenance_reference(postgis_engine: Engine) -> None:
    with postgis_engine.connect() as connection:
        with pytest.raises(IntegrityError):
            connection.execute(
                text(
                    "INSERT INTO evidence_provenance(barrier_id,source,source_ref,observed_at) VALUES (:id,'city_record','synthetic',now())"
                ),
                {"id": uuid4()},
            )
        connection.rollback()


def _schema_drift(connection: Connection) -> list[object]:
    # PostGIS owns spatial_ref_sys in the public schema; it is not application schema.
    context = MigrationContext.configure(
        connection,
        opts={"include_name": lambda name, kind, _: name != "spatial_ref_sys"},
    )
    return list(compare_metadata(context, Base.metadata))


def test_migration_roundtrip_and_metadata_match(
    postgis_engine: Engine, migration_config: Config
) -> None:
    with postgis_engine.begin() as connection:
        migration_config.attributes["connection"] = connection
        assert _schema_drift(connection) == []
        indexes = inspect(connection).get_indexes("location")
        assert any(index["name"] == "idx_location_geom" for index in indexes)
        command.downgrade(migration_config, "base")
        assert not {
            "barrier",
            "location",
            "evidence_provenance",
            "report",
            "report_review",
        } & set(inspect(connection).get_table_names())
        assert connection.scalar(text("SELECT PostGIS_Version()"))
        command.upgrade(migration_config, "head")
        assert _schema_drift(connection) == []


def test_readiness_on_real_postgis(postgis_engine: Engine) -> None:
    settings = Settings(database_url=os.environ["TEST_DATABASE_URL"], _env_file=None)
    with TestClient(create_app(settings)) as client:
        response = client.get("/health/ready")
        assert response.status_code == 200
        assert response.json()["data"] == {"status": "ready"}
