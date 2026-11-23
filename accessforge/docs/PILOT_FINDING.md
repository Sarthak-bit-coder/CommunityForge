# Pilot finding: two curbs that only matter together

**Status: modeled, from unverified open map data. Not an inspection, a compliance determination, or a safe route.** Computed 2026-11-18 from the OpenStreetMap snapshot loaded that day.

## The finding

In the Fremont pilot area around Fremont BART (`docs/PILOT_AREA.md`), OpenStreetMap marks two curbs as raised. They sit about 5 m apart near Civic Center Drive & BART Way:

| OSM node | Location (lat, lon) | State |
|---|---|---|
| [`14080814615`](https://www.openstreetmap.org/node/14080814615) | 37.557859, -121.977532 | unverified |
| [`14080814657`](https://www.openstreetmap.org/node/14080814657) | 37.557904, -121.977605 | unverified |

If both are raised, the model gives this result:

- **Fixing either curb alone changes nothing.** Each has a detour until the other is fixed.
- **Fixing both opens 48 modeled wheelchair trips** to six healthcare destinations within the 800 m threshold, including Bay Area Community Health, East Bay Retina Consultants and EXPerience Physical Therapy.
- Those trips start in **8 census blocks with 1,999 residents** (2020 Census). That is a count of everyone living there, not of wheelchair users. The model holds no individual disability data.
- Three more raised curbs at the same corner (nodes `14080831776`, `14080831770`, `14080831782`) add one modeled trip, to the Civic Center Drive & BART Way stop. With those five fixed, the model gives the same gain as fixing all 20 raised curbs in the area.
- None of the 20 curbs gains anything on its own. That is why the greedy planner and the one-at-a-time baselines pick nothing useful here: they look at one repair at a time. Choosing repairs as a group is the point of the project (`docs/RESEARCH_HYPOTHESIS.md`).

## How it was computed

```sh
cd services/api
DATABASE_URL=postgresql+psycopg://... uv run python scripts/pilot_finding.py
```

The script loads the pilot network through `accessforge_api/pilot_network.py`. It fixes all 20 raised curbs, then removes, in ID order, every curb whose removal keeps the full gain. The five left are the minimal set. It then removes each of the five in turn to measure what each adds.

Model settings: one repair unit per curb (there is no cost data); two equally weighted profiles, wheelchair and pedestrian; an 800 m walking threshold; and steps impassable for wheelchair users. Census blocks and destinations snap to the nearest network node within 200 m.

## What could make this wrong

- **The curbs are unverified.** They are OSM `kerb=raised` tags with very recent node IDs, so they were mapped recently. Nobody has checked them on site. A raised tag could be wrong, or a ramp could already exist.
- **The network may be incomplete.** OSM coverage has not been checked against imagery (`docs/ROADMAP.md`, Phase 2). A missing sidewalk or crossing could create a detour the model cannot see, or remove one it uses.
- **Street centerlines count as walkable.** The 383 street edges let pedestrians and wheelchair users travel along roads. In one exploratory run with streets treated as unusable for wheelchair users, fixing all 20 curbs gave a gain of 3,726 instead of 6,247.5. The script does not reproduce that run.
- **The legs to and from the network are not modeled.** They are up to 150 m for census blocks and 125 m for destinations.
- **The 800 m threshold and the equal profile weights are assumptions,** not measurements.

## Next step

Verify the two curbs on site with photos, following `docs/AUDIT_PROTOCOL.md`. That needs a person. Until then, this is a lead for a field check, not a recommendation to repair.
