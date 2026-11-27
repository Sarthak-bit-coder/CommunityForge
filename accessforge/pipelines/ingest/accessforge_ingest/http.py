"""Minimal JSON GET with a generic User-Agent, as the OSM and Census usage policies ask."""

import json
from collections.abc import Mapping
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

USER_AGENT = "AccessForge-ingest/0.1 (research pilot data loader)"
TIMEOUT_S = 120


def get_json(url: str, params: Mapping[str, str]) -> Any:
    request = Request(f"{url}?{urlencode(params)}", headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(request, timeout=TIMEOUT_S) as response:
            return json.load(response)
    except (OSError, ValueError) as error:
        raise RuntimeError(f"fetch failed for {url}: {error}") from error
