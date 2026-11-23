"""Loads into a real migrated PostGIS schema; no database mocks."""

from datetime import UTC, datetime
from typing import Any

import pytest
from conftest import AREA, node, way
from sqlalchemy import Engine, text

from accessforge_ingest import cli, load, osm
from accessforge_ingest.census import Origin
from accessforge_ingest.connectivity import largest_component

# The first origin sits exactly on node 1; the second is ~11 m from node 5 and snaps to it.
ORIGINS = (
    Origin("060014418001000", 37.001, -121.999, 120, 0.2),
    Origin("060014419001000", 37.0031, -121.9971, 40, None),
)


def _load(engine: Engine, elements: list[dict[str, Any]]) -> load.LoadSummary:
    network, _ = largest_component(osm.parse(elements, AREA))
    with engine.begin() as connection:
        return load.load(
            connection, cli.sources(datetime(2026, 11, 17, tzinfo=UTC)), network, ORIGINS,
            cli.OSM_SOURCE, cli.BLOCKS_SOURCE, cli.PLACES_SOURCE,
        )  # fmt: skip


@pytest.mark.integration
def test_load_writes_network_with_metric_lengths_and_snapped_points(
    postgis_engine: Engine, elements: list[dict[str, Any]]
) -> None:
    summary = _load(postgis_engine, elements)
    # The clinic is ~140 m from node 5 and snaps; the park centroid is beyond MAX_LINK_M.
    assert summary == load.LoadSummary(5, 3, 1, 2, 1, 0, 1, 0)
    with postgis_engine.connect() as c:
        length = c.scalar(
            text("SELECT length_m FROM network_edge WHERE source_ref='way/11:0'")
        )
        # node 3 -> node 4: 0.001 deg of longitude at 37.003 N is about 88.8 m
        assert length == pytest.approx(88.8, abs=0.5)
        origin = c.execute(text(
            "SELECT n.source_ref, o.disability_source_id FROM origin o"
            " JOIN network_node n ON n.id = o.node_id ORDER BY o.id"
        )).all()  # fmt: skip
        assert origin == [("node/1", "cdc_places_2025"), ("node/5", None)]
        assert c.scalar(
            text("SELECT license FROM data_source WHERE id='osm'")
        ).startswith("ODbL")


@pytest.mark.integration
def test_reload_replaces_network_but_keeps_reviewed_barriers(
    postgis_engine: Engine, elements: list[dict[str, Any]]
) -> None:
    _load(postgis_engine, elements)
    with postgis_engine.begin() as c:
        c.execute(text("UPDATE barrier SET state = 'confirmed'"))
    summary = _load(postgis_engine, elements)
    assert (summary.barriers_added, summary.barriers_already_present) == (0, 1)
    with postgis_engine.connect() as c:
        rows = c.execute(text(
            "SELECT b.state, b.type, b.presence_prob, e.source, e.source_ref, e.source_version,"
            " e.observed_at FROM barrier b JOIN evidence_provenance e ON e.barrier_id = b.id"
        )).all()  # fmt: skip
        assert c.scalar(text("SELECT count(*) FROM network_edge")) == 3
    assert len(rows) == 1
    state, kind, prob, source, ref, version, observed = rows[0]
    assert (state, kind, prob, source, ref, version) == (
        "confirmed", "missing_curb_ramp", 0.5, "open_map_data", "osm:node/4", "v2",
    )  # fmt: skip
    assert observed == datetime(2025, 1, 2, 3, 4, 5, tzinfo=UTC)


@pytest.mark.integration
def test_trip_endpoints_skip_shape_points_and_private_footways(
    postgis_engine: Engine, elements: list[dict[str, Any]]
) -> None:
    # Node 2 is an interior shape point of way 10 (1-2-3): an origin placed exactly on it must skip
    # it and snap to an endpoint. Nodes 1 and 3 are equidistant; the tie breaks on source_ref.
    # Node 41 shares node 3's position and is a destination.
    source = [
        *elements,
        node(41, 37.003, -121.999, amenity="clinic"),
        way(42, [41, 3], highway="footway", foot="private"),
    ]
    network, _ = largest_component(osm.parse(source, AREA))
    shape_side = (Origin("060014420001000", 37.002, -121.999, 10, None),)
    with postgis_engine.begin() as connection:
        load.load(
            connection, cli.sources(datetime(2026, 11, 17, tzinfo=UTC)), network,
            shape_side, cli.OSM_SOURCE, cli.BLOCKS_SOURCE, cli.PLACES_SOURCE,
        )  # fmt: skip
    with postgis_engine.connect() as c:
        ref = c.scalar(text(
            "SELECT n.source_ref FROM origin o JOIN network_node n ON n.id = o.node_id"
        ))  # fmt: skip
        destination = c.scalar(text(
            "SELECT n.source_ref FROM destination d JOIN network_node n ON n.id = d.node_id"
            " WHERE d.source_ref = 'node/41'"
        ))  # fmt: skip
    assert ref == "node/1"
    assert destination == "node/3"
