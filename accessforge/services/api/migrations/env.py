"""Run migrations using environment settings or a caller-owned test connection."""

from alembic import context
from sqlalchemy.engine import Connection

from accessforge_api import models
from accessforge_api.config import Settings
from accessforge_api.database import make_engine

config = context.config
target_metadata = models.Location.metadata


def run_with_connection(connection: Connection) -> None:
    context.configure(
        connection=connection, target_metadata=target_metadata, compare_type=True
    )
    with context.begin_transaction():
        context.run_migrations()


def run_online() -> None:
    connection = config.attributes.get("connection")
    if connection is not None:
        run_with_connection(connection)
        return
    engine = make_engine(Settings())
    try:
        with engine.connect() as connection:
            run_with_connection(connection)
    finally:
        engine.dispose()


if context.is_offline_mode():
    context.configure(
        url=Settings().database_url.get_secret_value(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    run_online()
