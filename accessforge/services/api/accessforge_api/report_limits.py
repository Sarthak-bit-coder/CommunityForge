"""Bounded process-local submission limits; never trust forwarded client headers."""

from collections import deque
from math import ceil
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request

REPORTS_PER_WINDOW = 10
# Planning runs are read-only but CPU-bound; completed runs are also cached.
PLANS_PER_WINDOW = 60
WINDOW_SECONDS = 60
MAX_TRACKED_CLIENTS = 10_000


class ReportLimiter:
    def __init__(self, limit: int = REPORTS_PER_WINDOW) -> None:
        self._limit = limit
        self._requests: dict[str, deque[float]] = {}
        self._lock = Lock()

    def check(self, client: str) -> None:
        now = monotonic()
        with self._lock:
            self._requests = {
                key: times
                for key, times in self._requests.items()
                if times[-1] > now - WINDOW_SECONDS
            }
            times = self._requests.get(client)
            if times is None:
                if len(self._requests) >= MAX_TRACKED_CLIENTS:
                    raise HTTPException(
                        429, headers={"Retry-After": str(WINDOW_SECONDS)}
                    )
                times = self._requests.setdefault(client, deque())
            while times and times[0] <= now - WINDOW_SECONDS:
                times.popleft()
            if len(times) >= self._limit:
                raise HTTPException(
                    429,
                    headers={
                        "Retry-After": str(
                            max(1, ceil(times[0] + WINDOW_SECONDS - now))
                        )
                    },
                )
            times.append(now)


def _peer(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def limit_submission(request: Request) -> None:
    # shortcut: process-local limits; use a shared limiter before multiworker deployment.
    # Inactive peer buckets are pruned on requests, never persisted or logged.
    request.app.state.report_limiter.check(_peer(request))


def limit_planning(request: Request) -> None:
    request.app.state.plan_limiter.check(_peer(request))
