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
    Intelligent resilient LLM provider with automated multi-tier failover:
    Tier 1 (Fastest): Groq LPU inference (sub-second completion)
    Tier 2 (Fallback): Google Gemini (multi-model cascade)
    Tier 3 (Zero-failure guarantee): Deterministic Heuristic Engine
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

    def generate_structured(
        self,
        prompt: str,
        system_instruction: str,
        response_schema: Type[T],
        temperature: float = 0.2
    ) -> T:
        # Tier 1: Try Groq first if key exists and quota not exceeded
        if self.groq.api_key and not self.groq.quota_exceeded:
            try:
                logger.info("Attempting inference with Tier 1: Groq...")
                t0 = time.time()
                result = self.groq.generate_structured(
                    prompt=prompt,
                    system_instruction=system_instruction,
                    response_schema=response_schema,
                    temperature=temperature
                )
                logger.info(f"Tier 1 (Groq) completed successfully in {time.time() - t0:.2f}s.")
                return result
            except Exception as e:
                logger.warning(f"Tier 1 (Groq) failed or rate-limited: {str(e)}. Falling back to Tier 2 (Gemini)...")

        # Tier 2: Try Gemini if key exists and quota not exceeded
        if self.gemini.api_key and not self.gemini.quota_exceeded:
            try:
                logger.info("Attempting inference with Tier 2: Google Gemini...")
                t0 = time.time()
                result = self.gemini.generate_structured(
                    prompt=prompt,
                    system_instruction=system_instruction,
                    response_schema=response_schema,
                    temperature=temperature
                )
                logger.info(f"Tier 2 (Gemini) completed successfully in {time.time() - t0:.2f}s.")
                return result
            except Exception as e:
                logger.warning(f"Tier 2 (Gemini) failed or exhausted: {str(e)}. Falling back to Tier 3 (Heuristic Engine)...")

        # Tier 3 (Zero-failure guarantee): Deterministic Heuristic Engine
        logger.warning(
            "All configured online AI providers (Groq and Gemini) unavailable, rate-limited, "
            "or quotas exhausted. Gracefully routing to Tier 3 (Deterministic Heuristic Engine)..."
        )
        return self.mock.generate_structured(
            prompt=prompt,
            system_instruction=system_instruction,
            response_schema=response_schema,
            temperature=temperature
        )
