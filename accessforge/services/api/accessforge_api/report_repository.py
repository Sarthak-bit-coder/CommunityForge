"""Transactional report persistence and parameterized, bounded read queries."""

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Float, Row, Select, func, select
from sqlalchemy.orm import Session

from .models import Barrier, EvidenceProvenance, Location, Report
from .report_schemas import EvidenceView, ReportCreate, ReportView
from .schemas import BarrierType, EvidenceSource, LocationInput, VerificationStatus

# Assumed neutral prior for unverified reports, not an empirically calibrated probability.
UNVERIFIED_PRESENCE_PROBABILITY = 0.5


def report_query(
    barrier_type: BarrierType | None = None, state: VerificationStatus | None = None
) -> Select[Report, Barrier, float, float]:
    statement = (
        select(
            Report,
            Barrier,
            func.ST_X(Location.geom, type_=Float),
            func.ST_Y(Location.geom, type_=Float),
        )
        .join(Barrier, Report.barrier_id == Barrier.id)
        .join(Location, Barrier.location_id == Location.id)
    )
    if barrier_type is not None:
        statement = statement.where(Barrier.type == barrier_type)
    if state is not None:
        statement = statement.where(Barrier.state == state)
    return statement


def _views(
    session: Session, rows: Sequence[Row[Report, Barrier, float, float]]
) -> tuple[ReportView, ...]:
    barrier_ids = {row[1].id for row in rows}
    evidence: dict[UUID, list[EvidenceView]] = {key: [] for key in barrier_ids}
    if barrier_ids:
        records = session.scalars(
            select(EvidenceProvenance)
            .where(EvidenceProvenance.barrier_id.in_(barrier_ids))
            .order_by(EvidenceProvenance.recorded_at, EvidenceProvenance.id)
        )
        for record in records:
            evidence[record.barrier_id].append(
                EvidenceView(
                    source=record.source,
                    source_ref=record.source_ref,
                    source_version=record.source_version,
                    observed_at=record.observed_at,
                    recorded_at=record.recorded_at,
                )
            )
    return tuple(
        ReportView(
            id=report.id,
            barrier_id=barrier.id,
            type=barrier.type,
            description=report.description,
            location=LocationInput(longitude=longitude, latitude=latitude),
            severity=barrier.severity,
            state=barrier.state,
            created_at=report.created_at,
            evidence=tuple(evidence[barrier.id]),
        )
        for report, barrier, longitude, latitude in rows
    )


def get_report(session: Session, report_id: UUID) -> ReportView | None:
    rows = session.execute(report_query().where(Report.id == report_id)).all()
    views = _views(session, rows)
    return views[0] if views else None


def list_reports(
    session: Session,
    *,
    page: int,
    limit: int,
    barrier_type: BarrierType | None,
    state: VerificationStatus | None,
) -> tuple[tuple[ReportView, ...], int]:
    statement = report_query(barrier_type, state)
    total = session.scalar(select(func.count()).select_from(statement.subquery()))
    rows = session.execute(
        statement.order_by(Report.created_at.desc(), Report.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    ).all()
    return _views(session, rows), int(total or 0)


def create_report(session: Session, payload: ReportCreate) -> ReportView:
    with session.begin():
        location = Location(
            geom=func.ST_SetSRID(
                func.ST_MakePoint(
                    payload.location.longitude, payload.location.latitude
                ),
                4326,
            )
        )
        session.add(location)
        session.flush()
        barrier = Barrier(
            location_id=location.id,
            type=payload.type,
            description=payload.description,
            severity=payload.severity,
            state=VerificationStatus.unverified,
            presence_prob=UNVERIFIED_PRESENCE_PROBABILITY,
        )
        session.add(barrier)
        session.flush()
        report = Report(barrier_id=barrier.id, description=payload.description)
        session.add(report)
        session.flush()
        session.add(
            EvidenceProvenance(
                barrier_id=barrier.id,
                source=EvidenceSource.community_report,
                source_ref=str(report.id),
                observed_at=report.created_at,
            )
        )
        session.flush()
        result = get_report(session, report.id)
        if result is None:
            raise RuntimeError("new report was not readable within its transaction")
    return result
