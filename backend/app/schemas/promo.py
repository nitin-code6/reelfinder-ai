from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import datetime


class PromoSegmentBase(BaseModel):
    episode_number: int
    start_timestamp: str
    end_timestamp: str
    duration_seconds: float
    segment_order: int = 1
    scene_heading: Optional[str] = None
    first_line: Optional[str] = None
    last_line: Optional[str] = None


class PromoSegmentCreate(PromoSegmentBase):
    episode_id: Optional[int] = None


class PromoSegmentRead(PromoSegmentBase):
    id: int
    promo_id: int

    class Config:
        from_attributes = True


class ScoreBreakdown(BaseModel):
    hook_strength: float = Field(ge=0, le=10)
    cliffhanger_strength: float = Field(ge=0, le=10)
    standalone_context: float = Field(ge=0, le=10)
    emotional_impact: float = Field(ge=0, le=10)
    narrative_continuity: float = Field(ge=0, le=10)


class PromoBase(BaseModel):
    hook: str
    cliffhanger: str
    standalone_context: str
    reason: str
    total_duration_seconds: float


class PromoCreate(PromoBase):
    show_id: int
    promo_identifier: str
    primary_episode_number: int
    hook_score: float = 0.0
    cliffhanger_score: float = 0.0
    standalone_score: float = 0.0
    emotional_impact_score: float = 0.0
    continuity_score: float = 0.0
    overall_score: float = 0.0
    validation_status: str = "valid"
    limitations: List[str] = []
    approval_status: str = "pending"
    provider_name: Optional[str] = "groq"
    model_name: Optional[str] = None
    segments: List[PromoSegmentCreate] = []


class PromoRead(PromoBase):
    id: int
    show_id: int
    promo_identifier: str
    primary_episode_number: int
    hook_score: float
    cliffhanger_score: float
    standalone_score: float
    emotional_impact_score: float
    continuity_score: float
    overall_score: float
    validation_status: str
    limitations: List[Any] = []
    approval_status: str
    provider_name: Optional[str] = None
    model_name: Optional[str] = None
    created_at: datetime.datetime
    segments: List[PromoSegmentRead] = []

    class Config:
        from_attributes = True


class PromoCandidateAIGenerated(BaseModel):
    """Raw structure requested from LLM output."""
    candidate_id: str
    episode_number: int
    start_timestamp: str
    end_timestamp: str
    hook: str
    cliffhanger: str
    standalone_context: str
    why_it_works: str
    scores: ScoreBreakdown
    segment_excerpts: Optional[List[str]] = None
