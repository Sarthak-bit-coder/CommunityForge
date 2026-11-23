# Pilot area

Chosen 2026-11-17: **Fremont BART / Downtown**, a 1.6 km × 1.6 km square (about 2.6 km²) centred on Fremont BART station (37.55748, −121.97663). The box is defined in `pipelines/ingest/accessforge_ingest/areas.py` (`fremont_bart`).

This choice was made from public data only. No one from the City of Fremont or any local organization was consulted (see `DISCOVERY.md`). It should be revisited once those conversations happen.

## Criteria (ROADMAP Phase 2)

1. **Mixed land use and essential destinations:** count of OSM grocery, healthcare, transit, education, civic and park features.
2. **Data availability:** how much of the pedestrian network OSM maps (separate sidewalks, crossings, kerb tags), and how much of it forms one connected network.
3. **Equity:** residents and the modeled share of adults with a disability (CDC PLACES, tract level).

## Candidates compared

All three are 1.6 km boxes around a transit station. Figures come from the ingest pipeline's own parser, run on 2026-11-17 against the OSM API, TIGERweb and CDC PLACES.

| | Fremont BART / Downtown | Centerville | Warm Springs BART |
|---|---:|---:|---:|
| Essential destinations | **138** (87 healthcare, 31 transit, 8 civic, 6 grocery, 4 education, 2 park) | 52 | 16 |
| Mapped sidewalk ways (edges) | **254** | 113 | 99 |
| Mapped crossings (edges) | **187** | 59 | 52 |
| Nodes tagged as curb ramps (`kerb=lowered/flush`) | **185** | 53 | 89 |
| Nodes tagged `kerb=raised` (barriers) | **20** | 1 | 0 |
| Walkable edges in the largest connected piece | **94.6%** (1,251 of 1,323) | 72.0% (785 of 1,091) | 93.1% (430 of 462) |
| Residents (2020 Census, blocks inside box) | 10,408 | **13,687** | 1,315 |
| Population-weighted adult disability share (modeled) | 17.9% | **23.2%** | 17.0% |

## Decision and trade-off

Fremont BART / Downtown leads on destinations, network data and existing barrier data. It is the only candidate where the planner can run on real barriers today.

**Centerville scores better on equity:** more residents and a higher modeled disability share. It was not chosen because 28% of its walkable network is disconnected and it has a single mapped barrier, so results there would mostly reflect data gaps. If the team weighs equity more heavily, switching is one argument: `accessforge-ingest centerville`. That would need a manual connectivity fix first.

## Known limits of the loaded network

- **Streets as proxies.** Roads without separately mapped sidewalks are walkable edges of kind `street`: 21.98 km of the 56.7 km loaded. A `street` edge means "people can probably walk along here", not "a sidewalk exists".
- **Sidewalk information on streets.** Of the 472 street ways touching the box, 220 have sidewalk tags and 192 have sidewalks mapped as separate ways. **60 (13%) say nothing about sidewalks.**
- **Kerb tags are sparse.** Of the 374 crossing-end nodes, 222 (59%) have no `kerb` tag. A missing `kerb=raised` tag is not evidence that a curb ramp exists.
- **Disconnected pieces.** 72 edges in 24 pieces were dropped. The three largest (17, 16 and 8 edges) are footway-only clusters near (37.5644, −121.9721), (37.5564, −121.9730) and (37.5576, −121.9821). Whether they are truly disconnected or simply missing a link in OSM has **not** been checked against imagery or on site.
- **Not checked against imagery.** ROADMAP asks for an imagery comparison of OSM coverage. That needs a person to look and has not been done.
- **Snapping.** Each destination and origin attaches to its nearest routable network node within 200 m; anything farther stays unlinked. In the 2026-11-18 load all 138 destinations and 53 census blocks linked. The largest distances are 125 m (destinations, mean 42 m) and 150 m (origins). Those trips include an unmodeled leg.
