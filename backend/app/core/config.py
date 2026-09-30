"""
Application configuration.

Centralizes all environment-driven settings using pydantic-settings.
No secrets are hard-coded here — everything is read from environment
variables / a local .env file (see .env.example).
"""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --- App ---
    environment: str = "development"
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:5173"

    # --- MongoDB ---
    mongodb_uri: str
    # NOTE: kept as "sahaara_ai" intentionally — this is the existing,
    # already-connected Atlas database name from Phase 1/2. Renaming it
    # is a data-migration concern, not a branding one, so it is left
    # unchanged by the EVARA project rename (see README).
    mongodb_db_name: str = "sahaara_ai"

    # --- JWT Auth ---
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 hours

    # --- SLM (used from Phase 2 onward) ---
    slm_model: str = ""
    mock_slm: bool = True
    hf_token: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor so the .env file is only parsed once."""
    return Settings()
