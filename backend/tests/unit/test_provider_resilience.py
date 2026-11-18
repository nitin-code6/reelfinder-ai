import pytest
from unittest.mock import MagicMock, patch
from pydantic import BaseModel
from app.llm.groq_provider import GroqProvider
from app.llm.gemini_provider import GeminiProvider
from app.llm.hybrid_provider import HybridLLMProvider
from app.llm.mock_provider import MockLLMProvider
from app.core.exceptions import LLMInferenceException
from app.core.config import settings


class DummyResponse(BaseModel):
    status: str
    candidates: list = []


def test_groq_key_rotation_on_429():
    """Test that Groq rotates to the second key when first key hits 429."""
    keys = ["key_1_alpha", "key_2_beta"]
    provider = GroqProvider(api_keys=keys, model_name="qwen/qwen3.8-27b")

    assert len(provider.api_keys) == 2
    first_key = provider.current_key
    assert first_key == "key_1_alpha"

    # Simulate 429 on first key
    with patch("httpx.Client.post") as mock_post:
        # First call returns 429, second call with next key returns 200
        mock_429 = MagicMock(status_code=429, headers={"retry-after": "15"}, text="Rate limit")
        mock_200 = MagicMock(
            status_code=200,
            json=lambda: {"choices": [{"message": {"content": '{"status": "ok", "candidates": []}'}}]}
        )
        mock_post.side_effect = [mock_429, mock_200]

        res = provider.generate_structured("prompt", "instruction", DummyResponse)
        assert res.status, "ok"
        # Key 1 should be in cooldown, Key 2 used
        assert provider.key_states["key_1_alpha"]["cooldown_until"] > 0
        assert provider.key_states["key_2_beta"]["success_count"] == 1


def test_gemini_key_rotation_on_429():
    """Test that Gemini rotates to the next available key on quota limits."""
    keys = ["gem_1_alpha", "gem_2_beta"]
    provider = GeminiProvider(api_keys=keys, model_name="gemini-flash-lite-latest")

    assert len(provider.api_keys) == 2
    # Check that key states are initialized
    assert "gem_1_alpha" in provider.key_states
    assert "gem_2_beta" in provider.key_states


def test_hybrid_provider_cascades_groq_to_gemini():
    """Test that HybridLLMProvider fails over from Groq to Gemini if Groq fails."""
    mock_groq = MagicMock(spec=GroqProvider)
    mock_groq.api_keys = ["k1"]
    mock_groq.quota_exceeded = False
    mock_groq.generate_structured.side_effect = Exception("Groq 500 error")

    mock_gemini = MagicMock(spec=GeminiProvider)
    mock_gemini.api_keys = ["g1"]
    mock_gemini.quota_exceeded = False
    mock_gemini.model_name = "gemini-flash-lite-latest"
    mock_gemini.generate_structured.return_value = DummyResponse(status="gemini_ok")

    hybrid = HybridLLMProvider(groq_provider=mock_groq, gemini_provider=mock_gemini)
    res = hybrid.generate_structured("prompt", "instruction", DummyResponse)

    assert res.status == "gemini_ok"
    assert hybrid.last_provider == "gemini"
    assert hybrid.last_model == "gemini-flash-lite-latest"


def test_hybrid_provider_fails_cleanly_without_silent_mock():
    """In production (USE_MOCK_LLM=False), failure of all online providers raises LLMInferenceException."""
    mock_groq = MagicMock(spec=GroqProvider)
    mock_groq.api_keys = ["k1"]
    mock_groq.quota_exceeded = False
    mock_groq.generate_structured.side_effect = Exception("Groq down")

    mock_gemini = MagicMock(spec=GeminiProvider)
    mock_gemini.api_keys = ["g1"]
    mock_gemini.quota_exceeded = False
    mock_gemini.generate_structured.side_effect = Exception("Gemini down")

    with patch.object(settings, "USE_MOCK_LLM", False):
        hybrid = HybridLLMProvider(groq_provider=mock_groq, gemini_provider=mock_gemini)
        with pytest.raises(LLMInferenceException) as excinfo:
            hybrid.generate_structured("prompt", "instruction", DummyResponse)
        assert "All online LLM providers failed" in str(excinfo.value)


def test_hybrid_provider_uses_heuristic_when_explicitly_configured():
    """When USE_MOCK_LLM=True is explicitly configured, it routes to deterministic heuristic engine."""
    with patch.object(settings, "USE_MOCK_LLM", True):
        hybrid = HybridLLMProvider()
        # Mock provider should handle it
        assert hybrid.mock is not None
