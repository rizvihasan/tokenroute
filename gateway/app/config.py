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
    # provider names used for BYOK lookup (tenant provider_keys table)
    chat_provider: str = "groq"
    embed_provider: str = "jina"
    groq_api_key: str = ""
    jina_api_key: str = ""
    # optional extra chat providers (explicit "provider:model" requests)
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    gemini_api_key: str = ""

    # multi-tenancy (open core): off for local dev / the public demo,
    # on for a hosted deployment
    tenancy_enabled: bool = False
    admin_key: str = ""  # protects /admin provisioning endpoints
    byok_master_key: str = ""  # Fernet key encrypting tenant provider keys

    # guardrails: off (self-host default) | log | block
    guardrails_mode: str = "off"

    # billing (hosted control plane). Empty provider = billing disabled;
    # checkout returns 501 until real credentials are plugged in.
    billing_provider: str = ""  # "" | "razorpay" | "stripe"
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    razorpay_plan_id_pro: str = ""  # created once in the Razorpay dashboard
    stripe_api_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_id_pro: str = ""

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
