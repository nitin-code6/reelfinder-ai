from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.repositories.show_repository import ShowRepository
from app.repositories.episode_repository import EpisodeRepository
from app.repositories.promo_repository import PromoRepository
from app.schemas.show import ShowCreate, ShowRead

router = APIRouter(prefix="/shows", tags=["Shows"])


@router.post("/", response_model=ShowRead, status_code=status.HTTP_201_CREATED)
def create_show(show_in: ShowCreate, db: Session = Depends(get_db)):
    repo = ShowRepository(db)
    existing = repo.get_by_title(show_in.title)
    if existing:
        return existing
    return repo.create(show_in)


@router.get("/", response_model=List[ShowRead])
def list_shows(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    repo = ShowRepository(db)
    ep_repo = EpisodeRepository(db)
    promo_repo = PromoRepository(db)
    
    shows = repo.list_all(skip=skip, limit=limit)
    result = []
    for s in shows:
        ep_count = len(ep_repo.list_by_show(s.id))
        promo_count = len(promo_repo.list_promos(show_id=s.id))
        show_read = ShowRead(
            id=s.id,
            title=s.title,
            language=s.language,
            description=s.description,
            created_at=s.created_at,
            episode_count=ep_count,
            promo_count=promo_count
        )
        result.append(show_read)
    return result


@router.get("/{show_id}", response_model=ShowRead)
def get_show(show_id: int, db: Session = Depends(get_db)):
    repo = ShowRepository(db)
    ep_repo = EpisodeRepository(db)
    promo_repo = PromoRepository(db)
    
    show = repo.get_by_id(show_id)
    if not show:
        raise HTTPException(status_code=404, detail="Show not found")
        
    ep_count = len(ep_repo.list_by_show(show.id))
    promo_count = len(promo_repo.list_promos(show_id=show.id))
    return ShowRead(
        id=show.id,
        title=show.title,
        language=show.language,
        description=show.description,
        created_at=show.created_at,
        episode_count=ep_count,
        promo_count=promo_count
    )


@router.delete("/{show_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_show(show_id: int, db: Session = Depends(get_db)):
    repo = ShowRepository(db)
    success = repo.delete(show_id)
    if not success:
        raise HTTPException(status_code=404, detail="Show not found")
