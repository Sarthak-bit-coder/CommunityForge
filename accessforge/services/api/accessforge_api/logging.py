"""JSON application logs with allowlisted fields, never request bodies or SQL."""

import json
import logging
from datetime import UTC, datetime

logger = logging.getLogger("accessforge_api")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps(
            {
                "timestamp": datetime.now(UTC).isoformat(),
                "level": record.levelname,
                "event": record.getMessage(),
                "request_id": getattr(record, "request_id", None),
                "error_type": getattr(record, "error_type", None),
            }
        )


def configure_logging(level: str) -> None:
    if not any(
        isinstance(handler.formatter, JsonFormatter) for handler in logger.handlers
    ):
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
    logger.setLevel(level)
    logger.propagate = False
