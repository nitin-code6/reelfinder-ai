import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship
from app.db.database import Base


class Show(Base):
    __tablename__ = "shows"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    language = Column(String(50), default="English", nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    episodes = relationship("Episode", back_populates="show", cascade="all, delete-orphan", order_by="Episode.episode_number")
    promos = relationship("Promo", back_populates="show", cascade="all, delete-orphan")
