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
    Achieves sub-second structured JSON responses with automatic model failover
    and multi-key rotation on rate limits.
    """
    def __init__(
        self,
        api_key: Optional[str] = None,
        api_keys: Optional[List[str]] = None,
        model_name: str = settings.GROQ_MODEL
    ):
        if api_keys:
            self.api_keys = [k for k in api_keys if k]
        elif api_key:
            self.api_keys = [api_key]
        else:
            self.api_keys = settings.get_groq_api_keys()

        self.model_name = model_name or "openai/gpt-oss-120b"
        self.api_url = "https://api.groq.com/openai/v1/chat/completions"
        self.active_key_idx = 0
        self.cooldown_until = 0.0

        if self.api_keys:
            logger.info(f"GroqProvider initialized with {len(self.api_keys)} API key(s). Active key: ...{self.current_key[-6:]}")
        else:
            logger.info("GroqProvider initialized without API key. Will defer to secondary provider.")

    @property
    def current_key(self) -> Optional[str]:
        if not self.api_keys:
            return None
        return self.api_keys[self.active_key_idx % len(self.api_keys)]

    @property
    def api_key(self) -> Optional[str]:
        return self.current_key

    @property
    def quota_exceeded(self) -> bool:
        return time.time() < self.cooldown_until

    def _rotate_to_next_key(self) -> bool:
        """Rotates to the next unexhausted Groq API key."""
        if len(self.api_keys) <= 1:
            return False
        old_idx = self.active_key_idx
        self.active_key_idx = (self.active_key_idx + 1) % len(self.api_keys)
        logger.warning(f"Rotated Groq API key to backup key: ...{self.current_key[-6:]}")
        return True

    def generate_structured(
        self,
        prompt: str,
        system_instruction: str,
        response_schema: Type[T],
        temperature: float = 0.2
    ) -> T:
        if not self.api_keys or self.quota_exceeded:
            raise LLMInferenceException("Groq API key not configured or temporarily in rate-limit cooldown.")

        models_to_try = [self.model_name] + [m for m in GROQ_FALLBACK_MODELS if m != self.model_name]

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

            for attempt in range(1, 3):
                headers = {
                    "Authorization": f"Bearer {self.current_key}",
                    "Content-Type": "application/json"
                }

                try:
                    logger.info(f"Invoking Groq with model '{current_model}' (key ...{self.current_key[-6:]})...")
                    t0 = time.time()
                    with httpx.Client(timeout=10.0) as client:
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
                        logger.warning(f"Groq rate limit (429) on model '{current_model}': {resp.text[:160]}")
                        # Rotate to backup key if available
                        if self._rotate_to_next_key():
                            time.sleep(0.5)
                            continue  # retry with the backup key
                        break  # try next model

                    else:
                        err_msg = f"Groq HTTP {resp.status_code}: {resp.text[:150]}"
                        logger.warning(f"Groq model '{current_model}' failed: {err_msg}")
                        last_error = err_msg
                        break

                except Exception as e:
                    logger.warning(f"Groq error with '{current_model}': {str(e)}")
                    last_error = e
                    break

        self.cooldown_until = time.time() + 10.0
        raise LLMInferenceException(f"All Groq models failed. Last error: {last_error}")
