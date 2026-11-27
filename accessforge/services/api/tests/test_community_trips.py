from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text
from sqlalchemy.orm import Session
from test_api import application
from test_reviews import REVIEWER_KEY, reviewer_app

from accessforge_api.database import get_session

PAYLOAD = {
    "start_key": "osm:node/11",
    "end_key": "osm:way/22",
    "purpose": "public_transit",
}


@pytest.mark.parametrize(
    "invalid",
    [
        {"start_key": "home address"},
        {"end_key": PAYLOAD["start_key"]},
        {"purpose": "private routine"},
        {"source": "city"},
        {"reporter_email": "private@example.com"},
    ],
)
def test_rejects_invalid_or_personal_input(invalid: dict[str, str]) -> None:
    with TestClient(application()) as client:
        assert client.post("/trips", json=PAYLOAD | invalid).status_code == 422


@pytest.fixture
def client(postgis_engine: Engine) -> Iterator[TestClient]:
    app = reviewer_app()

    def real_session() -> Iterator[Session]:
        with Session(postgis_engine) as session:
            yield session

    app.dependency_overrides[get_session] = real_session
    with postgis_engine.begin() as conn:
        conn.execute(
            text("""
        INSERT INTO data_source VALUES ('osm','OSM','ODbL','https://www.openstreetmap.org','test',now());
        INSERT INTO network_node(id, geom, kind, source_id, source_ref) VALUES
          ('00000000-0000-4000-8000-000000000001', ST_SetSRID(ST_Point(-121.978,37.556),4326),'junction','osm','node/1'),
          ('00000000-0000-4000-8000-000000000002', ST_SetSRID(ST_Point(-121.977,37.556),4326),'junction','osm','node/2');
        INSERT INTO destination(geom,category,name,node_id,source_id,source_ref)
          SELECT geom,'transit','Station',id,'osm','node/11' FROM network_node WHERE source_ref='node/1'
          UNION ALL SELECT geom,'civic','Library',id,'osm','way/22' FROM network_node WHERE source_ref='node/2'
          UNION ALL SELECT ST_SetSRID(ST_Point(0,0),4326),'park','Outside',id,'osm','node/33' FROM network_node WHERE source_ref='node/2';
        INSERT INTO network_edge(from_node,to_node,geom,length_m,kind,source_id,source_ref)
          SELECT a.id,b.id,ST_MakeLine(a.geom,b.geom),90,'sidewalk','osm','way/9'
          FROM network_node a,network_node b WHERE a.source_ref='node/1' AND b.source_ref='node/2';
        """)
        )
    with TestClient(app) as connection:
        yield connection


def test_nominate_list_and_retrieve_without_disclosing_identity(
    client: TestClient, postgis_engine: Engine
) -> None:
    catalog = client.get("/trips").json()["data"]
    assert [l["name"] for l in catalog["landmarks"]] == ["Library", "Station"]
    assert catalog["trips"] == []
    for key in ("osm:node/33", "osm:node/999"):
        assert client.post("/trips", json=PAYLOAD | {"end_key": key}).status_code == 422
    assert client.post("/trips", json=PAYLOAD | {"source": "field"}).status_code == 401
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(
            pool.map(lambda _: client.post("/trips", json=PAYLOAD), range(2))
        )
    assert sorted(r.status_code for r in results) == [200, 201]
    assert results[0].json() == results[1].json()
    trip_id = UUID(results[0].json()["data"]["id"])
    path = f"/trips/{trip_id}"
    assert results[0].headers["Location"] == path
    initial = client.get(path).json()["data"]
    assert initial["analysis"]["baseline_reachable"] and initial["events"] == []
    assert initial["field_nominated"] is False
    assert (
        client.post(
            "/trips",
            json=PAYLOAD | {"source": "field"},
            headers={"Authorization": f"Bearer {REVIEWER_KEY}"},
        ).status_code
        == 200
    )
    with postgis_engine.begin() as conn:
        conn.execute(
            text("INSERT INTO trip_support VALUES (:id, repeat('a',64))"),
            {"id": trip_id},
        )
        conn.execute(
            text(
                "INSERT INTO trip_event(trip_id,kind,observed_on,reviewer_id) VALUES (:id,'field_obstructed',CURRENT_DATE,:reviewer)"
            ),
            {"id": trip_id, "reviewer": uuid4()},
        )
        conn.execute(text("DELETE FROM destination WHERE source_ref='node/11'"))
    detail = client.get(path).json()["data"]
    assert detail["analysis"] is None and detail["start_name"] == "Station"
    assert detail["field_nominated"] and detail["supports"] == 1
    assert set(detail["events"][0]) == {
        "kind",
        "observed_on",
        "recorded_at",
        "reference",
        "report_id",
    }
    listing = client.get("/trips?limit=1").json()
    assert listing["meta"] == {"page": 1, "limit": 1, "total": 1}
    assert set(listing["data"]["trips"][0]) == {
        "id",
        "start_name",
        "end_name",
        "purpose",
        "field_nominated",
        "supports",
    }
    assert client.get("/trips?page=2&limit=1").json()["data"]["trips"] == []
    assert client.get(f"/trips/{uuid4()}").status_code == 404
    assert client.get("/trips/garbage").status_code == 422
