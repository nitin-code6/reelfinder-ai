import json
import time
from typing import Type, TypeVar, List, Optional
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
    def __init__(
        self,
        api_key: Optional[str] = None,
        api_keys: Optional[List[str]] = None,
        model_name: str = settings.GEMINI_MODEL
    ):
        if api_keys:
            self.api_keys = [k for k in api_keys if k]
        elif api_key:
            self.api_keys = [api_key]
        else:
            self.api_keys = settings.get_gemini_api_keys()

        self.model_name = model_name or "gemini-3.8-flash"
        self.active_key_idx = 0
        self.exhausted_keys = set()

        if self.api_keys:
            genai.configure(api_key=self.current_key)
            logger.info(f"GeminiProvider initialized with {len(self.api_keys)} API key(s). Active key: ...{self.current_key[-6:]}")
        else:
            logger.warning("GeminiProvider initialized without any API keys! Ensure GEMINI_API_KEY is configured.")

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
        return len(self.exhausted_keys) >= len(self.api_keys) and len(self.api_keys) > 0

    def _rotate_to_next_key(self) -> bool:
        """Rotates to the next unexhausted Gemini API key. Returns True if switch succeeded."""
        if not self.api_keys:
            return False
        
        current = self.current_key
        if current:
            self.exhausted_keys.add(current)

        for i in range(len(self.api_keys)):
            candidate_idx = (self.active_key_idx + 1 + i) % len(self.api_keys)
            cand_key = self.api_keys[candidate_idx]
            if cand_key not in self.exhausted_keys:
                self.active_key_idx = candidate_idx
                genai.configure(api_key=cand_key)
                logger.warning(f"Rotated to backup Gemini API key: ...{cand_key[-6:]} ({len(self.exhausted_keys)}/{len(self.api_keys)} exhausted)")
                return True

        return False

    def generate_structured(
        self,
        prompt: str,
        system_instruction: str,
        response_schema: Type[T],
        temperature: float = 0.2
    ) -> T:
        if not self.api_keys:
            raise LLMInferenceException("No GEMINI_API_KEY is configured.")
        if self.quota_exceeded:
            raise LLMInferenceException(f"All {len(self.api_keys)} configured Gemini API key(s) exceeded daily quota (429).")

        models_to_try = [self.model_name] + [m for m in FALLBACK_MODELS if m != self.model_name]

        last_error = None
        for current_model in models_to_try:
            max_retries = 1

            for attempt in range(1, max_retries + 1):
                try:
                    logger.info(f"Invoking Gemini with model '{current_model}' (key ...{self.current_key[-6:]})...")
                    model = genai.GenerativeModel(
                        model_name=current_model,
                        system_instruction=system_instruction,
                        generation_config={
                            "response_mime_type": "application/json",
                            "temperature": temperature,
                        }
                    )

                    response = model.generate_content(prompt, request_options={"timeout": 6.0})
                    raw_text = response.text.strip()

                    # Strip markdown code blocks if present
                    if raw_text.startswith("```json"):
                        raw_text = raw_text[7:]
                    if raw_text.endswith("```"):
                        raw_text = raw_text[:-3]
                    raw_text = raw_text.strip()

                    parsed_obj = response_schema.model_validate_json(raw_text)
                    self.model_name = current_model
                    return parsed_obj

                except Exception as e:
                    err_msg = str(e)
                    logger.warning(f"Gemini model '{current_model}' attempt {attempt} failed: {err_msg}")
                    last_error = e

                    # Quota exceeded (429): rotate key if backup available
                    if "429" in err_msg or "quota" in err_msg.lower():
                        logger.warning(f"Gemini API key ...{self.current_key[-6:]} quota limit reached (429).")
                        if self._rotate_to_next_key():
                            # Retry immediately with the backup key
                            try:
                                logger.info(f"Retrying prompt with backup key ...{self.current_key[-6:]} on model '{current_model}'...")
                                model = genai.GenerativeModel(
                                    model_name=current_model,
                                    system_instruction=system_instruction,
                                    generation_config={
                                        "response_mime_type": "application/json",
                                        "temperature": temperature,
                                    }
                                )
                                response = model.generate_content(prompt, request_options={"timeout": 6.0})
                                raw_text = response.text.strip()
                                if raw_text.startswith("```json"): raw_text = raw_text[7:]
                                if raw_text.endswith("```"): raw_text = raw_text[:-3]
                                parsed_obj = response_schema.model_validate_json(raw_text.strip())
                                self.model_name = current_model
                                return parsed_obj
                            except Exception as backup_err:
                                logger.warning(f"Backup Gemini API key also failed on '{current_model}': {backup_err}")
                                if "429" in str(backup_err) or "quota" in str(backup_err).lower():
                                    self._rotate_to_next_key()
                        raise LLMInferenceException(f"Gemini quota exhausted across active key(s): {err_msg}")

                    if any(k in err_msg.lower() for k in ["api_key", "invalid", "unregistered", "permission denied", "forbidden", "400", "403"]):
                        # Invalid key: try rotating key before dying
                        if self._rotate_to_next_key():
                            continue
                        raise LLMInferenceException(f"Gemini API authentication failed: {err_msg}")

                    if "404" in err_msg or "not found" in err_msg.lower():
                        break
                    time.sleep(1.0)

        raise LLMInferenceException(f"All Gemini models exhausted. Last error: {last_error}")

