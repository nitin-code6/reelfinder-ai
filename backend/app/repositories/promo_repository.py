from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.promo import Promo, PromoSegment
from app.models.feedback import EditorFeedback
from app.schemas.promo import PromoCreate
from app.schemas.feedback import EditorFeedbackCreate


class PromoRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, promo_id: int) -> Optional[Promo]:
        return self.db.query(Promo).filter(Promo.id == promo_id).first()

    def list_promos(
        self,
        show_id: Optional[int] = None,
        episode_number: Optional[int] = None,
        approval_status: Optional[str] = None,
        validation_status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Promo]:
        query = self.db.query(Promo)
        if show_id:
            query = query.filter(Promo.show_id == show_id)
        if episode_number:
            query = query.filter(Promo.primary_episode_number == episode_number)
        if approval_status:
            query = query.filter(Promo.approval_status == approval_status)
        if validation_status:
            query = query.filter(Promo.validation_status == validation_status)
        
        return query.order_by(Promo.overall_score.desc()).offset(skip).limit(limit).all()

    def delete_by_show_and_episode(self, show_id: int, episode_number: int) -> int:
        """Deletes all existing promos for a given show and episode to prevent duplicates."""
        promos = self.db.query(Promo).filter(
            Promo.show_id == show_id,
            Promo.primary_episode_number == episode_number
        ).all()
        count = len(promos)
        for promo in promos:
            self.db.delete(promo)
        if count > 0:
            self.db.commit()
        return count

    def create(self, promo_in: PromoCreate) -> Promo:
        promo = Promo(
            show_id=promo_in.show_id,
            promo_identifier=promo_in.promo_identifier,
            primary_episode_number=promo_in.primary_episode_number,
            hook=promo_in.hook,
            cliffhanger=promo_in.cliffhanger,
            standalone_context=promo_in.standalone_context,
            reason=promo_in.reason,
            total_duration_seconds=promo_in.total_duration_seconds,
            hook_score=promo_in.hook_score,
            cliffhanger_score=promo_in.cliffhanger_score,
            standalone_score=promo_in.standalone_score,
            emotional_impact_score=promo_in.emotional_impact_score,
            continuity_score=promo_in.continuity_score,
            overall_score=promo_in.overall_score,
            validation_status=promo_in.validation_status,
            limitations=promo_in.limitations,
            approval_status=promo_in.approval_status
        )
        self.db.add(promo)
        self.db.flush()

        for seg in promo_in.segments:
            segment = PromoSegment(
                promo_id=promo.id,
                episode_id=seg.episode_id,
                episode_number=seg.episode_number,
                start_timestamp=seg.start_timestamp,
                end_timestamp=seg.end_timestamp,
                duration_seconds=seg.duration_seconds,
                segment_order=seg.segment_order,
                scene_heading=seg.scene_heading,
                first_line=seg.first_line,
                last_line=seg.last_line
            )
            self.db.add(segment)

        self.db.commit()
        self.db.refresh(promo)
        return promo

    def update_approval(self, promo_id: int, status: str) -> Optional[Promo]:
        promo = self.get_by_id(promo_id)
        if promo:
            promo.approval_status = status
            self.db.commit()
            self.db.refresh(promo)
        return promo

    def add_feedback(self, promo_id: int, feedback_in: EditorFeedbackCreate) -> EditorFeedback:
        feedback = EditorFeedback(
            promo_id=promo_id,
            user_id=feedback_in.user_id,
            decision=feedback_in.decision,
            comments=feedback_in.comments
        )
        self.db.add(feedback)
        
        # Also update promo approval_status accordingly
        promo = self.get_by_id(promo_id)
        if promo:
            promo.approval_status = feedback_in.decision

        self.db.commit()
        self.db.refresh(feedback)
        return feedback
