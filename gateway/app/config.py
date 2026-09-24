from functools import lru_cache

from pydantic import field_validator

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, sourced from environment / .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    local_model: str = "ollama/llama3.1:8b-instruct-q4_K_M"
    cloud_model: str = "gpt-4o-mini"
    # model aliases exposed by the litellm proxy
    lane_local_alias: str = "chat-local"
    lane_cloud_alias: str = "chat-cloud"
    embed_alias: str = "embed-local"

    litellm_base_url: str = "http://localhost:4000"

    @field_validator("litellm_base_url")
    @classmethod
    def _with_scheme(cls, v: str) -> str:
        # Render's fromService host property provides a bare hostname.
        if v and not v.startswith(("http://", "https://")):
            return f"https://{v}"
        return v
    litellm_master_key: str = "sk-tokenroute-dev"

    redis_url: str = "redis://localhost:6379/0"
    database_url: str = "postgresql://postgres:postgres@localhost:5432/tokenroute"

    cache_threshold: float = 0.92
    embedding_dim: int = 768
    cache_max_entries: int = 1000
    rate_limit_per_minute: int = 30

    rag_top_k: int = 4
    chunk_size: int = 800
    chunk_overlap: int = 120

    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    langfuse_host: str = "https://cloud.langfuse.com"

    # USD per 1M tokens, input/output. local is free by definition.
    cloud_input_cost_per_mtok: float = 0.15
    cloud_output_cost_per_mtok: float = 0.60


@lru_cache
def get_settings() -> Settings:
    return Settings()
