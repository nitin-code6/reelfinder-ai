from typing import List, Optional, Tuple, Dict, Any
from pydantic import BaseModel
from app.services.screenplay_parser import (
    ParsedScreenplay,
    ScreenplayLine,
    parse_timestamp_to_seconds,
    format_seconds_to_timestamp,
    is_valid_timestamp_string
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
    - Start timestamp < End timestamp.
    - Duration strictly adheres to assignment requirement (20s to 60s).
    - Detects and records any hallucinations or timestamp drift.
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
        screenplay: ParsedScreenplay
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

        start_sec = parse_timestamp_to_seconds(candidate_start_ts)
        end_sec = parse_timestamp_to_seconds(candidate_end_ts)

        # 1. Format and numerical sanity check
        if not is_valid_timestamp_string(candidate_start_ts) or not is_valid_timestamp_string(candidate_end_ts):
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

        # 2. Chronological order check
        if start_sec >= end_sec:
            limitations.append(
                f"Start time ({candidate_start_ts}) must occur before end time ({candidate_end_ts})."
            )
            return ValidationResult(
                is_valid=False,
                status="invalid",
                start_timestamp=candidate_start_ts,
                end_timestamp=candidate_end_ts,
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
                f"Start timestamp '{candidate_start_ts}' does not exist in source screenplay cues (closest is {matched_start_line.start_timestamp if matched_start_line else 'none'})."
            )
            has_invented_timestamp = True

        if min_end_diff > 1.0:
            limitations.append(
                f"End timestamp '{candidate_end_ts}' does not exist in source screenplay cues (closest is {matched_end_line.end_timestamp if matched_end_line else 'none'})."
            )
            has_invented_timestamp = True

        # Calculate exact duration from raw proposed bounds
        duration = round(end_sec - start_sec, 2)

        # Minor cue alignment (only if within 0.5s tolerance and not invented)
        final_start_ts = candidate_start_ts
        final_end_ts = candidate_end_ts

        if not has_invented_timestamp:
            if 0.05 < min_start_diff <= 0.5 and matched_start_line:
                limitations.append(
                    f"Proposed start '{candidate_start_ts}' aligned with nearest cue '{matched_start_line.start_timestamp}'."
                )
                final_start_ts = matched_start_line.start_timestamp
                start_sec = matched_start_line.start_seconds

            if 0.05 < min_end_diff <= 0.5 and matched_end_line:
                limitations.append(
                    f"Proposed end '{candidate_end_ts}' aligned with nearest cue '{matched_end_line.end_timestamp}'."
                )
                final_end_ts = matched_end_line.end_timestamp
                end_sec = matched_end_line.end_seconds

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

        # Determine overall validation status
        if has_invented_timestamp or not is_duration_valid:
            status = "invalid"
            is_valid = False
        elif limitations:
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
