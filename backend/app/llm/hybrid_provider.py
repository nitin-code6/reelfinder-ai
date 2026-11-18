import time
from typing import Type, TypeVar, Optional
from pydantic import BaseModel
from app.llm.base_provider import BaseLLMProvider
from app.llm.groq_provider import GroqProvider
from app.llm.gemini_provider import GeminiProvider
from app.llm.mock_provider import MockLLMProvider
from app.core.config import settings
from app.core.logging import logger
from app.core.exceptions import LLMInferenceException

T = TypeVar("T", bound=BaseModel)


class HybridLLMProvider(BaseLLMProvider):
    """
    Intelligent resilient LLM provider with transparent failover:
    Tier 1: Groq LPU inference (multi-key pool with automatic rotation)
    Tier 2: Google Gemini (multi-key pool with flash-lite failover)
    Tier 3 (EXPLICIT ONLY): Deterministic Heuristic Engine
      - ONLY used if settings.USE_MOCK_LLM is True (e.g. offline testing).
      - NEVER silently replaces failed online LLMs in production.
    """
    def __init__(
        self,
        groq_provider: Optional[GroqProvider] = None,
        gemini_provider: Optional[GeminiProvider] = None,
        mock_provider: Optional[MockLLMProvider] = None,
    ):
        self.groq = groq_provider or GroqProvider()
        self.gemini = gemini_provider or GeminiProvider()
        self.mock = mock_provider or MockLLMProvider()
        self.last_provider: str = "groq"
        self.last_model: str = settings.GROQ_MODEL or "qwen/qwen3.8-27b"

    def generate_structured(
        self,
        prompt: str,
        system_instruction: str,
        response_schema: Type[T],
        temperature: float = 0.2
    ) -> T:
        # If offline mock mode is explicitly forced in configuration
        if settings.USE_MOCK_LLM:
            logger.info("Explicit USE_MOCK_LLM=True enabled. Routing to Deterministic Heuristic Engine...")
            self.last_provider = "heuristic"
            self.last_model = "deterministic-engine"
            return self.mock.generate_structured(
                prompt=prompt,
                system_instruction=system_instruction,
                response_schema=response_schema,
                temperature=temperature
            )

        errors = []

        # Tier 1: Try Groq if keys exist and not all in cooldown
        if self.groq.api_keys and not self.groq.quota_exceeded:
            try:
                logger.info("Attempting inference with Tier 1: Groq LPU...")
                t0 = time.time()
                result = self.groq.generate_structured(
                    prompt=prompt,
                    system_instruction=system_instruction,
                    response_schema=response_schema,
                    temperature=temperature
                )
                self.last_provider = "groq"
                self.last_model = self.groq.model_name
                logger.info(f"Tier 1 (Groq - {self.last_model}) completed in {time.time() - t0:.2f}s.")
                return result
            except Exception as e:
                err_msg = f"Groq failure: {str(e)}"
                logger.warning(f"Tier 1 failed: {err_msg}. Cascading to Tier 2 (Gemini)...")
                errors.append(err_msg)

        # Tier 2: Try Gemini if keys exist and not all in cooldown
        if self.gemini.api_keys and not self.gemini.quota_exceeded:
            try:
                logger.info("Attempting inference with Tier 2: Google Gemini...")
                t0 = time.time()
                result = self.gemini.generate_structured(
                    prompt=prompt,
                    system_instruction=system_instruction,
                    response_schema=response_schema,
                    temperature=temperature
                )
                self.last_provider = "gemini"
                self.last_model = self.gemini.model_name
                logger.info(f"Tier 2 (Gemini - {self.last_model}) completed in {time.time() - t0:.2f}s.")
                return result
            except Exception as e:
                err_msg = f"Gemini failure: {str(e)}"
                logger.warning(f"Tier 2 failed: {err_msg}.")
                errors.append(err_msg)

        # In production, DO NOT silently fall back to heuristic mock if online LLMs failed!
        # Report the real failure transparently.
        combined_error = " | ".join(errors) if errors else "No active online LLM keys available or all in cooldown."
        logger.error(f"All online LLM providers failed: {combined_error}")
        raise LLMInferenceException(f"All online LLM providers failed: {combined_error}")
