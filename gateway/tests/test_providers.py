"""Explicit provider routing: "provider:model" targets + BYOK override."""
from unittest.mock import patch

from app.services import llm


def _settings(**kw):
    s = type("S", (), {})()
    s.openai_api_key = kw.get("openai", "")
    s.anthropic_api_key = kw.get("anthropic", "")
    s.gemini_api_key = kw.get("gemini", "")
    s.groq_api_key = kw.get("groq", "gsk_platform")
    return s


def test_explicit_openai_target_uses_env_key():
    with patch("app.services.llm.get_settings", return_value=_settings(openai="sk-platform")):
        base, key, model = llm.provider_target("openai:gpt-4o-mini")
    assert base == "https://api.openai.com/v1"
    assert key == "sk-platform"
    assert model == "gpt-4o-mini"


def test_byok_key_wins_over_platform_key():
    with patch("app.services.llm.get_settings", return_value=_settings(openai="sk-platform")):
        _, key, _ = llm.provider_target("openai:gpt-4o-mini", {"openai": "sk-tenant"})
    assert key == "sk-tenant"


def test_anthropic_and_gemini_presets():
    with patch("app.services.llm.get_settings", return_value=_settings(anthropic="sk-ant", gemini="gm")):
        assert llm.provider_target("anthropic:claude-sonnet-4-5")[0] == "https://api.anthropic.com/v1"
        assert "generativelanguage" in llm.provider_target("gemini:gemini-2.5-flash")[0]


def test_lane_alias_is_not_a_provider_target():
    with patch("app.services.llm.get_settings", return_value=_settings()):
        assert llm.provider_target("chat-local") is None
        assert llm.provider_target("auto") is None
        # Groq's real model name uses a slash, not a colon: stays a lane concern
        assert llm.provider_target("openai/gpt-oss-20b") is None
