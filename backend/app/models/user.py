import datetime
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    role = Column(String(50), default="editor", nullable=False)  # editor, admin, reviewer
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    feedbacks = relationship("EditorFeedback", back_populates="user", cascade="all, delete-orphan")
