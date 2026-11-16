from pydantic import BaseModel
from typing import Optional, List
import datetime


class ShowBase(BaseModel):
    title: str
    language: str = "English"
    description: Optional[str] = None


class ShowCreate(ShowBase):
    pass


class ShowRead(ShowBase):
    id: int
    created_at: datetime.datetime
    episode_count: Optional[int] = 0
    promo_count: Optional[int] = 0

    class Config:
        from_attributes = True
