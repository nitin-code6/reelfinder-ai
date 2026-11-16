from pathlib import Path
import pytest
from app.services.screenplay_parser import TxtScreenplayParser
from app.services.scene_segmenter import SceneSegmenter

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"


def test_generate_candidate_windows():
    sample_file = FIXTURES_DIR / "sample_screenplay.txt"
    parser = TxtScreenplayParser()
    screenplay = parser.parse_file(sample_file)

    segmenter = SceneSegmenter(min_duration=20.0, max_duration=60.0)
    windows = segmenter.generate_candidate_windows(screenplay)

    assert len(windows) > 0
    for w in windows:
        assert 20.0 <= w.duration_seconds <= 60.0
        assert w.start_seconds < w.end_seconds
        assert w.dialogue_count >= 1
        assert len(w.lines) >= 1
        
        # Transcript should include timestamps and character dialogue
        transcript = w.get_transcript_text()
        assert len(transcript) > 0
        assert "[" in transcript and "]" in transcript


def test_prepare_llm_context():
    sample_file = FIXTURES_DIR / "sample_screenplay.txt"
    parser = TxtScreenplayParser()
    screenplay = parser.parse_file(sample_file)

    segmenter = SceneSegmenter()
    context = segmenter.prepare_llm_context(screenplay)

    assert "EPISODE NUMBER: Episode 1" in context
    assert "INT. GRAND BALLROOM - NIGHT" in context
    assert "SOPHIA" in context
    assert "Marcus! You cannot sign that treaty" in context
