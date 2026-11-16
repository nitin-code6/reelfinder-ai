import pytest
from app.services.ranking_service import RankingService, ScoreWeights


def test_ranking_calculation_valid():
    service = RankingService()
    
    # Perfect 10s across all dimensions
    score_100 = service.calculate_overall_score(
        hook_score=10.0,
        cliffhanger_score=10.0,
        standalone_score=10.0,
        emotional_impact_score=10.0,
        continuity_score=10.0,
        validation_status="valid"
    )
    assert score_100 == 100.0

    # Weighted check
    # 0.25*8 + 0.25*8 + 0.20*8 + 0.15*8 + 0.15*8 = 8.0 * 10 = 80.0
    score_80 = service.calculate_overall_score(
        hook_score=8.0,
        cliffhanger_score=8.0,
        standalone_score=8.0,
        emotional_impact_score=8.0,
        continuity_score=8.0,
        validation_status="valid"
    )
    assert score_80 == 80.0


def test_ranking_penalties():
    service = RankingService()
    
    # Status warning incurs 5 point penalty
    score_warn = service.calculate_overall_score(
        hook_score=9.0,
        cliffhanger_score=9.0,
        standalone_score=9.0,
        emotional_impact_score=9.0,
        continuity_score=9.0,
        validation_status="warning"
    )
    assert score_warn == 85.0  # 90.0 - 5.0

    # Status invalid candidates receive 0.0 score (rejected)
    score_inv = service.calculate_overall_score(
        hook_score=9.0,
        cliffhanger_score=9.0,
        standalone_score=9.0,
        emotional_impact_score=9.0,
        continuity_score=9.0,
        validation_status="invalid"
    )
    assert score_inv == 0.0


def test_ranking_explain_breakdown():
    service = RankingService()
    explanation = service.explain_score(
        hook_score=9.0,
        cliffhanger_score=9.5,
        standalone_score=8.0,
        emotional_impact_score=8.5,
        continuity_score=9.0,
        overall_score=88.5,
        validation_status="valid"
    )
    assert explanation["composite_score"] == 88.5
    assert explanation["weights"]["hook"] == "25%"
    assert explanation["raw_scores"]["hook"] == 9.0
