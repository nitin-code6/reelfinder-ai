import json
import time
from typing import Type, TypeVar, List, Optional
from pydantic import BaseModel
import httpx
from app.llm.base_provider import BaseLLMProvider
from app.core.config import settings
from app.core.logging import logger
from app.core.exceptions import LLMInferenceException

T = TypeVar("T", bound=BaseModel)

GROQ_FALLBACK_MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
]


class GroqProvider(BaseLLMProvider):
    """
    High-speed LLM provider powered by Groq's LPU inference engine.
    Achieves sub-second structured JSON responses with automatic model failover.
    """
    def __init__(self, api_key: str = settings.GROQ_API_KEY, model_name: str = settings.GROQ_MODEL):
        self.api_key = api_key
        self.model_name = model_name or "openai/gpt-oss-120b"
        self.api_url = "https://api.groq.com/openai/v1/chat/completions"
        self.quota_exceeded = False

        if not self.api_key:
            logger.info("GroqProvider initialized without API key. Will defer to secondary provider.")

    def generate_structured(
        self,
        prompt: str,
        system_instruction: str,
        response_schema: Type[T],
        temperature: float = 0.2
    ) -> T:
        if not self.api_key or self.quota_exceeded:
            raise LLMInferenceException("Groq API key not configured or quota limit reached.")

        models_to_try = [self.model_name] + [m for m in GROQ_FALLBACK_MODELS if m != self.model_name]
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        # Include schema structure hint in system prompt for OpenAI-compatible models
        schema_sample = response_schema.model_json_schema()
        augmented_system = (
            f"{system_instruction}\n\n"
            f"You MUST output valid JSON matching this JSON schema:\n"
            f"{json.dumps(schema_sample, indent=2)}"
        )

        last_error = None
        for current_model in models_to_try:
            payload = {
                "model": current_model,
                "messages": [
                    {"role": "system", "content": augmented_system},
                    {"role": "user", "content": prompt}
                ],
                "response_format": {"type": "json_object"},
                "temperature": temperature,
            }

            try:
                logger.info(f"Invoking Groq with model '{current_model}'...")
                t0 = time.time()
                with httpx.Client(timeout=15.0) as client:
                    resp = client.post(self.api_url, headers=headers, json=payload)

                if resp.status_code == 200:
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"].strip()

                    # Strip code fences if present
                    if content.startswith("```json"):
                        content = content[7:]
                    if content.endswith("```"):
                        content = content[:-3]
                    content = content.strip()

                    parsed_obj = response_schema.model_validate_json(content)
                    duration = time.time() - t0
                    logger.info(f"Groq inference succeeded with '{current_model}' in {duration:.2f}s.")
                    self.model_name = current_model
                    return parsed_obj

                elif resp.status_code == 429:
                    logger.warning(f"Groq rate limit / quota exceeded (429): {resp.text}")
                    self.quota_exceeded = True
                    raise LLMInferenceException("Groq quota limit exceeded (429).")

                else:
                    err_msg = f"Groq HTTP {resp.status_code}: {resp.text}"
                    logger.warning(f"Groq model '{current_model}' failed: {err_msg}")
                    last_error = err_msg

            except Exception as e:
                logger.warning(f"Groq error with '{current_model}': {str(e)}")
                last_error = e

        raise LLMInferenceException(f"All Groq models failed. Last error: {last_error}")
