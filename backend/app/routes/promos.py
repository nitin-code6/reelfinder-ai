from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.repositories.promo_repository import PromoRepository
from app.schemas.promo import PromoRead, PromoCreate
from app.schemas.feedback import EditorFeedbackCreate, EditorFeedbackRead

router = APIRouter(prefix="/promos", tags=["Promos"])


@router.get("/", response_model=List[PromoRead])
def list_promos(
    show_id: Optional[int] = Query(None, description="Filter by show ID"),
    episode_number: Optional[int] = Query(None, description="Filter by episode number"),
    approval_status: Optional[str] = Query(None, description="Filter by status (pending, approved, rejected)"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Retrieves ranked promotional clips, sorted by overall composite score descending."""
    repo = PromoRepository(db)
    return repo.list_promos(
        show_id=show_id,
        episode_number=episode_number,
        approval_status=approval_status,
        skip=skip,
        limit=limit
    )


@router.get("/{promo_id}", response_model=PromoRead)
def get_promo(promo_id: int, db: Session = Depends(get_db)):
    repo = PromoRepository(db)
    promo = repo.get_by_id(promo_id)
    if not promo:
        raise HTTPException(status_code=404, detail="Promo not found")
    return promo


@router.post("/{promo_id}/approve", response_model=PromoRead)
def approve_promo(promo_id: int, db: Session = Depends(get_db)):
    """Human-in-the-loop: editor approves recommendation."""
    repo = PromoRepository(db)
    promo = repo.update_approval(promo_id, "approved")
    if not promo:
        raise HTTPException(status_code=404, detail="Promo not found")
    return promo


@router.post("/{promo_id}/reject", response_model=PromoRead)
def reject_promo(promo_id: int, db: Session = Depends(get_db)):
    """Human-in-the-loop: editor rejects recommendation."""
    repo = PromoRepository(db)
    promo = repo.update_approval(promo_id, "rejected")
    if not promo:
        raise HTTPException(status_code=404, detail="Promo not found")
    return promo


@router.post("/{promo_id}/feedback", response_model=EditorFeedbackRead, status_code=status.HTTP_201_CREATED)
def submit_feedback(
    promo_id: int,
    feedback_in: EditorFeedbackCreate,
    db: Session = Depends(get_db)
):
    """Submits editor decision and comments."""
    repo = PromoRepository(db)
    promo = repo.get_by_id(promo_id)
    if not promo:
        raise HTTPException(status_code=404, detail="Promo not found")
    return repo.add_feedback(promo_id, feedback_in)
