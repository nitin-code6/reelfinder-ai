import pytest
from app.services.screenplay_parser import parse_timestamp_to_seconds, format_seconds_to_timestamp


def test_parse_timestamp_variants():
    # Standard format: MM:SS.ss
    assert parse_timestamp_to_seconds("00:11.30") == 11.30
    assert parse_timestamp_to_seconds("(00:11.30)") == 11.30
    assert parse_timestamp_to_seconds("[00:11.30]") == 11.30

    # Minutes and seconds
    assert parse_timestamp_to_seconds("01:15.50") == 75.50
    assert parse_timestamp_to_seconds("02:00.00") == 120.00

    # Three-part timecode: HH:MM:SS.ss
    assert parse_timestamp_to_seconds("00:01:30.00") == 90.00
    assert parse_timestamp_to_seconds("01:00:00.00") == 3600.00

    # Single value
    assert parse_timestamp_to_seconds("45.5") == 45.5

    # Malformed strings should safely default to 0.0
    assert parse_timestamp_to_seconds("invalid_time") == 0.0
    assert parse_timestamp_to_seconds("") == 0.0
    assert parse_timestamp_to_seconds(":::") == 0.0


def test_format_seconds_to_timestamp():
    assert format_seconds_to_timestamp(11.30) == "00:11.30"
    assert format_seconds_to_timestamp(75.50) == "01:15.50"
    assert format_seconds_to_timestamp(120.00) == "02:00.00"
    assert format_seconds_to_timestamp(0.0) == "00:00.00"
