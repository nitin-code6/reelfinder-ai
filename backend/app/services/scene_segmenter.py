from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel
from app.services.screenplay_parser import ParsedScreenplay, ParsedScene, ScreenplayLine, format_seconds_to_timestamp
from app.core.config import settings
from app.core.logging import logger


class CandidateWindow(BaseModel):
    episode_number: int
    scene_number: int
    start_timestamp: str
    end_timestamp: str
    start_seconds: float
    end_seconds: float
    duration_seconds: float
    first_line_speaker: Optional[str] = None
    first_line_text: str = ""
    last_line_speaker: Optional[str] = None
    last_line_text: str = ""
    dialogue_count: int = 0
    lines: List[ScreenplayLine] = []

    def get_transcript_text(self) -> str:
        """Formats the window into readable transcript with timestamps for LLM analysis."""
        output = []
        for line in self.lines:
            if line.line_type == "dialogue":
                speaker = line.speaker or "CHARACTER"
                paren = f" ({line.parenthetical})" if line.parenthetical else ""
                output.append(f"[{line.start_timestamp} - {line.end_timestamp}] {speaker}{paren}: \"{line.text}\"")
            elif line.line_type == "action":
                output.append(f"[{line.start_timestamp} - {line.end_timestamp}] [ACTION]: {line.text}")
        return "\n".join(output)


class SceneSegmenter:
    """
    Segments a parsed screenplay into valid 20-60 second candidate promo windows.
    Ensures:
      - Windows respect natural dialogue boundaries (never cuts mid-sentence).
      - Start and end timecodes snap strictly to screenplay lines.
      - Duration falls within the configured promo length (20s - 60s).
    """

    def __init__(
        self,
        min_duration: float = settings.MIN_PROMO_DURATION,
        max_duration: float = settings.MAX_PROMO_DURATION
    ):
        self.min_duration = min_duration
        self.max_duration = max_duration

    def generate_candidate_windows(self, screenplay: ParsedScreenplay) -> List[CandidateWindow]:
        """
        Generates candidate continuous windows within 20-60s duration.
        """
        candidates: List[CandidateWindow] = []

        for scene in screenplay.scenes:
            # We consider dialogue and action lines as anchor points
            anchors = [line for line in scene.lines if line.line_type in {"dialogue", "action"}]
            if not anchors:
                continue

            num_lines = len(anchors)
            for start_idx in range(num_lines):
                start_line = anchors[start_idx]
                start_sec = start_line.start_seconds

                for end_idx in range(start_idx, num_lines):
                    end_line = anchors[end_idx]
                    end_sec = end_line.end_seconds
                    duration = end_sec - start_sec

                    # If duration exceeds max, stop expanding from this start line
                    if duration > self.max_duration:
                        break

                    # If duration meets minimum threshold, consider as candidate
                    if duration >= self.min_duration:
                        selected_lines = anchors[start_idx : end_idx + 1]
                        dlg_count = sum(1 for l in selected_lines if l.line_type == "dialogue")
                        
                        # Only include if there is at least one dialogue line or strong action
                        if dlg_count >= 1:
                            window = CandidateWindow(
                                episode_number=screenplay.episode_number,
                                scene_number=scene.scene_number,
                                start_timestamp=start_line.start_timestamp,
                                end_timestamp=end_line.end_timestamp,
                                start_seconds=start_sec,
                                end_seconds=end_sec,
                                duration_seconds=round(duration, 2),
                                first_line_speaker=start_line.speaker,
                                first_line_text=start_line.text,
                                last_line_speaker=end_line.speaker,
                                last_line_text=end_line.text,
                                dialogue_count=dlg_count,
                                lines=selected_lines
                            )
                            candidates.append(window)

        logger.info(
            f"Episode {screenplay.episode_number}: generated {len(candidates)} candidate windows (between {self.min_duration}s and {self.max_duration}s)."
        )
        return candidates

    def prepare_llm_context(self, screenplay: ParsedScreenplay) -> str:
        """
        Formats the entire episode with all scene headings, action notes, and dialogues with timestamps
        for sending to the LLM in structured discovery prompts.
        """
        parts = [
            f"EPISODE NUMBER: Episode {screenplay.episode_number}",
            f"LOGLINE: {screenplay.logline}",
            f"CONTINUITY: {screenplay.continuity_notes}",
            f"TOTAL DURATION: {screenplay.total_duration_seconds:.2f}s",
            "--- EPISODE SCRIPT WITH TIMECODES ---"
        ]

        for scene in screenplay.scenes:
            parts.append(f"\n[SCENE {scene.scene_number}: {scene.heading}] (Start: {scene.start_timestamp} | End: {scene.end_timestamp})")
            for line in scene.lines:
                if line.line_type == "dialogue":
                    speaker = line.speaker or "CHARACTER"
                    paren = f" ({line.parenthetical})" if line.parenthetical else ""
                    parts.append(f"  [{line.start_timestamp} - {line.end_timestamp}] {speaker}{paren}: \"{line.text}\"")
                elif line.line_type == "action":
                    parts.append(f"  [{line.start_timestamp} - {line.end_timestamp}] ACTION: {line.text}")
                elif line.line_type == "camera":
                    parts.append(f"  [{line.start_timestamp} - {line.end_timestamp}] CAMERA: {line.text}")

        return "\n".join(parts)


scene_segmenter = SceneSegmenter()
