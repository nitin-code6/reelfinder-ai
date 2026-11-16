from abc import ABC, abstractmethod
from typing import Type, TypeVar, Optional, Dict, Any, List
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class BaseLLMProvider(ABC):
    """
    Abstract interface for AI model inference.
    Decouples application logic from specific model providers (Gemini, Claude, OpenAI, or Mock).
    """

    @abstractmethod
    def generate_structured(
        self,
        prompt: str,
        system_instruction: str,
        response_schema: Type[T],
        temperature: float = 0.2
    ) -> T:
        """
        Executes an LLM completion ensuring output strictly matches the Pydantic schema.
        """
        pass
