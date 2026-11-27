"""Read a coherent pilot-network snapshot and model the snapped landmark-to-landmark leg."""

import json
from collections import defaultdict
from dataclasses import asdict, dataclass
from itertools import pairwise
from math import hypot
from typing import Any

from accessforge_engine.trip_options import TripBlocker, TripEdge, compare_trip
from sqlalchemy import text
from sqlalchemy.orm import Session

# Deployment guard: never route over a truncated slice of a larger import.
MAX_EDGES = 20_000
MAX_VERTICES = 100_000
MAX_BARRIERS = 5_000
METRIC_SRID = 32610
OSM_SOURCE = "osm"  # pilot ingest's network/landmark source
PRECISION = 9  # projected metres, shared by stored nodes and line coordinates

# Network UUIDs are replaced on each import. One statement sees the landmarks, topology
# and matching OSM evidence from the same PostgreSQL snapshot.
_SNAPSHOT = text("""
WITH ends AS (
    SELECT d.source_id || ':' || d.source_ref AS key, n.id AS node, s.license, s.version
    FROM destination d JOIN network_node n ON n.id = d.node_id AND n.source_id = d.source_id
    JOIN data_source s ON s.id = d.source_id
    WHERE d.source_id = :source AND d.source_id || ':' || d.source_ref IN (:start, :end)
), edges AS MATERIALIZED (
    SELECT e.* FROM network_edge e
    WHERE e.source_id = :source AND (SELECT count(*) FROM ends) = 2
    LIMIT :edge_probe
), kerbs AS MATERIALIZED (
    SELECT DISTINCT n.id AS node, b.id AS barrier, n.geom
    FROM network_node n
    JOIN evidence_provenance p ON p.source_ref = 'osm:' || n.source_ref
    JOIN barrier b ON b.id = p.barrier_id
    WHERE n.source_id = :source AND p.source = 'open_map_data'
      AND b.type = 'missing_curb_ramp' AND b.state IN ('unverified','confirmed','repair_planned')
      AND (SELECT count(*) FROM ends) = 2
    LIMIT :barrier_probe
), fits AS (
    SELECT count(*) <= :max_edges AND coalesce(sum(ST_NPoints(geom)),0) <= :max_vertices
        AND (SELECT count(*) FROM kerbs) <= :max_barriers AS ok FROM edges
)
SELECT (SELECT jsonb_object_agg(key,node) FROM ends) AS landmarks,
       (SELECT max(license) FROM ends) AS license, (SELECT max(version) FROM ends) AS version,
       (SELECT jsonb_agg(jsonb_build_object('id',e.source_ref,'u',e.from_node,'v',e.to_node,
            'kind',e.kind,'length',e.length_m,'shape',ST_AsGeoJSON(ST_Transform(e.geom,:srid),:precision)))
        FROM edges e WHERE (SELECT ok FROM fits)) AS edges,
       (SELECT jsonb_agg(jsonb_build_object('node',k.node,'barrier',k.barrier,'lon',ST_X(k.geom),
            'lat',ST_Y(k.geom),'point',ST_AsGeoJSON(ST_Transform(k.geom,:srid),:precision)))
        FROM kerbs k WHERE (SELECT ok FROM fits)) AS kerbs
""")

Point = tuple[float, float]


@dataclass(frozen=True)
class _Kerb:
    node: str
    barrier: str
    xy: Point
    location: str


def _read_kerb(row: dict[str, Any]) -> _Kerb:
    x, y = json.loads(row["point"])["coordinates"]
    return _Kerb(
        str(row["node"]),
        str(row["barrier"]),
        (x, y),
        f"{row['lat']:.6f}, {row['lon']:.6f}",
    )


def _split_edges(
    rows: list[dict[str, Any]], kerbs: list[_Kerb]
) -> tuple[list[TripEdge], list[TripBlocker]] | None:
    by_xy: dict[Point, set[str]] = defaultdict(set)
    for k in kerbs:
        by_xy[k.xy].add(k.node)
    edges: list[TripEdge] = []
    nodes: set[str] = set()
    interiors: set[str] = set()
    for row in rows:
        coords = json.loads(row["shape"])["coordinates"]
        previous, previous_dist, dist = str(row["u"]), 0.0, 0.0
        parts: list[tuple[str, str, float]] = []
        for i, ((x0, y0), (x, y)) in enumerate(pairwise(coords), start=1):
            dist += hypot(x - x0, y - y0)
            if i == len(coords) - 1:
                node = str(row["v"])
            else:
                # Ingest retains interior shape coordinates, but not their OSM node IDs on
                # the edge. A shared/repeated point would invent a junction; decline it.
                hits = by_xy.get((x, y))
                if not hits:
                    continue
                if len(hits) != 1 or not interiors.isdisjoint(hits):
                    return None
                node = next(iter(hits))
                interiors.add(node)
            if previous == node or dist <= previous_dist:
                return None
            parts.append((previous, node, dist - previous_dist))
            previous, previous_dist = node, dist
        for part, (u, v, length) in enumerate(parts, 1):
            label = row["id"] if len(parts) == 1 else f"{row['id']} (part {part})"
            edges.append(
                TripEdge(label, u, v, row["length"] * length / dist, row["kind"])
            )
            nodes.update((u, v))
    # Coincident endpoints from distinct OSM ways must not join an interior kerb.
    if interiors & {str(row[key]) for row in rows for key in ("u", "v")}:
        return None
    if any(k.node not in nodes for k in kerbs):
        return None
    return edges, [TripBlocker(k.barrier, k.node) for k in kerbs]


def analyze_trip(
    session: Session, start_key: str, end_key: str
) -> dict[str, Any] | None:
    row = (
        session.execute(
            _SNAPSHOT,
            {
                "source": OSM_SOURCE,
                "start": start_key,
                "end": end_key,
                "srid": METRIC_SRID,
                "precision": PRECISION,
                "edge_probe": MAX_EDGES + 1,
                "max_edges": MAX_EDGES,
                "max_vertices": MAX_VERTICES,
                "barrier_probe": MAX_BARRIERS + 1,
                "max_barriers": MAX_BARRIERS,
            },
        )
        .mappings()
        .one()
    )
    landmarks = row["landmarks"] or {}
    if (
        len(landmarks) != 2
        or not row["edges"]
        or landmarks[start_key] == landmarks[end_key]
    ):
        return None
    kerbs = [_read_kerb(item) for item in row["kerbs"] or []]
    network = _split_edges(row["edges"], kerbs)
    if network is None:
        return None
    edges, blockers = network
    vertices = {node for edge in edges for node in (edge.from_node, edge.to_node)}
    if not {landmarks[start_key], landmarks[end_key]}.issubset(vertices):
        return None
    result = compare_trip(landmarks[start_key], landmarks[end_key], edges, blockers)
    locations = {k.node: k.location for k in kerbs}
    return {
        **asdict(result),
        "crossings": [
            {**asdict(c), "location": locations[c.node_id]} for c in result.crossings
        ],
        "attribution": [f"{row['license']} · {row['version']}"],
        "coverage_note": (
            "Modeled between the nearest mapped nodes. Landmark entrances and connecting legs "
            "are unmodeled. This assumes recorded OSM raised kerbs are present; the tags may be "
            "out of date. Width, slope, surface, community reports and unmapped barriers are not "
            "evaluated. Steps and street proxies are excluded. Missing map links can break a "
            "modeled connection. Field verification is needed."
        ),
    }
