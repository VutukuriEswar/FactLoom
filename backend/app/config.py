from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    openrouter_api_key: str
    openrouter_model: str = "anthropic/claude-sonnet-4-5"

    batch_size: int = 5
    extractor_backend: str = "api"

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "factloom"

    cors_origins: str = "http://localhost:5173"

    max_upload_mb: int = 50

    port: int = 8000

    embedding_model: str = "all-MiniLM-L6-v2"

    top_k_candidates: int = 5

    @field_validator("openrouter_api_key")
    @classmethod
    def api_key_must_be_set(cls, v: str) -> str:
        if not v or v.strip() == "":
            raise ValueError("OPENROUTER_API_KEY must be set in .env")
        return v.strip()

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
