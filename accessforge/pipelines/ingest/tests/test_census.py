from typing import Any

import pytest
from conftest import AREA

from accessforge_ingest import census


def _block(geoid: str, pop: int, lat: float) -> dict[str, Any]:
    return {"GEOID": geoid, "POP100": pop, "INTPTLAT": str(lat), "INTPTLON": "-121.995"}


def test_origins_keep_inside_blocks_and_join_tract_rates() -> None:
    blocks = [
        _block("060014418001000", 120, 37.005),
        _block("060014419001000", 40, 37.006),  # tract with no PLACES value
        _block("060014418001001", 30, 37.5),  # interior point outside the area
    ]
    origins = census.to_origins(blocks, {"06001441800": 0.2}, AREA)
    assert [(o.block_geoid, o.population, o.disability_rate) for o in origins] == [
        ("060014418001000", 120, 0.2),
        ("060014419001000", 40, None),
    ]


def test_disability_rates_query_converts_percent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: dict[str, str] = {}

    def fake(url: str, params: dict[str, str]) -> list[dict[str, str]]:
        seen.update(params)
        return [
            {"locationname": "06001441800", "data_value": "20.4"},
            {"locationname": "06001441900"},
        ]

    monkeypatch.setattr(census, "get_json", fake)
    rates = census.fetch_disability_rates(["06001441800", "06001441900", "06001441800"])
    assert rates == {"06001441800": pytest.approx(0.204)}
    assert "'06001441800','06001441900'" in seen["$where"]


def test_disability_rates_reject_non_numeric_geoids() -> None:
    with pytest.raises(ValueError, match="bad tract GEOID"):
        census.fetch_disability_rates(["0600144180'"])
    assert census.fetch_disability_rates([]) == {}


def test_block_query_fails_loudly_when_truncated(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        census,
        "get_json",
        lambda url, params: {"features": [], "exceededTransferLimit": True},
    )
    with pytest.raises(RuntimeError, match="incomplete"):
        census.fetch_blocks(AREA)


def test_fetch_origins_wires_blocks_to_rates(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        census, "fetch_blocks", lambda bbox: [_block("060014418001000", 5, 37.005)]
    )
    monkeypatch.setattr(
        census, "fetch_disability_rates", lambda ids: {"06001441800": 0.1}
    )
    assert census.fetch_origins(AREA)[0].disability_rate == 0.1
