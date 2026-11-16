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
from app.schemas.promo import PromoRead
from app.services.file_service import file_service
from app.services.candidate_detector import candidate_detector
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


@router.post("/{episode_id}/process", response_model=List[PromoRead])
def process_single_episode(episode_id: int, db: Session = Depends(get_db)):
    """Triggers end-to-end AI discovery, validation, and scoring for a single episode."""
    try:
        promos = candidate_detector.process_episode(episode_id, db)
        return promos
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{episode_id}/status")
def get_episode_status(episode_id: int, db: Session = Depends(get_db)):
    """Retrieves current processing pipeline status."""
    repo = EpisodeRepository(db)
    ep = repo.get_by_id(episode_id)
    if not ep:
        raise HTTPException(status_code=404, detail="Episode not found")
    return {
        "episode_id": ep.id,
        "episode_number": ep.episode_number,
        "status": ep.processing_status,
        "error_message": ep.error_message
    }


@router.get("/{episode_id}/inspection")
def inspect_episode(episode_id: int, db: Session = Depends(get_db)):
    """Retrieves deep parsed screenplay inspection data, cue sheet breakdown, and AI model metadata."""
    from app.repositories.promo_repository import PromoRepository
    from app.core.config import settings

    repo = EpisodeRepository(db)
    ep = repo.get_by_id(episode_id)
    if not ep:
        raise HTTPException(status_code=404, detail="Episode not found")
        
    file_path = Path(ep.file_path)
    raw_content = ""
    scenes_data = []
    cues_data = []
    parsing_warnings = []
    
    if file_path.exists():
        try:
            if file_path.suffix.lower() == ".txt":
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    raw_content = f.read()
                sp = candidate_detector.txt_parser.parse_text(raw_content)
            elif file_path.suffix.lower() == ".pdf":
                sp = candidate_detector.pdf_parser.parse_file(file_path)
                raw_content = f"[PDF Document: {file_path.name}]"
            else:
                sp = None
                
            if sp:
                for sc in sp.scenes:
                    scenes_data.append({
                        "scene_number": sc.scene_number,
                        "heading": sc.heading,
                        "start_timestamp": sc.start_timestamp,
                        "end_timestamp": sc.end_timestamp,
                        "lines_count": len(sc.lines)
                    })
                    for line in sc.lines:
                        cues_data.append({
                            "speaker": line.speaker,
                            "line_type": line.line_type,
                            "start_timestamp": line.start_timestamp,
                            "end_timestamp": line.end_timestamp,
                            "start_seconds": line.start_seconds,
                            "end_seconds": line.end_seconds,
                            "text": line.text
                        })
        except Exception as e:
            parsing_warnings.append(f"Parsing notice: {str(e)}")
    else:
        parsing_warnings.append(f"Original file not found on disk: {file_path}")

    # Promo summary for this episode
    promo_repo = PromoRepository(db)
    promos = promo_repo.list_promos(show_id=ep.show_id, episode_number=ep.episode_number)
    
    # AI provider configuration
    ai_info = {
        "provider": "HybridLLMProvider (Groq primary -> Gemini secondary)",
        "groq_model": settings.GROQ_MODEL,
        "gemini_model": settings.GEMINI_MODEL,
        "mock_active": settings.USE_MOCK_LLM
    }

    return {
        "episode_id": ep.id,
        "show_id": ep.show_id,
        "episode_number": ep.episode_number,
        "filename": ep.original_filename,
        "processing_status": ep.processing_status,
        "error_message": ep.error_message,
        "scene_count": ep.scene_count or len(scenes_data),
        "duration_seconds": ep.duration_estimate_seconds,
        "total_cues": len(cues_data),
        "scenes": scenes_data,
        "cues": cues_data[:100],
        "raw_excerpt": raw_content[:4000],
        "warnings": parsing_warnings,
        "promos_count": len(promos),
        "ai_info": ai_info
    }

