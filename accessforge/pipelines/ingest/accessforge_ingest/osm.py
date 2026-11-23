"""Turn OSM map data into a pedestrian network, raised-kerb barriers and destinations."""

from collections import Counter
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import Any

from .areas import BBox
from .http import get_json

OSM_MAP_URL = "https://api.openstreetmap.org/api/0.6/map.json"
TILE_ROWS = TILE_COLS = 2  # keeps each request under the API's 50k-node limit

STREET_HIGHWAYS = frozenset({
    "primary", "primary_link", "secondary", "secondary_link", "tertiary",
    "tertiary_link", "residential", "unclassified", "living_street",
})  # fmt: skip
PATH_HIGHWAYS = frozenset({"footway", "path", "pedestrian", "steps", "cycleway"})
CURB_RAMP_KERBS = frozenset({"lowered", "flush"})
RAISED_KERB = "raised"
MIN_EDGE_NODES = 2  # an edge joins at least two stored nodes
MAX_LAT, MAX_LON = 90.0, 180.0  # WGS84 limits

# (tag key, tag value) -> destination category; first match wins.
DESTINATION_TAGS: tuple[tuple[str, frozenset[str], str], ...] = (
    ("shop", frozenset({"supermarket", "grocery", "greengrocer"}), "grocery"),
    ("amenity", frozenset({"hospital", "clinic", "doctors", "dentist", "pharmacy"}), "healthcare"),
    ("healthcare", frozenset({"hospital", "clinic", "doctor", "pharmacy", "dentist"}), "healthcare"),
    ("railway", frozenset({"station"}), "transit"),
    ("highway", frozenset({"bus_stop"}), "transit"),
    ("amenity", frozenset({"school", "college", "library", "kindergarten"}), "education"),
    ("amenity", frozenset({"townhall", "post_office", "community_centre", "social_facility"}), "civic"),
    ("leisure", frozenset({"park"}), "park"),
)  # fmt: skip


@dataclass(frozen=True)
class Node:
    osm_id: int
    lat: float
    lon: float
    kind: str  # junction | curb_ramp
    version: int | None = None  # OSM element version, kept as evidence provenance
    timestamp: str | None = None  # OSM last-edit time (ISO 8601)


@dataclass(frozen=True)
class Edge:
    osm_way_id: int
    node_ids: tuple[int, ...]  # first and last are graph nodes
    kind: str  # sidewalk | crossing | footway | steps | street
    surface: str | None


@dataclass(frozen=True)
class Destination:
    osm_ref: str  # e.g. "node/123", "way/456"
    lat: float
    lon: float
    category: str
    name: str | None


@dataclass(frozen=True)
class Network:
    nodes: Mapping[int, Node]  # graph nodes and shape points
    edges: tuple[Edge, ...]
    raised_kerbs: tuple[Node, ...]
    destinations: tuple[Destination, ...]


def fetch(bbox: BBox) -> list[dict[str, Any]]:
    """Download all tiles; elements repeat across tiles, so merge by (type, id)."""
    merged: dict[tuple[str, int], dict[str, Any]] = {}
    for tile in bbox.tiles(TILE_ROWS, TILE_COLS):
        query = {"bbox": f"{tile.west},{tile.south},{tile.east},{tile.north}"}
        data = get_json(OSM_MAP_URL, query)
        for element in data.get("elements", []):
            merged[(element["type"], element["id"])] = element
    return list(merged.values())


def edge_kind(tags: Mapping[str, str]) -> str | None:
    """Pedestrian kind of a way, or None when people on foot cannot or should not use it."""
    highway = tags.get("highway")
    if tags.get("foot") in {"no", "private"} or (
        tags.get("access") in {"private", "no"}
        and tags.get("foot") not in {"yes", "designated"}
    ):
        return None
    if highway in PATH_HIGHWAYS:
        if highway == "cycleway" and tags.get("foot") not in {"yes", "designated"}:
            return None
        if highway == "steps":
            return "steps"
        footway = tags.get("footway")
        if footway in {"sidewalk", "crossing"}:
            return footway
        return "footway"
    if highway in STREET_HIGHWAYS:
        # Sidewalks mapped as their own ways replace the road for walking.
        sidewalk = {
            tags.get(k)
            for k in ("sidewalk", "sidewalk:both", "sidewalk:left", "sidewalk:right")
        }
        return None if "separate" in sidewalk else "street"
    return None


def destination_category(tags: Mapping[str, str]) -> str | None:
    for key, values, category in DESTINATION_TAGS:
        if tags.get(key) in values:
            return category
    return None


