from pathlib import Path
import pytest
from app.services.screenplay_parser import TxtScreenplayParser, PdfScreenplayParser

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"


def test_parse_valid_screenplay_txt():
    sample_file = FIXTURES_DIR / "sample_screenplay.txt"
    parser = TxtScreenplayParser()
    screenplay = parser.parse_file(sample_file)

    assert screenplay.episode_number == 1
    assert "Sophia arrives at the royal gala" in screenplay.logline
    assert len(screenplay.scenes) == 1
    
    scene = screenplay.scenes[0]
    assert scene.heading == "INT. GRAND BALLROOM - NIGHT"
    assert scene.start_timestamp == "00:00.00"
    assert scene.end_timestamp == "01:45.00"
    assert scene.duration_seconds == 105.0

    all_lines = screenplay.get_all_lines()
    assert len(all_lines) >= 8

    dialogues = screenplay.get_dialogue_lines()
    assert len(dialogues) >= 4
    
    # Check first dialogue
    first_dlg = dialogues[0]
    assert first_dlg.speaker == "SOPHIA"
    assert first_dlg.parenthetical == "Determined, Breathless"
    assert "Marcus! You cannot sign that treaty" in first_dlg.text
    assert first_dlg.start_seconds == 4.20
    assert first_dlg.end_seconds == 6.80


def test_parse_invalid_malformed_screenplay():
    invalid_file = FIXTURES_DIR / "invalid_screenplay.txt"
    parser = TxtScreenplayParser()
    # Should not throw uncaught exception, but gracefully produce fallback structure
    screenplay = parser.parse_file(invalid_file)
    assert screenplay is not None
    assert isinstance(screenplay.episode_number, int)


def test_parse_from_raw_string():
    raw_text = """
EPISODE NUMBER: Episode 42
EPISODE LOGLINE: Test single episode string

SCENE 01
Scene heading: INT. LAB - DAY
Scene start: 00:00.00
Scene end: 01:00.00

**DOCTOR (Excited):**
Start: (00:05.00) | End: (00:10.00)
"The formula is complete!"
"""
    parser = TxtScreenplayParser()
    screenplay = parser.parse_text(raw_text)
    assert screenplay.episode_number == 42
    assert len(screenplay.scenes) == 1
    assert screenplay.get_dialogue_lines()[0].speaker == "DOCTOR"
