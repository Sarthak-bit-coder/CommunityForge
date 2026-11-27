"""SQLAlchemy lifetime and request-session boundaries; no implicit schema writes."""

from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session

from .config import Settings

CONNECT_TIMEOUT_S = 5
STATEMENT_TIMEOUT_MS = 2000


class Base(DeclarativeBase):
    pass


def make_engine(settings: Settings) -> Engine:
    return create_engine(
        settings.database_url.get_secret_value(),
        pool_pre_ping=True,
        hide_parameters=True,
        connect_args={
            "connect_timeout": CONNECT_TIMEOUT_S,
            "options": f"-c statement_timeout={STATEMENT_TIMEOUT_MS}",
        },
    )


def get_session(request: Request) -> Iterator[Session]:
    with Session(request.app.state.engine) as session:
        yield session
