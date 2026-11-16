import json
import time
from typing import Type, TypeVar, List
from pydantic import BaseModel
import google.generativeai as genai
from app.llm.base_provider import BaseLLMProvider
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
        if not self.api_key:
            raise LLMInferenceException("GEMINI_API_KEY is not configured.")
        if self.quota_exceeded:
            raise LLMInferenceException("Gemini API daily quota limit previously exceeded (429).")

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

                    # Quota exceeded (429): fast-fail
                    if "429" in err_msg or "quota" in err_msg.lower():
                        logger.warning("Gemini API daily quota limit reached (429).")
                        self.quota_exceeded = True
                        raise LLMInferenceException(f"Gemini API daily quota limit exceeded (429): {err_msg}")

                    # Auth / API key failure (400, 403): fast-fail immediately without retries
                    if any(k in err_msg.lower() for k in ["api_key", "invalid", "unregistered", "permission denied", "forbidden", "400", "403"]):
                        raise LLMInferenceException(f"Gemini API authentication failed: {err_msg}")

                    # If 404 not found, immediately move to next model without wasting retries
                    if "404" in err_msg or "not found" in err_msg.lower():
                        break
                    time.sleep(delay)

        raise LLMInferenceException(f"All Gemini models exhausted. Last error: {last_error}")

