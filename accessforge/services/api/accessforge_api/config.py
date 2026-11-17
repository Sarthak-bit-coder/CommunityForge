"""Environment settings validated at application startup and migration execution."""

from typing import Literal

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", extra="ignore", frozen=True, hide_input_in_errors=True
    )

    database_url: SecretStr
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    @field_validator("database_url")
    @classmethod
    def postgres_url(cls, value: SecretStr) -> SecretStr:
        try:
            url = make_url(value.get_secret_value())
        except (ArgumentError, ValueError) as error:
            raise ValueError("DATABASE_URL must be a valid PostgreSQL URL") from error
        if url.drivername != "postgresql+psycopg" or not url.host or not url.database:
            raise ValueError(
                "DATABASE_URL requires postgresql+psycopg, a host, and a database"
            )
        return value
