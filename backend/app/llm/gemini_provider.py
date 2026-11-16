import json
import time
from typing import Type, TypeVar, List
from pydantic import BaseModel
import google.generativeai as genai
from app.llm.base_provider import BaseLLMProvider
from app.llm.mock_provider import MockLLMProvider
from app.core.config import settings
from app.core.logging import logger
from app.core.exceptions import LLMInferenceException

T = TypeVar("T", bound=BaseModel)

FALLBACK_MODELS = [
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]


class GeminiProvider(BaseLLMProvider):
    def __init__(self, api_key: str = settings.GEMINI_API_KEY, model_name: str = settings.GEMINI_MODEL):
        self.api_key = api_key
        self.model_name = model_name or "gemini-3.8-flash"
        self.mock_fallback = MockLLMProvider()
        self.quota_exceeded = False
        if self.api_key:
            genai.configure(api_key=self.api_key)
        else:
            logger.warning("GeminiProvider initialized without API key! Ensure GEMINI_API_KEY is configured.")

    def generate_structured(
        self,
        prompt: str,
        system_instruction: str,
        response_schema: Type[T],
        temperature: float = 0.2
    ) -> T:
        if not self.api_key or self.quota_exceeded:
            if self.quota_exceeded:
                logger.info("Gemini quota previously exhausted (429). Fast-routing to heuristic discovery engine.")
            else:
                logger.warning("GEMINI_API_KEY not configured. Falling back to deterministic mock provider.")
            return self.mock_fallback.generate_structured(prompt, system_instruction, response_schema)

        # Build list of models to try, starting with configured model
        models_to_try = [self.model_name] + [m for m in FALLBACK_MODELS if m != self.model_name]

        last_error = None
        for current_model in models_to_try:
            max_retries = 1  # Fail fast to avoid freezing user UI
            delay = 1.0

            for attempt in range(1, max_retries + 1):
                try:
                    logger.info(f"Invoking Gemini with model '{current_model}' (attempt {attempt}/{max_retries})...")
                    model = genai.GenerativeModel(
                        model_name=current_model,
                        system_instruction=system_instruction,
                        generation_config={
                            "response_mime_type": "application/json",
                            "temperature": temperature,
                        }
                    )

                    response = model.generate_content(prompt)
                    raw_text = response.text.strip()
                    
                    # Strip markdown code blocks if present
                    if raw_text.startswith("```json"):
                        raw_text = raw_text[7:]
                    if raw_text.endswith("```"):
                        raw_text = raw_text[:-3]
                    raw_text = raw_text.strip()

                    parsed_obj = response_schema.model_validate_json(raw_text)
                    # Cache successful model
                    self.model_name = current_model
                    return parsed_obj

                except Exception as e:
                    err_msg = str(e)
                    logger.warning(f"Gemini model '{current_model}' attempt {attempt} failed: {err_msg}")
                    last_error = e

                    # Quota exceeded (429): fast-fail all future calls and switch immediately to heuristic engine
                    if "429" in err_msg or "quota" in err_msg.lower():
                        logger.warning("Gemini API daily quota limit reached (429). Enabling fast heuristic fallback.")
                        self.quota_exceeded = True
                        return self.mock_fallback.generate_structured(prompt, system_instruction, response_schema)

                    # If 404 not found, immediately move to next model without wasting retries
                    if "404" in err_msg or "not found" in err_msg.lower():
                        break
                    time.sleep(delay)

        logger.error(f"All Gemini models exhausted. Error: {last_error}. Gracefully falling back to heuristic mock provider to preserve uninterrupted editing workflow.")
        return self.mock_fallback.generate_structured(prompt, system_instruction, response_schema)

