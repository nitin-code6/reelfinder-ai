import re
from typing import Type, TypeVar
from pydantic import BaseModel
from app.llm.base_provider import BaseLLMProvider
from app.llm.schema import AIPromoDiscoveryResponse, AIPromoCandidate
from app.core.logging import logger

T = TypeVar("T", bound=BaseModel)


class MockLLMProvider(BaseLLMProvider):
    """
    Deterministic Mock LLM Provider for unit testing, offline development,
    and CI environments without external API costs or rate limits.
    """

    def generate_structured(
        self,
        prompt: str,
        system_instruction: str,
        response_schema: Type[T],
        temperature: float = 0.2
    ) -> T:
        logger.info("MockLLMProvider invoked for structured completion.")
        
        # Extract episode number from prompt if possible
        ep_match = re.search(r"EPISODE NUMBER:\s*Episode\s*(\d+)", prompt)
        ep_num = int(ep_match.group(1)) if ep_match else 1

        # Look for timecodes in prompt like [00:11.30 - 00:13.10]
        timecodes = re.findall(r"\[([0-9:.]+)\s*-\s*([0-9:.]+)\]", prompt)

        if len(timecodes) >= 4:
            # Pick a 25-45 second window
            start_tc = timecodes[1][0]
            end_tc = timecodes[-2][1]
        else:
            start_tc = "00:04.20"
            end_tc = "00:37.80"

        candidate = AIPromoCandidate(
            candidate_id=f"PROMO_EP{ep_num:02d}_01",
            episode_number=ep_num,
            start_timestamp=start_tc,
            end_timestamp=end_tc,
            hook="Confrontation begins with explosive accusation in opening seconds",
            cliffhanger="Cuts sharply as a shocking revelation is about to be named",
            standalone_context="Clear betrayal conflict where viewer instantly knows the stakes",
            why_it_works="High curiosity gap with immediate visual and vocal confrontation",
            hook_strength=9.0,
            cliffhanger_strength=9.5,
            standalone_context_score=8.5,
            emotional_impact=9.0,
            narrative_continuity=9.0
        )

        resp = AIPromoDiscoveryResponse(candidates=[candidate])
        return resp
