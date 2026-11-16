import json
import time
from typing import Type, TypeVar
from pydantic import BaseModel
import google.generativeai as genai
from app.llm.base_provider import BaseLLMProvider
from app.core.config import settings
from app.core.logging import logger
from app.core.exceptions import LLMInferenceException

T = TypeVar("T", bound=BaseModel)


class GeminiProvider(BaseLLMProvider):
    def __init__(self, api_key: str = settings.GEMINI_API_KEY, model_name: str = settings.GEMINI_MODEL):
        self.api_key = api_key
        self.model_name = model_name
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
            raise LLMInferenceException("GEMINI_API_KEY is not configured in environment variables.")

        max_retries = 3
        delay = 2.0

        for attempt in range(1, max_retries + 1):
            try:
                model = genai.GenerativeModel(
                    model_name=self.model_name,
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
                return parsed_obj

            except Exception as e:
                logger.warning(f"Gemini API attempt {attempt}/{max_retries} failed: {str(e)}")
                if attempt == max_retries:
                    raise LLMInferenceException(f"Gemini inference failed after {max_retries} attempts: {str(e)}") from e
                time.sleep(delay)
                delay *= 2.0
