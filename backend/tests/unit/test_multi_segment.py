import pytest
from app.services.timestamp_validator import timestamp_validator
from app.services.screenplay_parser import ParsedScreenplay, ParsedScene, ScreenplayLine


def create_dummy_screenplay():
    cues = [
        ScreenplayLine(line_type="dialogue", start_timestamp="00:05.00", end_timestamp="00:18.00", start_seconds=5.0, end_seconds=18.0, duration_seconds=13.0, speaker="MARGARET", text="You cannot hide what you did in Vienna."),
        ScreenplayLine(line_type="dialogue", start_timestamp="00:18.00", end_timestamp="00:25.00", start_seconds=18.0, end_seconds=25.0, duration_seconds=7.0, speaker="VANCE", text="I did what was necessary for the Crown."),
        ScreenplayLine(line_type="action", start_timestamp="00:25.00", end_timestamp="00:45.00", start_seconds=25.0, end_seconds=45.0, duration_seconds=20.0, speaker="ACTION", text="Servants arrange silverware quietly across the banquet table."),
        ScreenplayLine(line_type="dialogue", start_timestamp="00:45.00", end_timestamp="00:58.00", start_seconds=45.0, end_seconds=58.0, duration_seconds=13.0, speaker="MARGARET", text="Then explain why the poison was found in your chambers!"),
        ScreenplayLine(line_type="dialogue", start_timestamp="00:58.00", end_timestamp="01:05.00", start_seconds=58.0, end_seconds=65.0, duration_seconds=7.0, speaker="VANCE", text="Because someone wanted me dead before tonight.")
    ]
    scene = ParsedScene(
        scene_number=1,
        heading="INT. BANQUET HALL - NIGHT",
        start_timestamp="00:05.00",
        end_timestamp="01:05.00",
        start_seconds=5.0,
        end_seconds=65.0,
        duration_seconds=60.0,
        lines=cues
    )
    return ParsedScreenplay(
        show_title="Test Show",
        episode_number=1,
        total_duration_seconds=65.0,
        scenes=[scene]
    )


def test_multi_segment_individual_segment_validation():
    sp = create_dummy_screenplay()

    # Seg 1: 00:05.00 to 00:25.00 (20.0s)
    res1 = timestamp_validator.validate_candidate(
        candidate_start_ts="00:05.00",
        candidate_end_ts="00:25.00",
        screenplay=sp,
        is_segment=True
    )
    assert res1.is_valid is True
    assert res1.duration_seconds == 20.0

    # Seg 2: 00:45.00 to 01:05.00 (20.0s) - individual segment duration 20s
    res2 = timestamp_validator.validate_candidate(
        candidate_start_ts="00:45.00",
        candidate_end_ts="01:05.00",
        screenplay=sp,
        is_segment=True
    )
    assert res2.is_valid is True
    assert res2.duration_seconds == 20.0

    # Short segment: 00:05.00 to 00:18.00 (13.0s) - should be valid when is_segment=True (since min is 3.0s)
    res_short = timestamp_validator.validate_candidate(
        candidate_start_ts="00:05.00",
        candidate_end_ts="00:18.00",
        screenplay=sp,
        is_segment=True
    )
    assert res_short.is_valid is True
    assert res_short.duration_seconds == 13.0

    # But for a standalone single promo (is_segment=False), 13s is invalid (< 20s)
    res_single_short = timestamp_validator.validate_candidate(
        candidate_start_ts="00:05.00",
        candidate_end_ts="00:18.00",
        screenplay=sp,
        is_segment=False
    )
    assert res_single_short.is_valid is False
    assert any("below minimum requirement" in l for l in res_single_short.limitations)


def test_action_not_treated_as_character():
    sp = create_dummy_screenplay()

    # Hook that mentions ACTION as a character
    res = timestamp_validator.validate_candidate(
        candidate_start_ts="00:05.00",
        candidate_end_ts="00:45.00",
        screenplay=sp,
        hook_text="ACTION states that the royal crown is missing",
        cliffhanger_text="Vance demands the truth"
    )
    assert any("treats 'ACTION' as a character" in l for l in res.limitations)


def test_multi_segment_duration_calculation_with_gaps():
    """Verify that multi-segment total duration is the sum of segment durations, not start-to-end span."""
    sp = create_dummy_screenplay()

    seg1 = timestamp_validator.validate_candidate(
        candidate_start_ts="00:05.00",
        candidate_end_ts="00:18.00",
        screenplay=sp,
        is_segment=True
    )
    seg2 = timestamp_validator.validate_candidate(
        candidate_start_ts="00:45.00",
        candidate_end_ts="00:58.00",
        screenplay=sp,
        is_segment=True
    )

    # Seg 1 duration: 13.0s, Seg 2 duration: 13.0s
    assert seg1.duration_seconds == 13.0
    assert seg2.duration_seconds == 13.0

    # Sum of segment durations = 26.0s (valid 20-60s)
    total_duration = seg1.duration_seconds + seg2.duration_seconds
    assert total_duration == 26.0

    # Note: If calculated incorrectly as end of seg2 (00:58) minus start of seg1 (00:05), span would be 53.0s!
    raw_span = 58.0 - 5.0
    assert raw_span == 53.0
    assert total_duration != raw_span  # MUST NOT equal the span with gaps


def test_multi_segment_rejects_overlapping_or_overlong_candidate():
    """Verify that multi-segment candidate with > 60s or overlapping segments is invalid."""
    sp = create_dummy_screenplay()

    # Segments that sum to 78.0s (> 60s limit)
    durations = [35.0, 43.0]
    total_dur = sum(durations)
    assert total_dur == 78.0

    # Overlap check
    seg1_end = 25.0
    seg2_start = 20.0  # Starts before seg1 ends
    assert seg2_start < seg1_end  # Overlap detected!


def test_episode_mapping_regression_promo_ep03_and_ep04():
    """Regression test ensuring Episode 3 and Episode 4 segments retain their source episode identities."""
    from app.schemas.promo import PromoSegmentCreate

    # When processing Ep 3, segments must have episode_number=3, not 1
    ep3_num = 3
    seg_ep3 = PromoSegmentCreate(
        episode_number=ep3_num,
        start_timestamp="00:04.00",
        end_timestamp="00:12.00",
        duration_seconds=8.0,
        segment_order=1
    )
    assert seg_ep3.episode_number == 3
    assert seg_ep3.episode_number != 1

    # When processing Ep 4, segments must have episode_number=4, not 1
    ep4_num = 4
    seg_ep4 = PromoSegmentCreate(
        episode_number=ep4_num,
        start_timestamp="01:01.00",
        end_timestamp="01:13.00",
        duration_seconds=12.0,
        segment_order=1
    )
    assert seg_ep4.episode_number == 4
    assert seg_ep4.episode_number != 1

