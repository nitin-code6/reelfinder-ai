from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.episode import Episode, ProcessingStatus
from app.schemas.episode import EpisodeCreate


class EpisodeRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, episode_id: int) -> Optional[Episode]:
        return self.db.query(Episode).filter(Episode.id == episode_id).first()

    def get_by_show_and_number(self, show_id: int, episode_number: int) -> Optional[Episode]:
        return self.db.query(Episode).filter(
            Episode.show_id == show_id,
            Episode.episode_number == episode_number
        ).first()

    def list_by_show(self, show_id: int, skip: int = 0, limit: int = 200) -> List[Episode]:
        return self.db.query(Episode).filter(
            Episode.show_id == show_id
        ).order_by(Episode.episode_number.asc()).offset(skip).limit(limit).all()

    def create(self, episode_in: EpisodeCreate) -> Episode:
        episode = Episode(
            show_id=episode_in.show_id,
            episode_number=episode_in.episode_number,
            original_filename=episode_in.original_filename,
            file_path=episode_in.file_path,
            logline=episode_in.logline,
            continuity_notes=episode_in.continuity_notes,
            raw_content=episode_in.raw_content,
            scene_count=episode_in.scene_count or 0,
            duration_estimate_seconds=episode_in.duration_estimate_seconds or 0,
            processing_status=ProcessingStatus.PENDING.value
        )
        self.db.add(episode)
        self.db.commit()
        self.db.refresh(episode)
        return episode

    def update_status(self, episode_id: int, status: str, error_message: Optional[str] = None) -> Optional[Episode]:
        episode = self.get_by_id(episode_id)
        if episode:
            episode.processing_status = status
            episode.error_message = error_message
            self.db.commit()
            self.db.refresh(episode)
        return episode

    def update_metadata(self, episode_id: int, logline: str, continuity_notes: str, scene_count: int, duration_estimate_seconds: int) -> Optional[Episode]:
        episode = self.get_by_id(episode_id)
        if episode:
            episode.logline = logline
            episode.continuity_notes = continuity_notes
            episode.scene_count = scene_count
            episode.duration_estimate_seconds = duration_estimate_seconds
            self.db.commit()
            self.db.refresh(episode)
        return episode
