import os
import re
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.repositories.show_repository import ShowRepository
from app.repositories.episode_repository import EpisodeRepository
from app.schemas.episode import EpisodeRead, EpisodeCreate
from app.services.file_service import file_service
from app.core.logging import logger

router = APIRouter(prefix="/episodes", tags=["Episodes"])


def extract_episode_number(filename: str) -> int:
    """Extracts integer episode number from various naming conventions (e.g., episode-001, ep_05, 1671703)."""
    match = re.search(r"episode[-_\s]*0*(\d+)", filename, re.IGNORECASE)
    if match:
        return int(match.group(1))
    
    match_ep = re.search(r"\bep[-_\s]*0*(\d+)", filename, re.IGNORECASE)
    if match_ep:
        return int(match_ep.group(1))
        
    digits = re.findall(r"\d+", filename)
    if digits:
        return int(digits[0])
    return 1


@router.post("/upload", response_model=List[EpisodeRead], status_code=status.HTTP_201_CREATED)
async def upload_episodes(
    show_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Uploads single TXT/PDF or a ZIP archive containing multiple screenplay files."""
    show_repo = ShowRepository(db)
    ep_repo = EpisodeRepository(db)
    
    show = show_repo.get_by_id(show_id)
    if not show:
        raise HTTPException(status_code=404, detail="Target show does not exist.")

    saved_path, sha256 = file_service.save_upload(file)
    created_episodes = []

    if saved_path.suffix.lower() == ".zip":
        extract_dir = file_service.upload_dir / f"show_{show_id}_{sha256[:8]}"
        extracted_files = file_service.extract_zip(saved_path, extract_dir)
        
        for ep_file in extracted_files:
            ep_num = extract_episode_number(ep_file.name)
            
            # Check if episode already exists for this show
            existing = ep_repo.get_by_show_and_number(show_id, ep_num)
            if existing:
                # Update existing record
                existing.file_path = str(ep_file)
                existing.original_filename = ep_file.name
                db.commit()
                db.refresh(existing)
                created_episodes.append(existing)
            else:
                new_ep = ep_repo.create(EpisodeCreate(
                    show_id=show_id,
                    episode_number=ep_num,
                    original_filename=ep_file.name,
                    file_path=str(ep_file)
                ))
                created_episodes.append(new_ep)
    else:
        ep_num = extract_episode_number(saved_path.name)
        existing = ep_repo.get_by_show_and_number(show_id, ep_num)
        if existing:
            existing.file_path = str(saved_path)
            existing.original_filename = saved_path.name
            db.commit()
            db.refresh(existing)
            created_episodes.append(existing)
        else:
            new_ep = ep_repo.create(EpisodeCreate(
                show_id=show_id,
                episode_number=ep_num,
                original_filename=saved_path.name,
                file_path=str(saved_path)
            ))
            created_episodes.append(new_ep)

    return created_episodes


@router.get("/", response_model=List[EpisodeRead])
def list_episodes(
    show_id: int,
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db)
):
    repo = EpisodeRepository(db)
    return repo.list_by_show(show_id=show_id, skip=skip, limit=limit)


@router.get("/{episode_id}", response_model=EpisodeRead)
def get_episode(episode_id: int, db: Session = Depends(get_db)):
    repo = EpisodeRepository(db)
    ep = repo.get_by_id(episode_id)
    if not ep:
        raise HTTPException(status_code=404, detail="Episode not found")
    return ep
