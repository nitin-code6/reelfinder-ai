import json
import time
from typing import Type, TypeVar, List, Optional, Dict, Any
from pydantic import BaseModel
import google.generativeai as genai
from app.llm.base_provider import BaseLLMProvider
from app.core.config import settings
from app.core.logging import logger
from app.core.exceptions import LLMInferenceException

T = TypeVar("T", bound=BaseModel)

FALLBACK_MODELS = [
    "gemini-flash-lite-latest",
    "gemini-flash-latest",
]


def normalize_and_validate_json(raw_text: str, response_schema: Type[T]) -> T:
    """Robustly normalizes codeblocks, lists, or custom wrapper keys into the response schema."""
    clean = raw_text.strip()
    if clean.startswith("```json"):
        clean = clean[7:]
    elif clean.startswith("```"):
        clean = clean[3:]
    if clean.endswith("```"):
        clean = clean[:-3]
    clean = clean.strip()

    data = json.loads(clean)
    if isinstance(data, list):
        data = {"candidates": data}
    elif isinstance(data, dict) and "candidates" not in data:
        for alt in ["promos", "results", "moments", "data"]:
            if alt in data and isinstance(data[alt], list):
                data["candidates"] = data[alt]
                break
        else:
            if "hook" in data or "cliffhanger" in data:
                data = {"candidates": [data]}

    return response_schema.model_validate(data)


class GeminiProvider(BaseLLMProvider):
    """
    Google Gemini LLM provider with multi-key pool, per-key rate-limit tracking,
    and automatic failover to working lightweight flash models.
    """
    def __init__(
        self,
        api_key: Optional[str] = None,
        api_keys: Optional[List[str]] = None,
        model_name: str = settings.GEMINI_MODEL
    ):
        if api_keys:
            self.api_keys = [k.strip() for k in api_keys if k and k.strip()]
        elif api_key:
            self.api_keys = [api_key.strip()]
        else:
            self.api_keys = settings.get_gemini_api_keys()

        self.model_name = model_name or "gemini-flash-lite-latest"
        self.active_key_idx = 0

        # Per-key state tracking: failure count, cooldown timestamp, success count
        self.key_states: Dict[str, Dict[str, Any]] = {
            k: {"failures": 0, "cooldown_until": 0.0, "success_count": 0}
            for k in self.api_keys
        }

        if self.api_keys:
            masked = [f"...{k[-4:]}" for k in self.api_keys]
            logger.info(f"GeminiProvider initialized with {len(self.api_keys)} API key(s): {', '.join(masked)}.")
        else:
            logger.warning("GeminiProvider initialized without API keys.")

    @property
    def current_key(self) -> Optional[str]:
        if not self.api_keys:
            return None
        return self.api_keys[self.active_key_idx % len(self.api_keys)]

    @property
    def api_key(self) -> Optional[str]:
        return self.current_key

    def _get_next_available_key(self) -> Optional[str]:
        """Finds the next key not currently in rate-limit cooldown."""
        now = time.time()
        for i in range(len(self.api_keys)):
            idx = (self.active_key_idx + i) % len(self.api_keys)
            k = self.api_keys[idx]
            if self.key_states[k]["cooldown_until"] <= now:
                self.active_key_idx = idx
                return k
        return None

    @property
    def quota_exceeded(self) -> bool:
        return self._get_next_available_key() is None

    def generate_structured(
        self,
        prompt: str,
        system_instruction: str,
        response_schema: Type[T],
        temperature: float = 0.2
    ) -> T:
        if not self.api_keys:
            raise LLMInferenceException("No Gemini API keys configured.")

        models_to_try = [self.model_name] + [m for m in FALLBACK_MODELS if m != self.model_name]
        last_error = None

        for current_model in models_to_try:
            max_key_attempts = max(len(self.api_keys), 2)

            for _ in range(max_key_attempts):
                key = self._get_next_available_key()
                if not key:
                    logger.warning("All Gemini keys are temporarily in cooldown.")
                    break

                masked = f"...{key[-4:]}"
                try:
                    logger.info(f"Invoking Gemini with model '{current_model}' (key {masked})...")
                    t0 = time.time()

                    genai.configure(api_key=key)
                    model = genai.GenerativeModel(
                        model_name=current_model,
                        system_instruction=system_instruction,
                        generation_config={
                            "response_mime_type": "application/json",
                            "temperature": temperature,
                        }
                    )

                    response = model.generate_content(prompt, request_options={"timeout": 25.0})
                    parsed_obj = normalize_and_validate_json(response.text, response_schema)
                    duration = time.time() - t0
                    self.key_states[key]["success_count"] += 1
                    logger.info(f"Gemini inference succeeded with '{current_model}' (key {masked}) in {duration:.2f}s.")
                    self.model_name = current_model
                    self.active_key_idx = (self.active_key_idx + 1) % len(self.api_keys)
                    return parsed_obj

                except Exception as e:
                    err_msg = str(e)
                    logger.warning(f"Gemini model '{current_model}' with key {masked} error: {err_msg}")
                    last_error = e
                    self.key_states[key]["failures"] += 1

                    if "429" in err_msg or "quota" in err_msg.lower():
                        self.key_states[key]["cooldown_until"] = time.time() + 30.0
                        logger.warning(f"Gemini Key {masked} entered 30s rate-limit cooldown (429). Rotating...")
                        self.active_key_idx = (self.active_key_idx + 1) % len(self.api_keys)
                        continue

                    if any(k in err_msg.lower() for k in ["api_key", "invalid", "unregistered", "permission denied", "forbidden", "400", "401", "403"]):
                        self.key_states[key]["cooldown_until"] = time.time() + 86400 * 30
                        logger.error(f"Gemini Key {masked} is invalid or forbidden. Disabling key.")
                        self.active_key_idx = (self.active_key_idx + 1) % len(self.api_keys)
                        continue

                    if "404" in err_msg or "not found" in err_msg.lower():
                        break

                    self.active_key_idx = (self.active_key_idx + 1) % len(self.api_keys)
                    continue

        raise LLMInferenceException(f"All Gemini models/keys exhausted. Last error: {last_error}")
