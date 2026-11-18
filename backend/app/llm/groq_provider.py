import json
import time
from typing import Type, TypeVar, List, Optional, Dict, Any
from pydantic import BaseModel
import httpx
from app.llm.base_provider import BaseLLMProvider
from app.core.config import settings
from app.core.logging import logger
from app.core.exceptions import LLMInferenceException

T = TypeVar("T", bound=BaseModel)

GROQ_FALLBACK_MODELS = [
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
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


class GroqProvider(BaseLLMProvider):
    """
    High-speed LLM provider powered by Groq LPU inference.
    Features:
    - Multi-key pool with automatic round-robin rotation.
    - Per-key rate-limit (429) cooldown tracking.
    - Zero key exposure in logs (masked to last 4 chars).
    - Automatic multi-model fallback.
    """
    def __init__(
        self,
        api_key: Optional[str] = None,
        api_keys: Optional[List[str]] = None,
        model_name: str = settings.GROQ_MODEL
    ):
        if api_keys:
            self.api_keys = [k.strip() for k in api_keys if k and k.strip()]
        elif api_key:
            self.api_keys = [api_key.strip()]
        else:
            self.api_keys = settings.get_groq_api_keys()

        self.model_name = model_name or "qwen/qwen3.8-27b"
        self.api_url = "https://api.groq.com/openai/v1/chat/completions"
        self.active_key_idx = 0

        # Per-key state tracking: failure count, cooldown timestamp, success count
        self.key_states: Dict[str, Dict[str, Any]] = {
            k: {"failures": 0, "cooldown_until": 0.0, "success_count": 0}
            for k in self.api_keys
        }

        if self.api_keys:
            masked_keys = [f"...{k[-4:]}" for k in self.api_keys]
            logger.info(f"GroqProvider initialized with {len(self.api_keys)} API key(s): {', '.join(masked_keys)}.")
        else:
            logger.warning("GroqProvider initialized without API keys. Will defer to secondary provider.")

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
            state = self.key_states[k]
            if state["cooldown_until"] <= now:
                self.active_key_idx = idx
                return k
        return None

    @property
    def quota_exceeded(self) -> bool:
        """Returns True only if all configured keys are currently in cooldown."""
        return self._get_next_available_key() is None

    def generate_structured(
        self,
        prompt: str,
        system_instruction: str,
        response_schema: Type[T],
        temperature: float = 0.2
    ) -> T:
        if not self.api_keys:
            raise LLMInferenceException("No Groq API keys configured.")

        models_to_try = [self.model_name] + [m for m in GROQ_FALLBACK_MODELS if m != self.model_name]
        schema_sample = response_schema.model_json_schema()
        augmented_system = (
            f"{system_instruction}\n\n"
            f"You MUST output valid JSON matching this schema:\n"
            f"{json.dumps(schema_sample, indent=2)}"
        )

        last_error = None

        for current_model in models_to_try:
            # Try across available keys (up to number of keys available)
            max_key_attempts = max(len(self.api_keys), 2)
            
            for key_attempt in range(max_key_attempts):
                key = self._get_next_available_key()
                if not key:
                    logger.warning("All Groq keys are temporarily in cooldown.")
                    break

                masked = f"...{key[-4:]}"
                headers = {
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json"
                }
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
                    logger.info(f"Invoking Groq with model '{current_model}' (key {masked})...")
                    t0 = time.time()
                    with httpx.Client(timeout=25.0) as client:
                        resp = client.post(self.api_url, headers=headers, json=payload)

                    if resp.status_code == 200:
                        data = resp.json()
                        content = data["choices"][0]["message"]["content"].strip()
                        if content.startswith("```json"):
                            content = content[7:]
                        if content.endswith("```"):
                            content = content[:-3]
                        content = content.strip()

                        parsed_obj = normalize_and_validate_json(content, response_schema)
                        duration = time.time() - t0
                        self.key_states[key]["success_count"] += 1
                        logger.info(f"Groq inference succeeded with '{current_model}' (key {masked}) in {duration:.2f}s.")
                        self.model_name = current_model
                        # Advance key index for round-robin load distribution
                        self.active_key_idx = (self.active_key_idx + 1) % len(self.api_keys)
                        return parsed_obj

                    elif resp.status_code == 401:
                        self.key_states[key]["cooldown_until"] = time.time() + 86400 * 30
                        logger.error(f"Groq Key {masked} is invalid (401). Permanently disabling key.")
                        self.active_key_idx = (self.active_key_idx + 1) % len(self.api_keys)
                        continue

                    elif resp.status_code == 429:
                        # Rate limit reached on this specific key
                        retry_after = 20.0
                        try:
                            retry_header = resp.headers.get("retry-after")
                            if retry_header:
                                retry_after = float(retry_header)
                        except Exception:
                            pass
                        self.key_states[key]["cooldown_until"] = time.time() + retry_after
                        self.key_states[key]["failures"] += 1
                        logger.warning(
                            f"Groq Key {masked} hit rate limit (429) on model '{current_model}'. "
                            f"Cooldown for {retry_after:.1f}s. Rotating to next key..."
                        )
                        self.active_key_idx = (self.active_key_idx + 1) % len(self.api_keys)
                        continue  # Try next key

                    else:
                        err_msg = f"Groq HTTP {resp.status_code}: {resp.text[:160]}"
                        logger.warning(f"Groq model '{current_model}' failed with key {masked}: {err_msg}")
                        self.key_states[key]["failures"] += 1
                        last_error = err_msg
                        # Advance key and try next
                        self.active_key_idx = (self.active_key_idx + 1) % len(self.api_keys)
                        continue

                except Exception as e:
                    logger.warning(f"Groq request exception on '{current_model}' with key {masked}: {str(e)}")
                    self.key_states[key]["failures"] += 1
                    last_error = e
                    self.active_key_idx = (self.active_key_idx + 1) % len(self.api_keys)
                    continue

        raise LLMInferenceException(f"All configured Groq keys/models failed. Last error: {last_error}")
