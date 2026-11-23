from dataclasses import replace
from typing import Any

import pytest
from conftest import AREA

from accessforge_ingest import osm
from accessforge_ingest.areas import CANDIDATES, BBox, box_around
from accessforge_ingest.connectivity import largest_component


def test_parse_keeps_walkable_ways_and_splits_at_shared_nodes(
    elements: list[dict[str, Any]],
) -> None:
    network = osm.parse(elements, AREA)
    pieces = sorted((e.osm_way_id, e.node_ids, e.kind) for e in network.edges)
    assert pieces == [
        (10, (1, 2, 3), "sidewalk"),
        (11, (3, 4), "crossing"),
        (12, (4, 5), "street"),
        (13, (6, 7), "footway"),
    ]


def test_parse_finds_kerbs_ramps_and_destinations(
    elements: list[dict[str, Any]],
) -> None:
    network = osm.parse(elements, AREA)
    assert [k.osm_id for k in network.raised_kerbs] == [4]
    assert network.nodes[5].kind == "curb_ramp"
    assert network.nodes[1].kind == "junction"
    found = {(d.osm_ref, d.category) for d in network.destinations}
    assert found == {("node/20", "healthcare"), ("way/21", "park")}


def test_parse_drops_edges_wholly_outside_the_area(
    elements: list[dict[str, Any]],
) -> None:
    small = BBox(37.0, -122.0, 37.0025, -121.9985)  # only nodes 1 and 2 inside
    assert [e.osm_way_id for e in osm.parse(elements, small).edges] == [10]


def test_way_vertex_shared_by_two_ways_becomes_a_graph_node() -> None:
    elements = [
        {"type": "node", "id": i, "lat": 37.001 + i / 10_000, "lon": -121.995}
        for i in (1, 2, 3, 4)
    ] + [
        {"type": "way", "id": 1, "nodes": [1, 2, 3], "tags": {"highway": "footway"}},
        {"type": "way", "id": 2, "nodes": [2, 4], "tags": {"highway": "footway"}},
    ]
    edges = sorted(e.node_ids for e in osm.parse(elements, AREA).edges)
    assert edges == [(1, 2), (2, 3), (2, 4)]


def _line_nodes(*ids: int) -> list[dict[str, Any]]:
    return [
        {"type": "node", "id": i, "lat": 37.001 + i / 10_000, "lon": -121.995}
        for i in ids
    ]


def test_missing_node_never_bridges_a_gap() -> None:
    elements = _line_nodes(1, 3) + [
        {"type": "way", "id": 1, "nodes": [1, 2, 3], "tags": {"highway": "footway"}},
    ]
    assert osm.parse(elements, AREA).edges == ()


def test_validate_rejects_edge_referencing_a_missing_node() -> None:
    network = osm.parse(_line_nodes(1, 3, 4) + [
        {"type": "way", "id": 1, "nodes": [1, 3, 4], "tags": {"highway": "footway"}},
    ], AREA)  # fmt: skip
    broken = replace(network, nodes={1: network.nodes[1], 4: network.nodes[4]})
    with pytest.raises(ValueError, match="way/1 references missing"):
        osm.validate(broken)


def test_validate_rejects_coordinates_outside_the_earth() -> None:
    network = osm.parse(_line_nodes(1, 3) + [
        {"type": "way", "id": 1, "nodes": [1, 3], "tags": {"highway": "footway"}},
    ], AREA)  # fmt: skip
    bad = replace(network.nodes[1], lat=91.0)
    with pytest.raises(ValueError, match="node/1 has invalid coordinates"):
        osm.validate(replace(network, nodes={1: bad, 3: network.nodes[3]}))


def test_validate_accepts_a_parsed_network(elements: list[dict[str, Any]]) -> None:
    osm.validate(osm.parse(elements, AREA))


def test_way_splits_at_gap_and_keeps_contiguous_run() -> None:
    elements = _line_nodes(1, 3, 4, 5) + [
        {
            "type": "way",
            "id": 1,
            "nodes": [1, 2, 3, 4, 5],
            "tags": {"highway": "footway"},
        },
    ]
    edges = [e.node_ids for e in osm.parse(elements, AREA).edges]
    assert edges == [(3, 4, 5)]


@pytest.mark.parametrize(
    ("tags", "kind"),
    [
        ({"highway": "steps"}, "steps"),
        ({"highway": "cycleway"}, None),
        ({"highway": "cycleway", "foot": "yes"}, "footway"),
        ({"highway": "footway", "access": "private"}, None),
        ({"highway": "footway", "access": "private", "foot": "yes"}, "footway"),
        ({"highway": "residential", "foot": "no"}, None),
        ({"highway": "footway", "access": "yes", "foot": "private"}, None),
        ({"highway": "secondary", "sidewalk:both": "separate"}, None),
        ({"highway": "service"}, None),
        ({}, None),
    ],
)
def test_edge_kind(tags: dict[str, str], kind: str | None) -> None:
    assert osm.edge_kind(tags) == kind


def test_largest_component_drops_the_island(elements: list[dict[str, Any]]) -> None:
    network, report = largest_component(osm.parse(elements, AREA))
    assert report.components == 2
    assert (report.kept_edges, report.dropped_edges) == (3, 1)
    assert report.dropped_component_sizes == (1,)
    assert 6 not in network.nodes and 4 in network.nodes
    assert [k.osm_id for k in network.raised_kerbs] == [4]


def test_largest_component_rejects_an_empty_network() -> None:
    with pytest.raises(ValueError, match="no walkable edges"):
        largest_component(osm.parse([], AREA))


def test_fetch_merges_duplicate_elements_across_tiles(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []

    def fake(url: str, params: dict[str, str]) -> dict[str, Any]:
        calls.append(params["bbox"])
        return {"elements": [{"type": "node", "id": 1, "lat": 37.0, "lon": -122.0}]}

    monkeypatch.setattr(osm, "get_json", fake)
    assert len(osm.fetch(AREA)) == 1
    assert len(calls) == osm.TILE_ROWS * osm.TILE_COLS


def test_bbox_validation_and_box_size() -> None:
    with pytest.raises(ValueError):
        BBox(37.1, -122.0, 37.0, -121.9)
    with pytest.raises(ValueError):
        BBox(37.0, -121.9, 37.1, -122.0)
    box = box_around(37.5, -122.0, 800)
    assert box.north - box.south == pytest.approx(1600 / 111_320)
    assert box.contains(37.5, -122.0) and not box.contains(37.6, -122.0)
    assert "fremont_bart" in CANDIDATES
