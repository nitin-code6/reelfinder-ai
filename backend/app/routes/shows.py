from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.repositories.show_repository import ShowRepository
from app.repositories.episode_repository import EpisodeRepository
from app.repositories.promo_repository import PromoRepository
from app.schemas.show import ShowCreate, ShowRead
from app.services.candidate_detector import candidate_detector
from app.core.logging import logger

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


@router.post("/{show_id}/clear")
def clear_show_data(show_id: int, db: Session = Depends(get_db)):
    """Clears all episodes, segments, and promos for a show without deleting the show itself."""
    from app.models.promo import Promo
    from app.models.episode import Episode
    show_repo = ShowRepository(db)
    show = show_repo.get_by_id(show_id)
    if not show:
        raise HTTPException(status_code=404, detail="Show not found")
    
    promos_deleted = db.query(Promo).filter(Promo.show_id == show_id).delete(synchronize_session=False)
    episodes_deleted = db.query(Episode).filter(Episode.show_id == show_id).delete(synchronize_session=False)
    db.commit()
    logger.info(f"Cleared show {show_id}: {episodes_deleted} episodes, {promos_deleted} promos removed.")
    return {"message": f"Cleared {episodes_deleted} episodes and {promos_deleted} promos for '{show.title}'."}


@router.post("/reset-all-data")
def reset_all_data(db: Session = Depends(get_db)):
    """Wipes all shows, episodes, promos, and feedback for a fresh start."""
    from app.models.show import Show
    from app.models.promo import Promo
    from app.models.episode import Episode
    
    promos_deleted = db.query(Promo).delete(synchronize_session=False)
    episodes_deleted = db.query(Episode).delete(synchronize_session=False)
    shows_deleted = db.query(Show).delete(synchronize_session=False)
    db.commit()
    logger.info("Database reset: all shows, episodes, and promos deleted.")
    return {
        "message": "All data has been successfully cleared.",
        "shows_deleted": shows_deleted,
        "episodes_deleted": episodes_deleted,
        "promos_deleted": promos_deleted
    }


@router.post("/{show_id}/process-all")
def process_all_episodes(show_id: int, db: Session = Depends(get_db)):
    """Triggers batch processing across all episodes in the show."""
    show_repo = ShowRepository(db)
    ep_repo = EpisodeRepository(db)
    show = show_repo.get_by_id(show_id)
    if not show:
        raise HTTPException(status_code=404, detail="Show not found")

    episodes = ep_repo.list_by_show(show_id)
    if not episodes:
        raise HTTPException(status_code=400, detail="No episodes uploaded for this show.")

    results = []
    for ep in episodes:
        try:
            promos = candidate_detector.process_episode(ep.id, db)
            results.append({"episode_number": ep.episode_number, "status": "completed", "promos_found": len(promos)})
        except Exception as e:
            results.append({"episode_number": ep.episode_number, "status": "failed", "error": str(e)})

    return {"show_id": show_id, "total_processed": len(results), "details": results}

