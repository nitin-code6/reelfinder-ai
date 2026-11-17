from typing import List, Optional, Tuple, Dict, Any
import re
from pydantic import BaseModel
from app.services.screenplay_parser import (
    ParsedScreenplay,
    ScreenplayLine,
    parse_timestamp_to_seconds,
    format_seconds_to_timestamp,
    is_valid_timestamp_string,
    normalize_timestamp
)
from app.core.config import settings
from app.core.logging import logger


class ValidationResult(BaseModel):
    is_valid: bool
    status: str  # "valid", "warning", "invalid"
    start_timestamp: str
    end_timestamp: str
    start_seconds: float
    end_seconds: float
    duration_seconds: float
    limitations: List[str] = []
    first_line: Optional[str] = None
    last_line: Optional[str] = None
    scene_heading: Optional[str] = None


class TimestampValidator:
    """
    Deterministic Python validator guaranteeing:
    - Verifiable timestamps matching the source screenplay.
    - Timestamp normalization (e.g. 00:73.00 -> 01:13.00).
    - Start timestamp < End timestamp.
    - Duration strictly adheres to assignment requirement (20s to 60s).
    - Detects and records any hallucinations or timestamp drift.
    - Evidence grounding checks on characters and source cues.
    """

    def __init__(
        self,
        min_duration: float = settings.MIN_PROMO_DURATION,
        max_duration: float = settings.MAX_PROMO_DURATION,
        hook_window: float = settings.HOOK_WINDOW_SECONDS
    ):
        self.min_duration = min_duration
        self.max_duration = max_duration
        self.hook_window = hook_window

    def validate_candidate(
        self,
        candidate_start_ts: str,
        candidate_end_ts: str,
        screenplay: ParsedScreenplay,
        hook_text: Optional[str] = None,
        cliffhanger_text: Optional[str] = None
    ) -> ValidationResult:
        limitations: List[str] = []
        all_lines = screenplay.get_all_lines()

        if not all_lines:
            return ValidationResult(
                is_valid=False,
                status="invalid",
                start_timestamp=candidate_start_ts,
                end_timestamp=candidate_end_ts,
                start_seconds=0.0,
                end_seconds=0.0,
                duration_seconds=0.0,
                limitations=["Source screenplay contains no parsed lines."]
            )

        # 1. Format and numerical sanity check with normalization
        norm_start = normalize_timestamp(candidate_start_ts)
        norm_end = normalize_timestamp(candidate_end_ts)

        if not norm_start or not norm_end:
            limitations.append(
                f"Malformed timestamp format: start='{candidate_start_ts}', end='{candidate_end_ts}'."
            )
            return ValidationResult(
                is_valid=False,
                status="invalid",
                start_timestamp=candidate_start_ts,
                end_timestamp=candidate_end_ts,
                start_seconds=0.0,
                end_seconds=0.0,
                duration_seconds=0.0,
                limitations=limitations
            )

        if norm_start != candidate_start_ts:
            limitations.append(f"Normalized start timestamp from '{candidate_start_ts}' to standard '{norm_start}'.")
        if norm_end != candidate_end_ts:
            limitations.append(f"Normalized end timestamp from '{candidate_end_ts}' to standard '{norm_end}'.")

        start_sec = parse_timestamp_to_seconds(norm_start)
        end_sec = parse_timestamp_to_seconds(norm_end)

        # 2. Chronological order check
        if start_sec >= end_sec:
            limitations.append(
                f"Start time ({candidate_start_ts}) must occur before end time ({candidate_end_ts})."
            )
            return ValidationResult(
                is_valid=False,
                status="invalid",
                start_timestamp=norm_start,
                end_timestamp=norm_end,
                start_seconds=start_sec,
                end_seconds=end_sec,
                duration_seconds=0.0,
                limitations=limitations
            )

        # 3. Source timestamp existence verification
        matched_start_line: Optional[ScreenplayLine] = None
        matched_end_line: Optional[ScreenplayLine] = None

        min_start_diff = float("inf")
        min_end_diff = float("inf")

        for line in all_lines:
            diff_s = abs(line.start_seconds - start_sec)
            if diff_s < min_start_diff:
                min_start_diff = diff_s
                matched_start_line = line

            diff_e = abs(line.end_seconds - end_sec)
            if diff_e < min_end_diff:
                min_end_diff = diff_e
                matched_end_line = line

        # Also check scene boundary timecodes
        for scene in screenplay.scenes:
            diff_sc_s = abs(scene.start_seconds - start_sec)
            if diff_sc_s < min_start_diff:
                min_start_diff = diff_sc_s
            diff_sc_e = abs(scene.end_seconds - end_sec)
            if diff_sc_e < min_end_diff:
                min_end_diff = diff_sc_e

        # Enforce rule: Never invent timestamps.
        # If timestamp difference from any cue is > 1.0s, candidate invented a nonexistent timestamp
        has_invented_timestamp = False
        if min_start_diff > 1.0:
            limitations.append(
                f"Start timestamp '{norm_start}' does not exist in source screenplay cues (closest is {matched_start_line.start_timestamp if matched_start_line else 'none'})."
            )
            has_invented_timestamp = True

        if min_end_diff > 1.0:
            limitations.append(
                f"End timestamp '{norm_end}' does not exist in source screenplay cues (closest is {matched_end_line.end_timestamp if matched_end_line else 'none'})."
            )
            has_invented_timestamp = True

        # Minor cue alignment (only if within 0.5s tolerance and not invented)
        final_start_ts = norm_start
        final_end_ts = norm_end

        if not has_invented_timestamp:
            if 0.05 < min_start_diff <= 0.5 and matched_start_line:
                limitations.append(
                    f"Proposed start '{norm_start}' aligned with nearest cue '{matched_start_line.start_timestamp}'."
                )
                final_start_ts = matched_start_line.start_timestamp
                start_sec = matched_start_line.start_seconds

            if 0.05 < min_end_diff <= 0.5 and matched_end_line:
                limitations.append(
                    f"Proposed end '{norm_end}' aligned with nearest cue '{matched_end_line.end_timestamp}'."
                )
                final_end_ts = matched_end_line.end_timestamp
                end_sec = matched_end_line.end_seconds

        # Recalculate duration after normalization and alignment
        duration = round(end_sec - start_sec, 2)

        # 4. Strict duration boundaries check (20s - 60s)
        is_duration_valid = True
        if duration < self.min_duration:
            limitations.append(
                f"Duration {duration:.1f}s is below minimum requirement ({self.min_duration}s)."
            )
            is_duration_valid = False
        elif duration > self.max_duration:
            limitations.append(
                f"Duration {duration:.1f}s exceeds maximum promo limit ({self.max_duration}s)."
            )
            is_duration_valid = False

        # 5. Extract scene heading and text excerpts
        scene_heading = None
        for scene in screenplay.scenes:
            if scene.start_seconds <= start_sec <= scene.end_seconds:
                scene_heading = scene.heading
                break

        first_line_text = matched_start_line.text if matched_start_line else None
        last_line_text = matched_end_line.text if matched_end_line else None

        # 6. Evidence Grounding Verification
        # Check if named characters or entities mentioned in hook/cliffhanger actually exist in the screenplay
        if hook_text or cliffhanger_text:
            all_speakers = {line.speaker.strip().lower() for line in all_lines if line.speaker}
            combined_script = " ".join([l.text for l in all_lines]).lower()

            for text_field, label in [(hook_text, "Hook"), (cliffhanger_text, "Cliffhanger")]:
                if text_field:
                    names_found = re.findall(r"\b[A-Z][a-z]{2,}\b", text_field)
                    common_ignore = {"The", "This", "That", "When", "What", "Then", "With", "From", "Into", "After", "Before", "Here", "There", "Will"}
                    for name in names_found:
                        if name not in common_ignore and name.lower() not in all_speakers and name.lower() not in combined_script:
                            limitations.append(f"Evidence Warning: {label} mentions character '{name}' not found in screenplay cues.")

        # Determine overall validation status
        if has_invented_timestamp or not is_duration_valid:
            status = "invalid"
            is_valid = False
        elif any("Evidence Warning" in l for l in limitations) or limitations:
            status = "warning"
            is_valid = True
        else:
            status = "valid"
            is_valid = True

        return ValidationResult(
            is_valid=is_valid,
            status=status,
            start_timestamp=final_start_ts,
            end_timestamp=final_end_ts,
            start_seconds=start_sec,
            end_seconds=end_sec,
            duration_seconds=duration,
            limitations=limitations,
            first_line=first_line_text,
            last_line=last_line_text,
            scene_heading=scene_heading
        )


timestamp_validator = TimestampValidator()
