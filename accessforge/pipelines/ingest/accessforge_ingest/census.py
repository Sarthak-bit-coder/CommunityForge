"""Origins: 2020 Census block population, with a modeled tract disability share from CDC PLACES."""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import Any

from .areas import BBox
from .http import get_json

BLOCKS_URL = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/12/query"
PLACES_URL = (
    "https://data.cdc.gov/resource/cwsq-ngmh.json"  # PLACES 2025 release, census tracts
)
PLACES_MEASURE = "DISABILITY"  # "Any disability among adults", crude prevalence, %
TRACT_GEOID_LENGTH = 11
PERCENT = 100.0


@dataclass(frozen=True)
class Origin:
    block_geoid: str
    lat: float
    lon: float
    population: int
    # Adults, modeled tract estimate; None when PLACES has no value.
    disability_rate: float | None


def fetch_blocks(bbox: BBox) -> list[Mapping[str, Any]]:
    data = get_json(BLOCKS_URL, {
        "where": "POP100 > 0",
        "geometry": f"{bbox.west},{bbox.south},{bbox.east},{bbox.north}",
        "geometryType": "esriGeometryEnvelope",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "GEOID,POP100,INTPTLAT,INTPTLON",
        "returnGeometry": "false",
        "f": "json",
    })  # fmt: skip
    if "error" in data or data.get("exceededTransferLimit"):
        raise RuntimeError(f"TIGERweb block query incomplete: {data.get('error')}")
    return [f["attributes"] for f in data["features"]]


def fetch_disability_rates(tract_geoids: Iterable[str]) -> dict[str, float]:
    ids = sorted(set(tract_geoids))
    if not ids:
        return {}
    for geoid in ids:
        if not (geoid.isdigit() and len(geoid) == TRACT_GEOID_LENGTH):
            raise ValueError(f"bad tract GEOID: {geoid!r}")
    quoted = ",".join(f"'{g}'" for g in ids)  # digits only, checked above
    rows = get_json(PLACES_URL, {
        "$where": f"measureid='{PLACES_MEASURE}' AND locationname in({quoted})",
        "$limit": str(len(ids) * 2),
    })  # fmt: skip
    return {
        r["locationname"]: float(r["data_value"]) / PERCENT
        for r in rows
        if r.get("data_value")
    }


def to_origins(
    blocks: Iterable[Mapping[str, Any]], rates: Mapping[str, float], bbox: BBox
) -> tuple[Origin, ...]:
    """Keep blocks whose interior point lies inside the area."""
    origins = []
    for b in blocks:
        lat, lon = float(b["INTPTLAT"]), float(b["INTPTLON"])
        if not bbox.contains(lat, lon):
            continue
        geoid = str(b["GEOID"])
        origins.append(Origin(
            geoid, lat, lon, int(b["POP100"]), rates.get(geoid[:TRACT_GEOID_LENGTH])
        ))  # fmt: skip
    return tuple(origins)


def fetch_origins(bbox: BBox) -> tuple[Origin, ...]:
    blocks = fetch_blocks(bbox)
    rates = fetch_disability_rates(str(b["GEOID"])[:TRACT_GEOID_LENGTH] for b in blocks)
    return to_origins(blocks, rates, bbox)
