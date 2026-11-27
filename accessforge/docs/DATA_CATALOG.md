# Data catalog

Every source the ingest pipeline loads. Each also has a row in the `data_source` table with its license, version and retrieval time. Each network, destination and origin row points to its source, and OSM-derived barriers carry `open_map_data` evidence provenance.

Evidence tags follow `COMPETITOR_ANALYSIS.md`: [V] verified, [S] secondary, [U] unverified.

## Loaded

| `data_source.id` | What | Used for | License | Version | Access |
|---|---|---|---|---|---|
| `osm` | OpenStreetMap, API 0.6 `map` download in 4 tiles | Network nodes and edges, destinations, `kerb=raised` barriers | ODbL 1.0, "© OpenStreetMap contributors" [V: osm.org/copyright] | Snapshot on the run date; each barrier keeps its OSM node version and edit time | `api.openstreetmap.org/api/0.6/map.json`, no key |
| `census_2020_blocks` | US Census Bureau TIGERweb census blocks, `POP100` | Origins: block interior point and population | Public domain, US federal work [S] | 2020 Census | TIGERweb `Tracts_Blocks/MapServer/12`, no key |
| `cdc_places_2025` | CDC PLACES, "Any disability among adults", crude prevalence, census tracts | `origin.disability_rate` | Public domain [V: dataset metadata says "Public Domain"] | 2025 release (dataset `cwsq-ngmh`; the rows say year 2023) | `data.cdc.gov` Socrata API, no key |

## Obligations and cautions

- **ODbL share-alike.** A database derived from OSM and made public must be offered under ODbL, and maps or exports must credit OpenStreetMap contributors. The pilot dashboard and any export that includes network or OSM-derived barrier data need that attribution before release. **Not yet added to the web app.**
- **OSM contributor identity is not stored.** The raw download includes usernames and user IDs; the pipeline drops them.
- **PLACES estimates are modeled.** They are small-area model estimates from BRFSS survey data and cover **adults only**. They are applied to every block in a tract and must be shown as modeled estimates, never as counts of disabled residents. No individual disability data is stored.
- **Mixed vintages.** Population is 2020 Census; disability is the PLACES 2025 release. Tracts are matched on the 11-digit GEOID; a block whose tract has no PLACES value gets `disability_rate = NULL`.

## Considered, not loaded

| Source | Status |
|---|---|
| ACS 5-year S1810 (disability) | Named in ARCHITECTURE §2.5. `api.census.gov` now answers "Missing Key" without an API key [V: 2026-11-17]. PLACES was used instead. With a free Census key, ACS would give a survey-based, all-ages tract estimate to compare against. |
| City of Fremont GIS sidewalk layer | None found in a web search on 2026-11-17 [U]. Asking the city is a discovery item. |
| Tile2Net | An open-source tool that maps sidewalks from aerial imagery. Piloted in Manhattan, Washington DC, Boston and Cambridge MA, with the model trained on Cambridge imagery [S: UIC EVL and MIT News]. No published Fremont output is known [U]. Running it would need licensed imagery and its own accuracy check, so it was not done. |
| Project Sidewalk | No Fremont deployment is known [U]. Contacting the team is a discovery item. |
