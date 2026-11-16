from typing import Dict, Any, List
from pydantic import BaseModel
from app.core.config import settings
from app.core.logging import logger


class ScoreWeights(BaseModel):
    hook: float = settings.WEIGHT_HOOK
    cliffhanger: float = settings.WEIGHT_CLIFFHANGER
    standalone: float = settings.WEIGHT_STANDALONE
    emotional_impact: float = settings.WEIGHT_EMOTIONAL_IMPACT
    narrative_continuity: float = settings.WEIGHT_NARRATIVE_CONTINUITY


class RankingService:
    """
    Transparent, explainable multi-factor scoring engine for promotional candidates.
    Combines subjective LLM narrative evaluations with objective validation metrics.
    """

    def __init__(self, weights: ScoreWeights = ScoreWeights()):
        self.weights = weights

    def calculate_overall_score(
        self,
        hook_score: float,
        cliffhanger_score: float,
        standalone_score: float,
        emotional_impact_score: float,
        continuity_score: float,
        validation_status: str = "valid"
    ) -> float:
        """
        Computes a normalized 0-100 composite score.
        Formula:
          Base = 10 * (w_h*Hook + w_c*Cliffhanger + w_s*Standalone + w_e*Emotional + w_n*Continuity)
        """
        # Clamp inputs to [0.0, 10.0]
        h = max(0.0, min(10.0, hook_score))
        c = max(0.0, min(10.0, cliffhanger_score))
        s = max(0.0, min(10.0, standalone_score))
        e = max(0.0, min(10.0, emotional_impact_score))
        n = max(0.0, min(10.0, continuity_score))

        weighted_sum = (
            self.weights.hook * h +
            self.weights.cliffhanger * c +
            self.weights.standalone * s +
            self.weights.emotional_impact * e +
            self.weights.narrative_continuity * n
        )

        base_score = round(weighted_sum * 10.0, 1)

        # Apply deterministic validation penalties
        if validation_status == "warning":
            base_score = max(0.0, base_score - 5.0)
        elif validation_status == "invalid":
            base_score = max(0.0, base_score - 30.0)

        return base_score

    def explain_score(
        self,
        hook_score: float,
        cliffhanger_score: float,
        standalone_score: float,
        emotional_impact_score: float,
        continuity_score: float,
        overall_score: float,
        validation_status: str
    ) -> Dict[str, Any]:
        """Provides an explainability breakdown for content editors."""
        return {
            "composite_score": overall_score,
            "weights": {
                "hook": f"{self.weights.hook * 100:.0f}%",
                "cliffhanger": f"{self.weights.cliffhanger * 100:.0f}%",
                "standalone_context": f"{self.weights.standalone * 100:.0f}%",
                "emotional_impact": f"{self.weights.emotional_impact * 100:.0f}%",
                "narrative_continuity": f"{self.weights.narrative_continuity * 100:.0f}%",
            },
            "raw_scores": {
                "hook": hook_score,
                "cliffhanger": cliffhanger_score,
                "standalone": standalone_score,
                "emotional_impact": emotional_impact_score,
                "narrative_continuity": continuity_score
            },
            "validation_status": validation_status
        }


ranking_service = RankingService()
