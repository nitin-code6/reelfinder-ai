import json
from pathlib import Path
import pytest

OUTPUTS_FILE = Path("outputs/raw_outputs_50_episodes.json")


def test_50_episode_batch_outputs_integrity():
    if not OUTPUTS_FILE.exists():
        pytest.skip("outputs/raw_outputs_50_episodes.json not generated yet.")

    with open(OUTPUTS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    summary = data["summary"]
    all_promos = data["all_promos"]

    assert summary["benchmark_metadata"]["total_episodes_evaluated"] == 50
    assert len(all_promos) == summary["benchmark_metadata"]["total_promos_discovered"]
    assert len(all_promos) > 0

    for promo in all_promos:
        # 1. Duration requirement checked on valid promos
        dur = promo["total_duration_seconds"]
        if promo["validation_status"] == "valid":
            assert 20.0 <= dur <= 60.0, f"Valid promo {promo['promo_id']} duration {dur}s violates 20-60s limit!"
        else:
            assert promo["validation_status"] in ["warning", "invalid"]

        # 2. Hook & Cliffhanger descriptions present
        assert len(promo["hook"]) > 5
        assert len(promo["cliffhanger"]) > 5
        assert len(promo["why_it_works"]) > 5

        # 3. Segments have valid start and end timestamps
        assert len(promo["segments"]) >= 1
        for seg in promo["segments"]:
            assert seg["start_timestamp"] is not None
            assert seg["end_timestamp"] is not None
            assert seg["duration_seconds"] > 0

        # 4. Score is calculated and within [0, 100]
        assert 0.0 <= promo["overall_score"] <= 100.0


def test_ranking_order_consistency():
    if not OUTPUTS_FILE.exists():
        pytest.skip("outputs/raw_outputs_50_episodes.json not generated yet.")

    with open(OUTPUTS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    promos = data["all_promos"]
    # Check that promos are sorted in descending order of overall_score
    scores = [p["overall_score"] for p in promos]
    assert scores == sorted(scores, reverse=True)
