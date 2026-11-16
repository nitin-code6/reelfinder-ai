from pydantic import BaseModel
from typing import Optional
import datetime
from app.models.episode import ProcessingStatus


class EpisodeBase(BaseModel):
    episode_number: int
    original_filename: str


class EpisodeCreate(EpisodeBase):
    show_id: int
    file_path: str
    logline: Optional[str] = None
    continuity_notes: Optional[str] = None
    raw_content: Optional[str] = None
    scene_count: Optional[int] = 0
    duration_estimate_seconds: Optional[int] = 0


class EpisodeRead(EpisodeBase):
    id: int
    show_id: int
    logline: Optional[str] = None
    continuity_notes: Optional[str] = None
    scene_count: int
    duration_estimate_seconds: int
    processing_status: str
    error_message: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True