def parse(elements: Iterable[Mapping[str, Any]], bbox: BBox) -> Network:
    elements = list(elements)
    raw_nodes = {e["id"]: e for e in elements if e["type"] == "node"}
    ways = [e for e in elements if e["type"] == "way"]
    walk_ways = [
        (w, kind) for w in ways if (kind := edge_kind(w.get("tags", {}))) is not None
    ]
    graph_ids = _graph_node_ids(walk_ways)
    edges = tuple(
        e for w, kind in walk_ways for e in _split_way(w, kind, raw_nodes, graph_ids)
        if any(_inside(raw_nodes[n], bbox) for n in e.node_ids)
    )  # fmt: skip
    used = {n for e in edges for n in e.node_ids}
    nodes = {n: _node(raw_nodes[n]) for n in used}
    kerbs = tuple(
        _node(raw_nodes[n])
        for n in sorted(used)
        if raw_nodes[n].get("tags", {}).get("kerb") == RAISED_KERB
    )
    return Network(nodes, edges, kerbs, _destinations(elements, raw_nodes, bbox))


def _graph_node_ids(walk_ways: list[tuple[Mapping[str, Any], str]]) -> frozenset[int]:
    """Way endpoints and nodes shared by two or more ways become graph vertices."""
    counts = Counter(n for w, _ in walk_ways for n in w["nodes"])
    ends = {n for w, _ in walk_ways for n in (w["nodes"][0], w["nodes"][-1])}
    return frozenset(ends | {n for n, c in counts.items() if c > 1})


def _split_way(
    way: Mapping[str, Any],
    kind: str,
    raw_nodes: Mapping[int, Any],
    graph_ids: frozenset[int],
) -> list[Edge]:
    surface = way.get("tags", {}).get("surface")
    return [
        Edge(way["id"], piece, kind, surface)
        for run in _present_runs(way["nodes"], raw_nodes)
        for piece in _pieces(run, graph_ids)
    ]


def _present_runs(refs: list[int], raw_nodes: Mapping[int, Any]) -> list[list[int]]:
    """Contiguous stretches of refs present in the extract. A missing node ends the run."""
    runs: list[list[int]] = [[]]
    for ref in refs:
        if ref in raw_nodes:
            runs[-1].append(ref)
        else:
            runs.append([])  # never connect across a node the extract lacks
    return runs


def _pieces(run: list[int], graph_ids: frozenset[int]) -> list[tuple[int, ...]]:
    """Cut a run at graph vertices; interior shape points stay inside their edge."""
    pieces, start = [], 0
    for i in range(1, len(run)):
        if run[i] in graph_ids or i == len(run) - 1:
            if run[i] != run[start]:
                pieces.append(tuple(run[start : i + 1]))
            start = i
    return pieces


def _node(raw: Mapping[str, Any]) -> Node:
    kerb = raw.get("tags", {}).get("kerb")
    kind = "curb_ramp" if kerb in CURB_RAMP_KERBS else "junction"
    return Node(
        raw["id"],
        raw["lat"],
        raw["lon"],
        kind,
        raw.get("version"),
        raw.get("timestamp"),
    )


def _inside(raw: Mapping[str, Any], bbox: BBox) -> bool:
    return bbox.contains(raw["lat"], raw["lon"])


def validate(network: Network) -> None:
    """Fail fast before any row is written: every edge must reference stored, valid nodes."""
    for edge in network.edges:
        if len(edge.node_ids) < MIN_EDGE_NODES or any(
            n not in network.nodes for n in edge.node_ids
        ):
            raise ValueError(
                f"way/{edge.osm_way_id} references missing or too few nodes"
            )
    for node in network.nodes.values():
        if not (-MAX_LAT <= node.lat <= MAX_LAT and -MAX_LON <= node.lon <= MAX_LON):
            raise ValueError(f"node/{node.osm_id} has invalid coordinates")


def _destinations(
    elements: list[Mapping[str, Any]], raw_nodes: Mapping[int, Any], bbox: BBox
) -> tuple[Destination, ...]:
    found = []
    for e in elements:
        tags = e.get("tags", {})
        category = destination_category(tags)
        if category is None:
            continue
        if e["type"] == "node":
            lat, lon = e["lat"], e["lon"]
        elif e["type"] == "way" and (
            pts := [raw_nodes[n] for n in e["nodes"] if n in raw_nodes]
        ):
            # shortcut: vertex mean, not a true centroid; fine for snapping to the nearest node.
            lat = sum(p["lat"] for p in pts) / len(pts)
            lon = sum(p["lon"] for p in pts) / len(pts)
        else:
            continue
        if bbox.contains(lat, lon):
            found.append(
                Destination(
                    f"{e['type']}/{e['id']}", lat, lon, category, tags.get("name")
                )
            )
    return tuple(found)
