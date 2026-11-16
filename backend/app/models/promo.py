import datetime
from sqlalchemy import Column, Integer, Float, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.database import Base


class Promo(Base):
    __tablename__ = "promos"

    id = Column(Integer, primary_key=True, index=True)
    show_id = Column(Integer, ForeignKey("shows.id", ondelete="CASCADE"), nullable=False, index=True)
    promo_identifier = Column(String(50), nullable=False, index=True)
    primary_episode_number = Column(Integer, nullable=False, index=True)
    
    # Narrative Content
    hook = Column(Text, nullable=False)
    cliffhanger = Column(Text, nullable=False)
    standalone_context = Column(Text, nullable=False)
    reason = Column(Text, nullable=False)
    
    # Timing
    total_duration_seconds = Column(Float, nullable=False)
    
    # Detailed Scores (1-10 scale)
    hook_score = Column(Float, default=0.0)
    cliffhanger_score = Column(Float, default=0.0)
    standalone_score = Column(Float, default=0.0)
    emotional_impact_score = Column(Float, default=0.0)
    continuity_score = Column(Float, default=0.0)
    
    # Composite Score (0-100 scale)
    overall_score = Column(Float, default=0.0, index=True)
    
    # Validation & Integrity
    validation_status = Column(String(50), default="valid", index=True)  # valid, warning, invalid
    limitations = Column(JSON, default=list)
    
    # Human-in-the-Loop Editorial State
    approval_status = Column(String(50), default="pending", index=True)  # pending, approved, rejected, modified
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    show = relationship("Show", back_populates="promos")
    segments = relationship("PromoSegment", back_populates="promo", cascade="all, delete-orphan", order_by="PromoSegment.segment_order")
    feedbacks = relationship("EditorFeedback", back_populates="promo", cascade="all, delete-orphan")


class PromoSegment(Base):
    __tablename__ = "promo_segments"

    id = Column(Integer, primary_key=True, index=True)
    promo_id = Column(Integer, ForeignKey("promos.id", ondelete="CASCADE"), nullable=False, index=True)
    episode_id = Column(Integer, ForeignKey("episodes.id", ondelete="CASCADE"), nullable=True, index=True)
    episode_number = Column(Integer, nullable=False)
    
    start_timestamp = Column(String(50), nullable=False)
    end_timestamp = Column(String(50), nullable=False)
    duration_seconds = Column(Float, nullable=False)
    segment_order = Column(Integer, default=1, nullable=False)
    
    scene_heading = Column(String(200), nullable=True)
    first_line = Column(Text, nullable=True)
    last_line = Column(Text, nullable=True)

    promo = relationship("Promo", back_populates="segments")
    episode = relationship("Episode", back_populates="promo_segments")
