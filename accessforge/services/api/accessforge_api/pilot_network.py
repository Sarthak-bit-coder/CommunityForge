"""Builds an engine instance from the ingested Fremont pilot network; no selection logic here.

Every number this produces is modeled. Repairs are priced in repair units (one per barrier), not
dollars: no per-ramp cost data for Fremont exists yet (docs/DATA_CATALOG.md).
"""

from collections.abc import Mapping
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from accessforge_engine.contract import (
    Barrier,
    Destination,
    Edge,
    Node,
    Origin,
    ProblemInstance,
    Profile,
    Repair,
)
from accessforge_engine.synthetic import SyntheticNetwork
from sqlalchemy import Connection, Engine, text

# Metric projection for Fremont (AGENTS.md: compute lengths in EPSG:32610).
METRIC_SRID = 32610
REPAIR_UNIT_COST = 1.0
# A barrier attaches to the nearest routable vertex within this distance, else it is left out.
MAX_BARRIER_LINK_M = 15.0
# About a 10-minute walk. An assumption of the model, not a measured travel tolerance.
WALK_THRESHOLD_M = 800.0
# A planned repair has not happened yet, so the barrier still blocks the route
# (matches trip_network). Completed repairs await verification and are left out.
ACTIVE_STATES = ("unverified", "confirmed", "repair_planned")
STEPS_TYPE = "steps"
STEPS_SEVERITY = 5
ORIGIN_GROUP = "all"
# Equal weights: no measured profile mix exists for the pilot area.
PROFILES = (
    Profile(
        "wheelchair", 0.5, None, frozenset({"missing_curb_ramp", STEPS_TYPE}), {},
        WALK_THRESHOLD_M,
    ),
    Profile("pedestrian", 0.5, None, frozenset(), {}, WALK_THRESHOLD_M),
)  # fmt: skip

_ROUTABLE = "SELECT from_node FROM network_edge UNION SELECT to_node FROM network_edge"
_NODES = f"""
    SELECT n.id::text, ST_X(p), ST_Y(p)
    FROM network_node n, ST_Transform(n.geom, {METRIC_SRID}) p
    WHERE n.id IN ({_ROUTABLE}) ORDER BY n.id
"""
_EDGES = """
    SELECT id::text, from_node::text, to_node::text, length_m, kind
    FROM network_edge ORDER BY id
"""
_BARRIERS = f"""
    SELECT b.id::text, b.type, b.severity, b.presence_prob, near.id::text
    FROM barrier b JOIN location l ON l.id = b.location_id
    CROSS JOIN LATERAL (
        SELECT n.id, n.geom FROM network_node n WHERE n.id IN ({_ROUTABLE})
        ORDER BY n.geom <-> l.geom LIMIT 1
    ) near
    WHERE b.state::text = ANY(:states)
      AND ST_DWithin(near.geom::geography, l.geom::geography, {MAX_BARRIER_LINK_M})
    ORDER BY b.id
"""
_ORIGINS = "SELECT id, node_id::text, population FROM origin ORDER BY id"
_DESTINATIONS = "SELECT id::text, node_id::text, category, weight, name FROM destination ORDER BY id"


def _rows(
    connection: Connection, sql: str, params: Mapping[str, object] | None = None
) -> list[tuple[Any, ...]]:
    return [tuple(row) for row in connection.execute(text(sql), params or {})]


@dataclass(frozen=True)
class PilotNetwork:
    network: SyntheticNetwork
    destination_names: Mapping[str, str | None]


@lru_cache(maxsize=1)
def load_pilot_network(engine: Engine) -> PilotNetwork | None:
    """None when no pilot network is loaded.

    shortcut: cached for the process lifetime, so restart the API after re-running the ingest.
    """
    with engine.connect() as connection:
        nodes = _rows(connection, _NODES)
        if not nodes:
            return None
        edges = _rows(connection, _EDGES)
        barrier_rows = _rows(connection, _BARRIERS, {"states": list(ACTIVE_STATES)})
        origins = _rows(connection, _ORIGINS)
        destinations = _rows(connection, _DESTINATIONS)
    barriers = tuple(
        Barrier(id, None, node_id, kind, severity, prob)
        for id, kind, severity, prob, node_id in barrier_rows
    )
    # Steps block wheelchair users and have no repair in this model.
    steps = tuple(
        Barrier(f"steps:{id}", id, None, STEPS_TYPE, STEPS_SEVERITY, 1.0)
        for id, _, _, _, kind in edges
        if kind == STEPS_TYPE
    )
    instance = ProblemInstance(
        edges=tuple(Edge(id, u, v, length, {"kind": kind}) for id, u, v, length, kind in edges),
        barriers=barriers + steps,
        repairs=tuple(
            Repair(f"repair:{b.id}", (b.id,), REPAIR_UNIT_COST, REPAIR_UNIT_COST, REPAIR_UNIT_COST)
            for b in barriers
        ),
        profiles=PROFILES,
        origins=tuple(
            Origin(id, node_id, float(population), ORIGIN_GROUP)
            for id, node_id, population in origins
        ),
        destinations=tuple(
            Destination(id, node_id, category, weight)
            for id, node_id, category, weight, _ in destinations
        ),
        nodes=tuple(Node(id) for id, _, _ in nodes),
    )  # fmt: skip
    # Metres from the area's south-west corner, so diagrams need no projection maths.
    min_x = min(x for _, x, _ in nodes)
    min_y = min(y for _, _, y in nodes)
    positions = {id: (x - min_x, y - min_y) for id, x, y in nodes}
    return PilotNetwork(
        SyntheticNetwork(instance, positions),
        {id: name for id, _, _, _, name in destinations},
    )
