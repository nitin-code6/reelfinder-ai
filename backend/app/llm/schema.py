from typing import List, Optional
from pydantic import BaseModel, Field


class AIPromoSegmentCandidate(BaseModel):
    episode_number: int = Field(default=1, description="Episode number for this segment")
    start_timestamp: str = Field(description="Start timestamp in MM:SS.ss format")
    end_timestamp: str = Field(description="End timestamp in MM:SS.ss format")


class AIPromoCandidate(BaseModel):
    candidate_id: str = Field(description="Unique candidate identifier, e.g. PROMO_01")
    episode_number: int = Field(description="The primary episode number")
    start_timestamp: str = Field(description="Verbatim start timestamp from the screenplay, e.g. 00:11.30")
    end_timestamp: str = Field(description="Verbatim end timestamp from the screenplay, e.g. 00:49.80")
    segments: Optional[List[AIPromoSegmentCandidate]] = Field(default=None, description="Optional multi-segment windows")
    hook: str = Field(description="Action/dialogue occurring in the first 3 seconds that hooks the viewer")
    cliffhanger: str = Field(description="The unresolved tension or unanswered question at the end cutoff")
    standalone_context: str = Field(description="Why this makes complete sense without prior lore or context")
    why_it_works: str = Field(description="Marketing rationale for why this ad will convert viewers")
    
    # Subjective Narrative Quality Scores (1 to 10 scale)
    hook_strength: float = Field(ge=1.0, le=10.0, description="Rate 1-10: How compelling is the 3-second hook?")
    cliffhanger_strength: float = Field(ge=1.0, le=10.0, description="Rate 1-10: How unresolved and suspenseful is the cut?")
    standalone_context_score: float = Field(ge=1.0, le=10.0, description="Rate 1-10: Is it easily understood independently?")
    emotional_impact: float = Field(ge=1.0, le=10.0, description="Rate 1-10: Intensity of conflict, shock, or emotion")
    narrative_continuity: float = Field(ge=1.0, le=10.0, description="Rate 1-10: Smoothness of dialogue progression")


class AIPromoDiscoveryResponse(BaseModel):
    candidates: List[AIPromoCandidate] = Field(default_factory=list, description="List of 1 to 3 top promo candidates")
