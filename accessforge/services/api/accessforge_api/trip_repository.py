"""Trip storage uses stable OSM references, not replaceable network row IDs."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from .network_models import Destination
from .trip_models import CommunityTrip, TripEvent, TripSupport
from .trip_network import OSM_SOURCE, analyze_trip
from .trip_schemas import (
    Landmark,
    Nomination,
    PublicEvent,
    TripCatalog,
    TripDetail,
    TripSummary,
)

# Fremont BART / Downtown pilot bounds from pipelines/ingest/accessforge_ingest/areas.py.
FREMONT_BOUNDS = (
    -121.98569715468412,
    37.55029371060007,
    -121.9675664453159,
    37.56466668939993,
)
LANDMARK_KEY = Destination.source_id + ":" + Destination.source_ref
LANDMARKS = select(
    LANDMARK_KEY.label("key"),
    func.coalesce(
        func.nullif(func.btrim(Destination.name), ""),
        Destination.category + " · " + Destination.source_ref,
    ).label("name"),
).where(
    Destination.source_id == OSM_SOURCE,
    Destination.source_ref.op("~")(r"^(node|way|relation)/[1-9][0-9]*$"),
    func.ST_Covers(func.ST_MakeEnvelope(*FREMONT_BOUNDS, 4326), Destination.geom),
)
SUPPORT_COUNT = (
    select(func.count())
    .where(TripSupport.trip_id == CommunityTrip.id)
    .correlate(CommunityTrip)
    .scalar_subquery()
)
SUMMARY = select(
    CommunityTrip.id,
    CommunityTrip.start_name,
    CommunityTrip.end_name,
    CommunityTrip.purpose,
    CommunityTrip.field_nominated,
    SUPPORT_COUNT.label("supports"),
)


def create(session: Session, nomination: Nomination) -> tuple[UUID, bool] | None:
    keys = (nomination.start_key, nomination.end_key)
    with session.begin():
        names = {
            row.key: row.name
            for row in session.execute(LANDMARKS.where(LANDMARK_KEY.in_(keys)))
        }
        if len(names) != 2:
            return None
        field = nomination.source == "field"
        stmt = insert(CommunityTrip).values(
            start_key=keys[0],
            end_key=keys[1],
            purpose=nomination.purpose,
            start_name=names[keys[0]],
            end_name=names[keys[1]],
            field_nominated=field,
        )
        trip_id = session.scalar(
            stmt.on_conflict_do_nothing(
                index_elements=["start_key", "end_key", "purpose"]
            ).returning(CommunityTrip.id)
        )
        if trip_id is not None:
            return trip_id, True
        existing = session.scalars(
            select(CommunityTrip)
            .where(
                CommunityTrip.start_key == keys[0],
                CommunityTrip.end_key == keys[1],
                CommunityTrip.purpose == nomination.purpose,
            )
            .with_for_update()
        ).one()
        if field:
            existing.field_nominated = True
        return existing.id, False


def catalog(session: Session, page: int, limit: int) -> tuple[TripCatalog, int]:
    rows = session.execute(
        SUMMARY.order_by(CommunityTrip.created_at.desc(), CommunityTrip.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    trips = tuple(TripSummary.model_validate(row) for row in rows.mappings())
    landmarks = session.execute(LANDMARKS.order_by("name", "key")).mappings()
    return TripCatalog(
        landmarks=tuple(Landmark.model_validate(row) for row in landmarks), trips=trips
    ), session.scalar(select(func.count()).select_from(CommunityTrip)) or 0


def detail(session: Session, trip_id: UUID) -> TripDetail | None:
    row = (
        session.execute(
            SUMMARY.add_columns(
                CommunityTrip.start_key, CommunityTrip.end_key, CommunityTrip.created_at
            ).where(CommunityTrip.id == trip_id)
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        return None
    events = session.execute(
        select(
            TripEvent.kind,
            TripEvent.observed_on,
            TripEvent.recorded_at,
            TripEvent.reference,
            TripEvent.report_id,
        )
        .where(TripEvent.trip_id == trip_id)
        .order_by(TripEvent.observed_on, TripEvent.recorded_at, TripEvent.id)
    ).mappings()
    return TripDetail.model_validate(
        {
            **row,
            "events": tuple(PublicEvent.model_validate(e) for e in events),
            "analysis": analyze_trip(session, row["start_key"], row["end_key"]),
        }
    )
