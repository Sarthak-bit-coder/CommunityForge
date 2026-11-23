"""Write one pilot area into PostGIS in a single transaction.

The network, destinations and origins are replaced on each run. Raised-kerb barriers are only
ever added: a barrier already recorded from the same OSM node keeps its row and review state.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from accessforge_api.report_repository import UNVERIFIED_PRESENCE_PROBABILITY
from sqlalchemy import Connection, text

from .census import Origin
from .osm import Network, validate

RAISED_KERB_SEVERITY = 4  # assumption: blocks wheelchair users at that crossing end
RAISED_KERB_DESCRIPTION = (
    "OpenStreetMap tags this kerb as raised (kerb=raised). Not field-verified."
)
METRIC_SRID = 32610  # UTM 10N, for lengths in Fremont


@dataclass(frozen=True)
class SourceRecord:
    id: str
    name: str
    license: str
    url: str
    version: str
    retrieved_at: datetime


@dataclass(frozen=True)
class LoadSummary:
    nodes: int
    edges: int
    destinations: int
    origins: int
    barriers_added: int
    barriers_already_present: int
    unlinked_destinations: int = 0  # no routable vertex within MAX_LINK_M; skipped
    unlinked_origins: int = 0


_POINT = "ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)"
# A trip endpoint snaps to the nearest routable vertex within MAX_LINK_M (docs/PILOT_AREA.md).
# The straight-line leg to it is not modeled; farther points stay unlinked rather than invent a
# long connection. Only edge endpoints are vertices; interior shape points have no routable edges.
# Ties break on source_ref so reloads link the same node. The index-assisted `<->` search (in
# degrees) picks a few candidates; exact metres then choose among them.
MAX_LINK_M = 200.0
LOAD_TIMEOUT_MS = 120_000
LINK_CANDIDATES = 16
_LINKED_NODE = (
    "(SELECT c.id FROM (SELECT n.id, n.source_ref,"
    " ST_Distance(n.geom::geography, {p}::geography) AS d FROM network_node n"
    " WHERE EXISTS (SELECT 1 FROM network_edge e WHERE e.from_node = n.id)"
    " OR EXISTS (SELECT 1 FROM network_edge e WHERE e.to_node = n.id)"
    f" ORDER BY n.geom <-> {{p}} LIMIT {LINK_CANDIDATES}) c"
    f" WHERE c.d <= {MAX_LINK_M} ORDER BY c.d, c.source_ref LIMIT 1)"
)


def load(
    connection: Connection,
    sources: Sequence[SourceRecord],
    network: Network,
    origins: Sequence[Origin],
    osm_source: str,
    population_source: str,
    disability_source: str,
) -> LoadSummary:
    validate(network)  # before the first write, so a bad extract changes nothing
    # The API's 2 s request timeout is too short for replacing the whole network; LOCAL ends
    # with this transaction.
    connection.execute(text(f"SET LOCAL statement_timeout = {LOAD_TIMEOUT_MS}"))
    _upsert_sources(connection, sources)
    for table in ("origin", "destination", "network_edge", "network_node"):
        connection.execute(text(f"DELETE FROM {table}"))  # fixed table names only
    _insert_nodes(connection, network, osm_source)
    _insert_edges(connection, network, osm_source)
    _insert_destinations(connection, network, osm_source)
    _insert_origins(connection, origins, population_source, disability_source)
    added = _add_kerb_barriers(connection, network, osm_source)
    counts = [
        int(
            connection.scalar(text(f"SELECT count(*) FROM {table}")) or 0
        )  # fixed table names
        for table in ("network_node", "network_edge", "destination", "origin")
    ]
    if counts[:2] != [len(network.nodes), len(network.edges)]:
        raise RuntimeError(f"network rows lost on insert: {counts[:2]}")
    nodes, edges, destinations, origin_rows = counts
    return LoadSummary(
        nodes,
        edges,
        destinations,
        origin_rows,
        added,
        len(network.raised_kerbs) - added,
        len(network.destinations) - destinations,
        len(origins) - origin_rows,
    )


def _execute_many(
    connection: Connection, sql: str, rows: Sequence[Mapping[str, Any]]
) -> None:
    if rows:
        connection.execute(text(sql), rows)


def _upsert_sources(connection: Connection, sources: Sequence[SourceRecord]) -> None:
    _execute_many(connection, """
        INSERT INTO data_source(id, name, license, url, version, retrieved_at)
        VALUES (:id, :name, :license, :url, :version, :retrieved_at)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, license = EXCLUDED.license,
            url = EXCLUDED.url, version = EXCLUDED.version, retrieved_at = EXCLUDED.retrieved_at
    """, [vars(s) for s in sources])  # fmt: skip


def _insert_nodes(connection: Connection, network: Network, source: str) -> None:
    _execute_many(connection, f"""
        INSERT INTO network_node(geom, kind, source_id, source_ref)
        VALUES ({_POINT}, :kind, :source, :ref)
    """, [
        {"lon": n.lon, "lat": n.lat, "kind": n.kind, "source": source, "ref": f"node/{n.osm_id}"}
        for n in network.nodes.values()
    ])  # fmt: skip


def _insert_edges(connection: Connection, network: Network, source: str) -> None:
    rows, seen = [], dict[int, int]()
    for edge in network.edges:
        part = seen.get(edge.osm_way_id, 0)
        seen[edge.osm_way_id] = part + 1
        coords = ", ".join(
            f"{network.nodes[n].lon} {network.nodes[n].lat}" for n in edge.node_ids
        )
        rows.append({
            "wkt": f"LINESTRING({coords})", "kind": edge.kind, "surface": edge.surface,
            "source": source, "ref": f"way/{edge.osm_way_id}:{part}",
            "from_ref": f"node/{edge.node_ids[0]}", "to_ref": f"node/{edge.node_ids[-1]}",
        })  # fmt: skip
    _execute_many(connection, f"""
        INSERT INTO network_edge(from_node, to_node, geom, length_m, kind, surface, source_id, source_ref)
        SELECT f.id, t.id, g.geom, ST_Length(ST_Transform(g.geom, {METRIC_SRID})),
               :kind, :surface, :source, :ref
        FROM (SELECT ST_GeomFromText(:wkt, 4326) AS geom) g
        JOIN network_node f ON f.source_id = :source AND f.source_ref = :from_ref
        JOIN network_node t ON t.source_id = :source AND t.source_ref = :to_ref
    """, rows)  # fmt: skip


def _insert_destinations(connection: Connection, network: Network, source: str) -> None:
    _execute_many(connection, f"""
        INSERT INTO destination(geom, category, name, node_id, source_id, source_ref)
        SELECT p.g, :category, :name, l.node_id, :source, :ref
        FROM (SELECT {_POINT} AS g) p
        CROSS JOIN LATERAL (SELECT {_LINKED_NODE.format(p="p.g")} AS node_id) l
        WHERE l.node_id IS NOT NULL
    """, [
        {"lon": d.lon, "lat": d.lat, "category": d.category, "name": d.name,
         "source": source, "ref": d.osm_ref}
        for d in network.destinations
    ])  # fmt: skip


def _insert_origins(
    connection: Connection, origins: Sequence[Origin], population: str, disability: str
) -> None:
    _execute_many(connection, f"""
        INSERT INTO origin(id, geom, population, disability_rate, node_id, source_id,
                           disability_source_id)
        SELECT :id, p.g, :population, :rate, l.node_id, :source, :disability_source
        FROM (SELECT {_POINT} AS g) p
        CROSS JOIN LATERAL (SELECT {_LINKED_NODE.format(p="p.g")} AS node_id) l
        WHERE l.node_id IS NOT NULL
    """, [
        {"id": o.block_geoid, "lon": o.lon, "lat": o.lat, "population": o.population,
         "rate": o.disability_rate, "source": population,
         "disability_source": disability if o.disability_rate is not None else None}
        for o in origins
    ])  # fmt: skip


def _add_kerb_barriers(connection: Connection, network: Network, source: str) -> int:
    added = 0
    for kerb in network.raised_kerbs:
        ref = f"osm:node/{kerb.osm_id}"
        exists = connection.scalar(text(
            "SELECT 1 FROM evidence_provenance WHERE source = 'open_map_data' AND source_ref = :ref"
        ), {"ref": ref})  # fmt: skip
        if exists:
            continue
        location = connection.scalar(
            text(f"INSERT INTO location(geom) VALUES ({_POINT}) RETURNING id"),
            {"lon": kerb.lon, "lat": kerb.lat},
        )
        barrier = connection.scalar(text("""
            INSERT INTO barrier(location_id, type, description, severity, presence_prob)
            VALUES (:location, 'missing_curb_ramp', :description, :severity, :prob) RETURNING id
        """), {
            "location": location, "description": RAISED_KERB_DESCRIPTION,
            "severity": RAISED_KERB_SEVERITY, "prob": UNVERIFIED_PRESENCE_PROBABILITY,
        })  # fmt: skip
        connection.execute(text("""
            INSERT INTO evidence_provenance(barrier_id, source, source_ref, source_version, observed_at)
            SELECT :barrier, 'open_map_data', :ref, :version,
                   COALESCE(CAST(:observed AS timestamptz), retrieved_at)
            FROM data_source WHERE id = :source
        """), {
            "barrier": barrier, "ref": ref, "source": source,
            "version": f"v{kerb.version}" if kerb.version else None,
            "observed": kerb.timestamp,
        })  # fmt: skip
        added += 1
    return added
