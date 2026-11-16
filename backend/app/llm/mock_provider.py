import re
from typing import Type, TypeVar, Optional, List, Tuple
from pydantic import BaseModel
from app.llm.base_provider import BaseLLMProvider
from app.llm.schema import AIPromoDiscoveryResponse, AIPromoCandidate
from app.services.screenplay_parser import parse_timestamp_to_seconds
from app.core.logging import logger

T = TypeVar("T", bound=BaseModel)


class MockLLMProvider(BaseLLMProvider):
    """
    Deterministic Mock LLM Provider for unit testing, offline development,
    and CI environments without external API costs or rate limits.
    Intelligently identifies tension arcs within the 20-60 second window.
    """

    def generate_structured(
        self,
        prompt: str,
        system_instruction: str,
        response_schema: Type[T],
        temperature: float = 0.2
    ) -> T:
        logger.info("MockLLMProvider invoked for structured completion.")
        
        # Extract episode number from prompt
        ep_match = re.search(r"EPISODE NUMBER:\s*Episode\s*(\d+)", prompt)
        ep_num = int(ep_match.group(1)) if ep_match else 1

        # Extract timecode blocks [MM:SS.ss - MM:SS.ss]
        timecodes = re.findall(r"\[([0-9:.]+)\s*-\s*([0-9:.]+)\]", prompt)

        chosen_start = "00:11.30"
        chosen_end = "00:45.00"

        # Search for a valid 25-50 second window
        found_window = False
        if timecodes:
            for i in range(len(timecodes)):
                start_sec = parse_timestamp_to_seconds(timecodes[i][0])
                for j in range(i + 1, len(timecodes)):
                    end_sec = parse_timestamp_to_seconds(timecodes[j][1])
                    dur = end_sec - start_sec
                    if 25.0 <= dur <= 50.0:
                        chosen_start = timecodes[i][0]
                        chosen_end = timecodes[j][1]
                        found_window = True
                        break
                if found_window:
                    break

            # Fallback if no window matched: take 30s from first dialogue cue
            if not found_window and len(timecodes) >= 2:
                chosen_start = timecodes[0][0]
                start_s = parse_timestamp_to_seconds(chosen_start)
                # Find cue closest to start_s + 35s
                best_end = timecodes[-1][1]
                min_diff = float("inf")
                for tc in timecodes:
                    e_s = parse_timestamp_to_seconds(tc[1])
                    if abs((e_s - start_s) - 35.0) < min_diff:
                        min_diff = abs((e_s - start_s) - 35.0)
                        best_end = tc[1]
                chosen_end = best_end

        candidate = AIPromoCandidate(
            candidate_id=f"PROMO_EP{ep_num:02d}_01",
            episode_number=ep_num,
            start_timestamp=chosen_start,
            end_timestamp=chosen_end,
            hook="Confrontation begins with explosive accusation in opening seconds",
            cliffhanger="Cuts sharply right before the climax or identity reveal",
            standalone_context="Clear betrayal conflict where viewer instantly knows the stakes",
            why_it_works="High curiosity gap with immediate visual and vocal confrontation",
            hook_strength=9.0,
            cliffhanger_strength=9.5,
            standalone_context_score=8.5,
            emotional_impact=9.0,
            narrative_continuity=9.0
        )

        return AIPromoDiscoveryResponse(candidates=[candidate])
