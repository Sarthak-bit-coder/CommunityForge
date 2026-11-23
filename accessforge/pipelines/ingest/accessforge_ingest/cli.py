"""Fetch and load a pilot area: `accessforge-ingest fremont_bart` (DATABASE_URL from env)."""

import argparse
import json
import logging
import sys
from dataclasses import asdict
from datetime import UTC, datetime

from accessforge_api.config import Settings
from accessforge_api.database import make_engine

from . import census, connectivity, load, osm
from .areas import CANDIDATES

log = logging.getLogger("accessforge_ingest")

OSM_SOURCE = "osm"
BLOCKS_SOURCE = "census_2020_blocks"
PLACES_SOURCE = "cdc_places_2025"


def sources(now: datetime) -> tuple[load.SourceRecord, ...]:
    day = now.date().isoformat()
    return (
        load.SourceRecord(
            OSM_SOURCE, "OpenStreetMap (API 0.6 map download)",
            "ODbL 1.0, © OpenStreetMap contributors", osm.OSM_MAP_URL, f"snapshot {day}", now,
        ),
        load.SourceRecord(
            BLOCKS_SOURCE, "US Census Bureau TIGERweb census blocks, 2020 Census POP100",
            "Public domain (US federal government work)", census.BLOCKS_URL, "2020 Census", now,
        ),
        load.SourceRecord(
            PLACES_SOURCE, "CDC PLACES, any disability among adults (modeled, tract)",
            "Public domain (CDC, data.cdc.gov)", census.PLACES_URL, "2025 release", now,
        ),
    )  # fmt: skip


def run(area: str) -> dict[str, object]:
    bbox = CANDIDATES[area]
    now = datetime.now(UTC)
    network, report = connectivity.largest_component(osm.parse(osm.fetch(bbox), bbox))
    origins = census.fetch_origins(bbox)
    engine = make_engine(Settings())
    try:
        with engine.begin() as connection:
            summary = load.load(
                connection, sources(now), network, origins,
                OSM_SOURCE, BLOCKS_SOURCE, PLACES_SOURCE,
            )  # fmt: skip
    finally:
        engine.dispose()
    return {"area": area, "connectivity": asdict(report), "loaded": asdict(summary)}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("area", choices=sorted(CANDIDATES))
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO)
    try:
        result = run(args.area)
    except Exception:
        log.exception("ingest failed; nothing was committed")
        return 1
    sys.stdout.write(json.dumps(result, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
