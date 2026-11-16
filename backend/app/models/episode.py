import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
import enum
from app.db.database import Base


class ProcessingStatus(str, enum.Enum):
    PENDING = "pending"
    PARSED = "parsed"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Episode(Base):
    __tablename__ = "episodes"

    id = Column(Integer, primary_key=True, index=True)
    show_id = Column(Integer, ForeignKey("shows.id", ondelete="CASCADE"), nullable=False, index=True)
    episode_number = Column(Integer, nullable=False, index=True)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    
    # Metadata extracted from screenplay
    logline = Column(Text, nullable=True)
    continuity_notes = Column(Text, nullable=True)
    raw_content = Column(Text, nullable=True)
    scene_count = Column(Integer, default=0)
    duration_estimate_seconds = Column(Integer, default=0)
    
    # Processing pipeline status
    processing_status = Column(String(50), default=ProcessingStatus.PENDING.value, index=True)
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    show = relationship("Show", back_populates="episodes")
    promo_segments = relationship("PromoSegment", back_populates="episode", cascade="all, delete-orphan")
