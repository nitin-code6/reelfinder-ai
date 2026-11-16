from pydantic import BaseModel
from typing import Optional
import datetime


class EditorFeedbackCreate(BaseModel):
    decision: str  # approved, rejected, modified
    comments: Optional[str] = None
    user_id: Optional[int] = None


class EditorFeedbackRead(BaseModel):
    id: int
    promo_id: int
    user_id: Optional[int] = None
    decision: str
    comments: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True
