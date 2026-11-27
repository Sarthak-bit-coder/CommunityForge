"""The Fremont pilot dataset: built from real PostGIS rows and served only once precomputed."""

from collections.abc import Iterator
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text
from test_api import application

from accessforge_api import pilot_plans
from accessforge_api.pilot_network import REPAIR_UNIT_COST, load_pilot_network
from accessforge_api.planning import PLAN_NOT_READY_RETRY_S
from accessforge_api.planning_schemas import PlanningDataset, PlanningMethod

N1, N2, N3 = (f"00000000-0000-4000-8000-00000000000{i}" for i in (1, 2, 3))
# A home at n1, a clinic at n3, and one raised curb at n2 on the only path between them.
TINY_PILOT = f"""
    INSERT INTO data_source VALUES
      ('osm', 'OpenStreetMap', 'ODbL 1.0', 'https://www.openstreetmap.org', 't', now()),
      ('blocks', 'Census blocks', 'Public domain', 'https://www.census.gov', 't', now());
    INSERT INTO network_node (id, geom, kind, source_id, source_ref) VALUES
      ('{N1}', ST_SetSRID(ST_MakePoint(-121.980, 37.55), 4326), 'junction', 'osm', 'n1'),
      ('{N2}', ST_SetSRID(ST_MakePoint(-121.979, 37.55), 4326), 'curb_ramp', 'osm', 'n2'),
      ('{N3}', ST_SetSRID(ST_MakePoint(-121.978, 37.55), 4326), 'junction', 'osm', 'n3');
    INSERT INTO network_edge (from_node, to_node, geom, length_m, kind, source_id, source_ref)
    VALUES
      ('{N1}', '{N2}', ST_GeomFromText('LINESTRING(-121.980 37.55, -121.979 37.55)', 4326),
       88, 'sidewalk', 'osm', 'w1'),
      ('{N2}', '{N3}', ST_GeomFromText('LINESTRING(-121.979 37.55, -121.978 37.55)', 4326),
       88, 'crossing', 'osm', 'w2');
    INSERT INTO origin (id, geom, population, node_id, source_id) VALUES
      ('060014418001000', ST_SetSRID(ST_MakePoint(-121.980, 37.55), 4326), 40, '{N1}',
       'blocks');
    INSERT INTO destination (geom, category, name, node_id, source_id, source_ref) VALUES
      (ST_SetSRID(ST_MakePoint(-121.978, 37.55), 4326), 'healthcare', 'Clinic', '{N3}',
       'osm', 'node/9');
    WITH loc AS (
      INSERT INTO location (geom) VALUES (ST_SetSRID(ST_MakePoint(-121.979, 37.55), 4326))
      RETURNING id
    )
    INSERT INTO barrier (location_id, type, description, severity, presence_prob)
    SELECT id, 'missing_curb_ramp', 'Raised curb', 3, 1.0 FROM loc;
"""


@pytest.fixture
def tiny_pilot(postgis_engine: Engine) -> Iterator[Engine]:
    with postgis_engine.begin() as connection:
        connection.execute(text(TINY_PILOT))
    load_pilot_network.cache_clear()
    yield postgis_engine
    load_pilot_network.cache_clear()


@pytest.mark.integration
def test_pilot_network_is_built_from_postgis_rows(tiny_pilot: Engine) -> None:
    pilot = load_pilot_network(tiny_pilot)

    assert pilot is not None
    instance = pilot.network.instance
    assert len(instance.nodes) == 3
    assert len(instance.edges) == 2
    (barrier,) = instance.barriers
    assert barrier.node_id == N2
    (repair,) = instance.repairs
    assert repair.cost == REPAIR_UNIT_COST
    assert pilot.destination_names == {instance.destinations[0].id: "Clinic"}
    assert min(x for x, _ in pilot.network.positions.values()) == 0


@pytest.mark.integration
def test_precomputed_plan_repairs_the_curb_that_blocks_the_only_path(
    tiny_pilot: Engine,
) -> None:
    with (
        patch.dict(pilot_plans._plans, clear=True),
        patch.object(pilot_plans, "_network", []),
    ):
        pilot_plans._compute(tiny_pilot)
        plan = pilot_plans.pilot_plan(1.0)

    best = next(p for p in plan.plans if p.method == PlanningMethod.exhaustive)
    assert plan.synthetic is False
    assert best.selected_repair_ids == (plan.network.repairs[0].id,)
    assert best.delta_a > 0
    assert plan.network.destinations[0].name == "Clinic"


def test_pilot_budget_outside_the_precomputed_set_is_rejected() -> None:
    with TestClient(application()) as client:
        response = client.get(
            "/planning/plans",
            params={"dataset": PlanningDataset.fremont_pilot.value, "budget": 3},
        )
    assert response.status_code == 422


def test_pilot_plan_still_computing_answers_503_with_retry_after() -> None:
    with (
        patch.dict(pilot_plans._plans, clear=True),
        TestClient(application()) as client,
    ):
        response = client.get(
            "/planning/plans",
            params={"dataset": PlanningDataset.fremont_pilot.value, "budget": 1},
        )
    assert response.status_code == 503
    assert response.headers["Retry-After"] == PLAN_NOT_READY_RETRY_S
