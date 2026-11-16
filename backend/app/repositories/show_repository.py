from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.show import Show
from app.schemas.show import ShowCreate


class ShowRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, show_id: int) -> Optional[Show]:
        return self.db.query(Show).filter(Show.id == show_id).first()

    def get_by_title(self, title: str) -> Optional[Show]:
        return self.db.query(Show).filter(Show.title == title).first()

    def list_all(self, skip: int = 0, limit: int = 100) -> List[Show]:
        return self.db.query(Show).offset(skip).limit(limit).all()

    def create(self, show_in: ShowCreate) -> Show:
        show = Show(
            title=show_in.title,
            language=show_in.language,
            description=show_in.description
        )
        self.db.add(show)
        self.db.commit()
        self.db.refresh(show)
        return show

    def delete(self, show_id: int) -> bool:
        show = self.get_by_id(show_id)
        if show:
            self.db.delete(show)
            self.db.commit()
            return True
        return False
