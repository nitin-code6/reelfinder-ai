import re
from typing import Type, TypeVar, Optional, List, Tuple
from pydantic import BaseModel
from app.llm.base_provider import BaseLLMProvider
from app.llm.schema import AIPromoDiscoveryResponse, AIPromoCandidate, AIPromoSegmentCandidate
from app.services.screenplay_parser import parse_timestamp_to_seconds, normalize_timestamp
from app.core.logging import logger

T = TypeVar("T", bound=BaseModel)


class MockLLMProvider(BaseLLMProvider):
    """
    Deterministic Mock LLM Provider strictly used for unit testing, CI pipelines,
    and offline test scenarios when USE_MOCK_LLM=True.
    
    Dynamically extracts real dialogue lines from the screenplay prompt,
    constructs episode-specific hooks/cliffhangers, and computes genuine scores
    reflecting dramatic tension versus weak/resolved storylines.
    """

    def generate_structured(
        self,
        prompt: str,
        system_instruction: str,
        response_schema: Type[T],
        temperature: float = 0.2
    ) -> T:
        logger.info("MockLLMProvider invoked for structured test evaluation.")
        
        # Extract episode number from prompt
        ep_match = re.search(r"EPISODE NUMBER:\s*Episode\s*(\d+)", prompt, re.IGNORECASE)
        ep_num = int(ep_match.group(1)) if ep_match else 1

        # 1. Extract structured script lines
        # Format A: [MM:SS.ss - MM:SS.ss] SPEAKER: "text" or [ACTION]: text
        format_a = re.findall(
            r"\[([0-9:.]+)\s*-\s*([0-9:.]+)\]\s*(?:(?:\[ACTION\]|ACTION):\s*([^\n]+)|([^:\n]+?)(?:\s*\([^)]*\))?:\s*\"?([^\n\"]+)\"?)",
            prompt
        )

        parsed_cues = []
        for match in format_a:
            s_ts, e_ts, action_text, speaker, dial_text = match
            content = (dial_text or action_text or "").strip()
            spk = (speaker or "ACTION").strip()
            s_sec = parse_timestamp_to_seconds(s_ts)
            e_sec = parse_timestamp_to_seconds(e_ts)
            if s_sec >= 0 and e_sec > s_sec:
                parsed_cues.append({
                    "start_ts": s_ts,
                    "end_ts": e_ts,
                    "start_sec": s_sec,
                    "end_sec": e_sec,
                    "speaker": spk,
                    "text": content
                })

        # Format B: Screenplay format
        # **SPEAKER (Paren):** \n Start: (MM:SS.ss) | End: (MM:SS.ss) \n "text"
        if not parsed_cues:
            format_b = re.findall(
                r"(?:\*\*([^*]+?)\*\*|[A-Z\s]+:)\s*\n\s*Start:\s*\(?([0-9:.]+)\)?\s*\|\s*End:\s*\(?([0-9:.]+)\)?\s*\n\s*\"?([^\n\"]+)\"?",
                prompt
            )
            for match in format_b:
                raw_spk, s_ts, e_ts, content = match
                spk = re.sub(r"\s*\([^)]*\)", "", raw_spk or "ACTION").strip()
                s_sec = parse_timestamp_to_seconds(s_ts)
                e_sec = parse_timestamp_to_seconds(e_ts)
                if s_sec >= 0 and e_sec > s_sec:
                    parsed_cues.append({
                        "start_ts": s_ts,
                        "end_ts": e_ts,
                        "start_sec": s_sec,
                        "end_sec": e_sec,
                        "speaker": spk,
                        "text": content.strip()
                    })

        if not parsed_cues:
            # Fallback if no formatted cues found
            candidate = AIPromoCandidate(
                candidate_id=f"PROMO_EP{ep_num:02d}_01",
                episode_number=ep_num,
                start_timestamp="00:00.00",
                end_timestamp="00:25.00",
                hook="Opening scene hook",
                cliffhanger="Unresolved cliffhanger",
                standalone_context="General conflict",
                why_it_works="Curiosity gap",
                hook_strength=7.0,
                cliffhanger_strength=7.0,
                standalone_context_score=7.0,
                emotional_impact=7.0,
                narrative_continuity=7.0
            )
            return AIPromoDiscoveryResponse(candidates=[candidate])

        # Find best candidate window between 20.0s and 60.0s
        best_window = None
        for i in range(len(parsed_cues)):
            s_sec = parsed_cues[i]["start_sec"]
            for j in range(i, len(parsed_cues)):
                dur = parsed_cues[j]["end_sec"] - s_sec
                if 20.0 <= dur <= 60.0:
                    best_window = (parsed_cues[i], parsed_cues[j], dur, parsed_cues[i:j+1])
                    if 25.0 <= dur <= 45.0:
                        break
            if best_window and 25.0 <= best_window[2] <= 45.0:
                break

        if not best_window:
            first_cue = parsed_cues[0]
            last_cue = parsed_cues[-1]
            dur = last_cue["end_sec"] - first_cue["start_sec"]
            best_window = (first_cue, last_cue, dur, parsed_cues)

        start_cue, end_cue, duration, window_cues = best_window

        # Content-based quality scoring
        full_text = " ".join([c["text"] for c in window_cues]).lower()
        
        # Token set for exact word boundary matching
        tokens = set(re.findall(r"\b\w+\b", full_text))

        # Keywords
        resolved_phrases = [
            "sorry", "apologize", "apology", "forgive", "forgiveness", "peace", 
            "settled", "compromise", "agreed", "reconcil", "reconciliation", 
            "farewell", "all is well", "ratified", "war is officially over", 
            "praise the heavens", "mutual prosperity"
        ]
        conflict_words = {
            "betray", "murder", "never", "ruin", "lie", "hate", "kill", 
            "accuse", "dishonor", "shame", "bastard", "blood", "sword", "arrest", 
            "poison", "blackmail", "warrant", "impostor", "traitor", "refuse"
        }
        calm_words = {
            "tea", "weather", "breakfast", "quiet", "potatoes", "flour", 
            "cleaning", "library", "morning", "sunshine", "pleasant", 
            "earl", "honey", "books", "dust", "dusting", "duster", "shelf", "shelves", "carriage",
            "afternoon", "weekend", "newsletter", "kind", "neighbor", "linen", "cloth", "noon",
            "salt", "pantry", "supplier", "ledger", "greetings", "hello", "maid"
        }

        is_resolved = any(rp in full_text for rp in resolved_phrases)
        has_conflict = any(cw in tokens for cw in conflict_words) and not is_resolved
        is_calm = any(cm in tokens for cm in calm_words) and not has_conflict

        has_exclamation = any("!" in c["text"] for c in window_cues)
        has_question = any("?" in c["text"] for c in window_cues)

        # Baseline evaluation
        if is_resolved:
            # Resolved conflict -> very low cliffhanger tension
            hook_score = 5.0
            cliffhanger_score = 3.5  # Resolved ending lacks suspense
            standalone_score = 6.0
            emotional_impact = 4.0
            continuity_score = 7.0
            cliffhanger_desc = f"Conversation concludes politely with: \"{end_cue['text']}\" without impending jeopardy."
        elif is_calm:
            # Low stakes mundane scene
            hook_score = 4.0 if not has_exclamation else 4.8
            cliffhanger_score = 3.5
            standalone_score = 5.0
            emotional_impact = 3.5
            continuity_score = 6.5
            cliffhanger_desc = f"Scene concludes quietly on mundane beat: \"{end_cue['text']}\"."
        elif has_conflict:
            # High stakes drama / confrontation
            hook_score = 9.0 if has_exclamation else 8.5
            cliffhanger_score = 9.5 if has_question else 9.0
            standalone_score = 8.5
            emotional_impact = 9.0
            continuity_score = 8.5
            cliffhanger_desc = f"Cut sharply right before reaction after {end_cue['speaker']} exclaims: \"{end_cue['text']}\""
        else:
            # Moderate drama
            hook_score = 7.5
            cliffhanger_score = 7.5
            standalone_score = 7.5
            emotional_impact = 7.0
            continuity_score = 8.0
            cliffhanger_desc = f"Action pauses on suspenseful beat as {end_cue['speaker']} states: \"{end_cue['text']}\""

        # Construct evidence-grounded hook and cliffhanger (never treat ACTION as a character)
        if start_cue["speaker"] == "ACTION":
            hook_desc = f"Scene opens on critical visual action: \"{start_cue['text']}\""
            standalone_desc = "The immediate visual tension establishes the scene's stakes without requiring prior exposition."
            why_works = "Opening with dramatic visual action immediately hooks viewers, propelling them into the confrontation."
        else:
            hook_desc = f"{start_cue['speaker']} opens the scene with: \"{start_cue['text']}\""
            standalone_desc = f"The immediate confrontation involving {start_cue['speaker']} establishes clear emotional stakes."
            why_works = f"Opening with direct dialogue delivers an immediate hook, while the impending reveal creates strong narrative suspense."

        if end_cue["speaker"] == "ACTION":
            cliffhanger_desc = f"Scene cuts abruptly on critical action beat: \"{end_cue['text']}\""
        elif "?" in end_cue["text"]:
            cliffhanger_desc = f"Cuts to black immediately on {end_cue['speaker']}'s unanswered question: \"{end_cue['text']}\""
        elif "!" in end_cue["text"]:
            cliffhanger_desc = f"Cuts sharply on high-stakes outburst as {end_cue['speaker']} demands: \"{end_cue['text']}\""
        else:
            cliffhanger_desc = f"Suspends on unresolved confrontation after {end_cue['speaker']} states: \"{end_cue['text']}\""

        norm_start = normalize_timestamp(start_cue["start_ts"]) or start_cue["start_ts"]
        norm_end = normalize_timestamp(end_cue["end_ts"]) or end_cue["end_ts"]

        candidate1 = AIPromoCandidate(
            candidate_id=f"PROMO_EP{ep_num:02d}_01",
            episode_number=ep_num,
            start_timestamp=norm_start,
            end_timestamp=norm_end,
            hook=hook_desc,
            cliffhanger=cliffhanger_desc,
            standalone_context=standalone_desc,
            why_it_works=why_works,
            hook_strength=hook_score,
            cliffhanger_strength=cliffhanger_score,
            standalone_context_score=standalone_score,
            emotional_impact=emotional_impact,
            narrative_continuity=continuity_score
        )

        candidates = [candidate1]

        # Multi-segment candidate: Search for two non-contiguous moments whose combined duration is 20.0s to 55.0s
        if has_conflict and len(parsed_cues) >= 4 and not is_resolved and not is_calm:
            best_multi = None
            for i1 in range(0, min(3, len(parsed_cues) - 2)):
                for j1 in range(i1, min(i1 + 3, len(parsed_cues) - 2)):
                    d1 = parsed_cues[j1]["end_sec"] - parsed_cues[i1]["start_sec"]
                    if 8.0 <= d1 <= 25.0:
                        for i2 in range(j1 + 2, len(parsed_cues)):
                            for j2 in range(i2, min(i2 + 3, len(parsed_cues))):
                                d2 = parsed_cues[j2]["end_sec"] - parsed_cues[i2]["start_sec"]
                                if 8.0 <= d2 <= 25.0 and 20.0 <= (d1 + d2) <= 55.0:
                                    best_multi = (parsed_cues[i1], parsed_cues[j1], parsed_cues[i2], parsed_cues[j2], d1 + d2)
                                    break
                            if best_multi:
                                break
                    if best_multi:
                        break
                if best_multi:
                    break

            if best_multi:
                s1_start, s1_end, s2_start, s2_end, multi_dur = best_multi
                s1_s = normalize_timestamp(s1_start["start_ts"]) or s1_start["start_ts"]
                s1_e = normalize_timestamp(s1_end["end_ts"]) or s1_end["end_ts"]
                s2_s = normalize_timestamp(s2_start["start_ts"]) or s2_start["start_ts"]
                s2_e = normalize_timestamp(s2_end["end_ts"]) or s2_end["end_ts"]

                m_hook = (
                    f"Opening confrontation: {s1_start['speaker']} states: \"{s1_start['text']}\""
                    if s1_start["speaker"] != "ACTION"
                    else f"Opening visual confrontation: \"{s1_start['text']}\""
                )
                m_cliff = (
                    f"Climactic cut: {s2_end['speaker']} exclaims: \"{s2_end['text']}\""
                    if s2_end["speaker"] != "ACTION"
                    else f"Climactic action cut: \"{s2_end['text']}\""
                )

                candidate2 = AIPromoCandidate(
                    candidate_id=f"PROMO_EP{ep_num:02d}_02",
                    episode_number=ep_num,
                    start_timestamp=s1_s,
                    end_timestamp=s2_e,
                    segments=[
                        AIPromoSegmentCandidate(episode_number=ep_num, start_timestamp=s1_s, end_timestamp=s1_e),
                        AIPromoSegmentCandidate(episode_number=ep_num, start_timestamp=s2_s, end_timestamp=s2_e),
                    ],
                    hook=m_hook,
                    cliffhanger=m_cliff,
                    standalone_context="Cross-cutting the initial suspicion with the climactic confrontation establishes high stakes without requiring backstory.",
                    why_it_works="Two-part dramatic arc: hooks immediately on the opening confrontation, then jumps across filler directly to the peak cliffhanger.",
                    hook_strength=hook_score,
                    cliffhanger_strength=cliffhanger_score,
                    standalone_context_score=standalone_score,
                    emotional_impact=emotional_impact,
                    narrative_continuity=max(1.0, continuity_score - 0.5)
                )
                candidates.append(candidate2)

        return AIPromoDiscoveryResponse(candidates=candidates)
