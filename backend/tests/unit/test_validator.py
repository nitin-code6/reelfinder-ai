from pathlib import Path
import pytest
from app.services.screenplay_parser import TxtScreenplayParser
from app.services.timestamp_validator import TimestampValidator

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"


def test_validator_valid_candidate():
    sample_file = FIXTURES_DIR / "sample_screenplay.txt"
    parser = TxtScreenplayParser()
    screenplay = parser.parse_file(sample_file)

    validator = TimestampValidator(min_duration=20.0, max_duration=60.0)
    
    # 00:04.20 to 00:37.80 = 33.60s (valid window)
    res = validator.validate_candidate(
        candidate_start_ts="00:04.20",
        candidate_end_ts="00:37.80",
        screenplay=screenplay
    )

    assert res.is_valid is True
    assert res.status == "valid"
    assert res.duration_seconds == 33.60
    assert len(res.limitations) == 0
    assert res.scene_heading == "INT. GRAND BALLROOM - NIGHT"
    assert "Marcus! You cannot sign that treaty" in res.first_line


def test_validator_duration_too_short():
    sample_file = FIXTURES_DIR / "sample_screenplay.txt"
    parser = TxtScreenplayParser()
    screenplay = parser.parse_file(sample_file)

    validator = TimestampValidator(min_duration=20.0, max_duration=60.0)
    
    # 00:04.20 to 00:11.50 = 7.30s (too short)
    res = validator.validate_candidate(
        candidate_start_ts="00:04.20",
        candidate_end_ts="00:11.50",
        screenplay=screenplay
    )

    assert res.is_valid is False
    assert res.status == "invalid"
    assert any("below minimum requirement" in l for l in res.limitations)


def test_validator_chronological_order_violation():
    sample_file = FIXTURES_DIR / "sample_screenplay.txt"
    parser = TxtScreenplayParser()
    screenplay = parser.parse_file(sample_file)

    validator = TimestampValidator()
    
    # Start occurs after end
    res = validator.validate_candidate(
        candidate_start_ts="00:35.00",
        candidate_end_ts="00:10.00",
        screenplay=screenplay
    )

    assert res.is_valid is False
    assert res.status == "invalid"
    assert any("must occur before end time" in l for l in res.limitations)


def test_validator_snaps_approximate_timestamps():
    sample_file = FIXTURES_DIR / "sample_screenplay.txt"
    parser = TxtScreenplayParser()
    screenplay = parser.parse_file(sample_file)

    validator = TimestampValidator(min_duration=20.0, max_duration=60.0)
    
    # LLM proposed approximate timestamp 00:04.00 (nearest is 00:04.20)
    res = validator.validate_candidate(
        candidate_start_ts="00:04.00",
        candidate_end_ts="00:38.00",
        screenplay=screenplay
    )

    assert res.is_valid is True
    assert res.status == "warning"
    assert any("aligned with nearest cue" in l or "snapped" in l for l in res.limitations)


def test_validator_rejects_invented_timestamps():
    sample_file = FIXTURES_DIR / "sample_screenplay.txt"
    parser = TxtScreenplayParser()
    screenplay = parser.parse_file(sample_file)

    validator = TimestampValidator(min_duration=20.0, max_duration=60.0)
    
    # Timestamps completely fabricated (not in screenplay)
    res = validator.validate_candidate(
        candidate_start_ts="08:00.00",
        candidate_end_ts="08:30.00",
        screenplay=screenplay
    )

    assert res.is_valid is False
    assert res.status == "invalid"
    assert any("does not exist in source screenplay cues" in l for l in res.limitations)


def test_validator_rejects_malformed_timestamp_strings():
    sample_file = FIXTURES_DIR / "sample_screenplay.txt"
    parser = TxtScreenplayParser()
    screenplay = parser.parse_file(sample_file)

    validator = TimestampValidator()
    
    res = validator.validate_candidate(
        candidate_start_ts="invalid_time",
        candidate_end_ts="00:30.00",
        screenplay=screenplay
    )

    assert res.is_valid is False
    assert res.status == "invalid"
    assert any("Malformed timestamp format" in l for l in res.limitations)
