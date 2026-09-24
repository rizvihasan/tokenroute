from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, sourced from environment / .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    local_model: str = "ollama/llama3.1:8b-instruct-q4_K_M"
    cloud_model: str = "gpt-4o-mini"
    # lane aliases used across logs, metrics and the UI
    lane_local_alias: str = "chat-local"
    lane_cloud_alias: str = "chat-cloud"
    embed_alias: str = "embed-local"

    # Provider endpoints (OpenAI-compatible). The deployed stack goes
    # straight to Groq / Jina - no proxy container. Local docker-compose
    # overrides these to the LiteLLM container for the Ollama path.
    chat_local_base_url: str = "https://api.groq.com/openai/v1"
    chat_local_api_key: str = ""  # falls back to groq_api_key
    chat_local_model: str = "openai/gpt-oss-20b"
    chat_cloud_base_url: str = "https://api.groq.com/openai/v1"
    chat_cloud_api_key: str = ""  # falls back to groq_api_key
    chat_cloud_model: str = "openai/gpt-oss-120b"
    embed_base_url: str = "https://api.jina.ai/v1"
    embed_api_key: str = ""  # falls back to jina_api_key
    embed_model: str = "jina-embeddings-v3"
    # 0 = provider native size; when set it must equal embedding_dim (the
    # pgvector column size). jina-embeddings-v3 native is 1024.
    embed_dimensions: int = 0
    groq_api_key: str = ""
    jina_api_key: str = ""

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
