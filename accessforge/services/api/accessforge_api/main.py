"""FastAPI application factory; startup validates config, never applies migrations."""

from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request, Response

from .auth import parse_reviewer_keys
from .config import Settings
from .database import make_engine
from .errors import register_handlers
from .feedback import router as feedback_router
from .health import router
from .logging import configure_logging
from .network import router as network_router
from .pilot_plans import start_precompute
from .planning import router as planning_router
from .report_limits import (
    FEEDBACK_PER_WINDOW,
    PLANS_PER_WINDOW,
    ReportLimiter,
    parse_proxy_ips,
)
from .reports import router as reports_router
from .reviews import router as reviews_router
from .routing import router as routing_router
from .trips import router as trips_router


def create_app(settings: Settings | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        config = settings if settings is not None else Settings()
        configure_logging(config.log_level)
        engine = make_engine(config)
        app.state.engine = engine
        app.state.reviewer_keys = parse_reviewer_keys(
            config.reviewer_keys.get_secret_value()
        )
        app.state.reviewer_cookie_secure = config.reviewer_cookie_secure
        app.state.trusted_proxies = parse_proxy_ips(config.trusted_proxy_ips)
        start_precompute(engine)
        try:
            yield
        finally:
            engine.dispose()

    app = FastAPI(title="AccessForge API", version="0.1.0", lifespan=lifespan)
    register_handlers(app)
    app.include_router(router)
    app.include_router(reports_router)
    app.include_router(planning_router)
    app.include_router(reviews_router)
    app.include_router(feedback_router)
    app.include_router(network_router)
    app.include_router(routing_router)
    app.include_router(trips_router)
    app.state.report_limiter = ReportLimiter()
    app.state.plan_limiter = ReportLimiter(PLANS_PER_WINDOW)
    app.state.sign_in_limiter = ReportLimiter()
    app.state.trusted_proxies = frozenset[str]()
    app.state.feedback_limiter = ReportLimiter(FEEDBACK_PER_WINDOW)

    @app.middleware("http")
    async def request_id(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request.state.request_id = str(uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    return app
