"""The architecture's shared success/error envelope."""

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class ErrorDetail(BaseModel):
    model_config = ConfigDict(frozen=True)
    field: str
    message: str


class ApiError(BaseModel):
    model_config = ConfigDict(frozen=True)
    code: str
    message: str
    details: tuple[ErrorDetail, ...] = ()


class Envelope(BaseModel, Generic[T]):
    model_config = ConfigDict(frozen=True)
    data: T | None = None
    error: ApiError | None = None
    meta: dict[str, int] = Field(default_factory=dict)


class Health(BaseModel):
    model_config = ConfigDict(frozen=True)
    status: str
