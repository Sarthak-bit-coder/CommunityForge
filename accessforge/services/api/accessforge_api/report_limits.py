"""Bounded process-local submission limits; never trust forwarded client headers."""

from collections import deque
from math import ceil
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request

REPORTS_PER_WINDOW = 10
WINDOW_SECONDS = 60
MAX_TRACKED_CLIENTS = 10_000


class ReportLimiter:
    def __init__(self) -> None:
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
            if len(times) >= REPORTS_PER_WINDOW:
                raise HTTPException(
                    429,
                    headers={
                        "Retry-After": str(
                            max(1, ceil(times[0] + WINDOW_SECONDS - now))
                        )
                    },
                )
            times.append(now)


def limit_submission(request: Request) -> None:
    # shortcut: process-local limits; use a shared limiter before multiworker deployment.
    # Inactive peer buckets are pruned on requests, never persisted or logged.
    client = request.client.host if request.client else "unknown"
    request.app.state.report_limiter.check(client)
