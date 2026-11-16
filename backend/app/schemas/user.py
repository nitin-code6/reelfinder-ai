from pydantic import BaseModel
from typing import Optional
import datetime


class UserBase(BaseModel):
    name: str
    email: str
    role: str = "editor"


class UserCreate(UserBase):
    pass


class UserRead(UserBase):
    id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True
