"""Boundary validation shared by immutable engine inputs."""

from math import isfinite
from typing import TypeVar


class InvalidInstanceError(ValueError):
    """An engine input violates the model contract."""


def identifier(value: object, name: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise InvalidInstanceError(f"{name} must be a nonempty string")


def number(value: object, name: str, *, signed: bool = False) -> None:
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not isfinite(value)
        or (not signed and value < 0)
    ):
        raise InvalidInstanceError(
            f"{name} must be finite and {'numeric' if signed else 'nonnegative'}"
        )


T = TypeVar("T")


def unique(values: tuple[T, ...], name: str) -> None:
    if len(set(values)) != len(values):
        raise InvalidInstanceError(f"duplicate {name}")
