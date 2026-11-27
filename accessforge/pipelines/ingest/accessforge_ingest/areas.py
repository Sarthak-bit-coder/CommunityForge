"""Candidate pilot areas: square boxes around named Fremont centres (see docs/PILOT_AREA.md)."""

from dataclasses import dataclass
from math import cos, radians

METERS_PER_DEGREE_LAT = 111_320.0
DEFAULT_HALF_SIDE_M = 800.0


@dataclass(frozen=True)
class BBox:
    south: float
    west: float
    north: float
    east: float

    def __post_init__(self) -> None:
        if not (-90 <= self.south < self.north <= 90):
            raise ValueError(f"invalid latitude range: {self}")
        if not (-180 <= self.west < self.east <= 180):
            raise ValueError(f"invalid longitude range: {self}")

    def contains(self, lat: float, lon: float) -> bool:
        return self.south <= lat <= self.north and self.west <= lon <= self.east

    def tiles(self, rows: int, cols: int) -> tuple["BBox", ...]:
        dlat = (self.north - self.south) / rows
        dlon = (self.east - self.west) / cols
        return tuple(
            BBox(
                self.south + r * dlat,
                self.west + c * dlon,
                self.south + (r + 1) * dlat,
                self.west + (c + 1) * dlon,
            )
            for r in range(rows)
            for c in range(cols)
        )


def box_around(
    lat: float, lon: float, half_side_m: float = DEFAULT_HALF_SIDE_M
) -> BBox:
    dlat = half_side_m / METERS_PER_DEGREE_LAT
    dlon = half_side_m / (METERS_PER_DEGREE_LAT * cos(radians(lat)))
    return BBox(lat - dlat, lon - dlon, lat + dlat, lon + dlon)


# Centres are OSM station positions found via Nominatim on 2026-11-17.
CANDIDATES: dict[str, BBox] = {
    "fremont_bart": box_around(37.5574802, -121.9766318),
    "centerville": box_around(37.5591485, -122.0073516),
    "warm_springs": box_around(37.5016314, -121.9365095),
}
