"""Sanitized HTTP failures; internal exception text never enters responses."""

from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException

from .logging import logger
from .responses import ApiError, ErrorDetail


def _response(request: Request, status: int, error: ApiError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid4()))
    logger.warning(error.code, extra={"request_id": request_id})
    return JSONResponse(
        status_code=status,
        content={"data": None, "error": error.model_dump(mode="json"), "meta": {}},
        headers={"X-Request-ID": request_id},
    )


async def validation_error(
    request: Request, error: RequestValidationError
) -> JSONResponse:
    details = tuple(
        ErrorDetail(
            field=".".join(str(part) for part in item["loc"]), message=item["msg"]
        )
        for item in error.errors()
    )
    return _response(
        request,
        422,
        ApiError(
            code="validation_error",
            message="Input validation failed.",
            details=details,
        ),
    )


async def http_error(request: Request, error: HTTPException) -> JSONResponse:
    message = (
        "Resource not found."
        if error.status_code == 404
        else "Request could not be completed."
    )
    response = _response(
        request, error.status_code, ApiError(code="http_error", message=message)
    )
    if error.headers:
        response.headers.update(error.headers)
    return response


async def database_error(request: Request, error: SQLAlchemyError) -> JSONResponse:
    return _response(
        request,
        503,
        ApiError(
            code="database_unavailable",
            message="Database or PostGIS is unavailable.",
        ),
    )


async def unexpected_error(request: Request, error: Exception) -> JSONResponse:
    return _response(
        request,
        500,
        ApiError(
            code="internal_error",
            message="An unexpected error occurred.",
        ),
    )


def register_handlers(app: FastAPI) -> None:
    app.add_exception_handler(RequestValidationError, validation_error)  # type: ignore[arg-type]
    app.add_exception_handler(HTTPException, http_error)  # type: ignore[arg-type]
    app.add_exception_handler(SQLAlchemyError, database_error)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, unexpected_error)
