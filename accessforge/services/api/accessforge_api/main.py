"""FastAPI application factory; startup validates config, never applies migrations."""

from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request, Response

from .config import Settings
from .database import make_engine
from .errors import register_handlers
from .health import router
from .logging import configure_logging
from .report_limits import ReportLimiter
from .reports import router as reports_router


def create_app(settings: Settings | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        config = settings if settings is not None else Settings()
        configure_logging(config.log_level)
        engine = make_engine(config)
        app.state.engine = engine
        try:
            yield
        finally:
            engine.dispose()

    app = FastAPI(title="AccessForge API", version="0.1.0", lifespan=lifespan)
    register_handlers(app)
    app.include_router(router)
    app.include_router(reports_router)
    app.state.report_limiter = ReportLimiter()

    @app.middleware("http")
    async def request_id(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request.state.request_id = str(uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    return app
