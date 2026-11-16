import io
import csv
import json
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.repositories.promo_repository import PromoRepository

router = APIRouter(prefix="/export", tags=["Export"])


@router.get("/csv")
def export_promos_csv(
    show_id: Optional[int] = Query(None),
    status: Optional[str] = Query("all", description="Filter by approval status: 'all', 'pending', 'approved', 'rejected'"),
    db: Session = Depends(get_db)
):
    """
    Exports correctly validated promotional candidates to CSV.
    Strictly excludes invalid candidates (reported separately).
    """
    repo = PromoRepository(db)
    # Filter for valid and warning candidates only
    all_promos = repo.list_promos(show_id=show_id, approval_status=status if status != "all" else None, limit=2000)
    valid_promos = [p for p in all_promos if p.validation_status in ("valid", "warning")]

    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "Promo Identifier",
        "Episode Number",
        "Segment Timestamps (Start - End)",
        "Total Duration (s)",
        "Overall Score",
        "Hook Strength",
        "Cliffhanger Strength",
        "Standalone Context Score",
        "Emotional Impact Score",
        "Continuity Score",
        "Opening Hook",
        "Ending Cliffhanger",
        "Why It Works",
        "Approval Status",
        "Validation Status"
    ])

    for p in valid_promos:
        segment_strs = "; ".join([f"Ep {s.episode_number}: {s.start_timestamp} - {s.end_timestamp}" for s in p.segments])
        writer.writerow([
            p.promo_identifier,
            p.primary_episode_number,
            segment_strs,
            f"{p.total_duration_seconds:.2f}",
            f"{p.overall_score:.1f}",
            p.hook_score,
            p.cliffhanger_score,
            p.standalone_score,
            p.emotional_impact_score,
            p.continuity_score,
            p.hook,
            p.cliffhanger,
            p.reason,
            p.approval_status,
            p.validation_status
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=kuku_validated_promos.csv"}
    )


@router.get("/json")
def export_promos_json(
    show_id: Optional[int] = Query(None),
    status: Optional[str] = Query("all"),
    db: Session = Depends(get_db)
):
    """
    Exports correctly validated promotional candidates in structured JSON.
    Strictly excludes invalid candidates.
    """
    repo = PromoRepository(db)
    all_promos = repo.list_promos(show_id=show_id, approval_status=status if status != "all" else None, limit=2000)
    valid_promos = [p for p in all_promos if p.validation_status in ("valid", "warning")]

    results = []
    for p in valid_promos:
        results.append({
            "promo_id": p.promo_identifier,
            "episode_numbers": [p.primary_episode_number] if not p.segments else list(set(s.episode_number for s in p.segments)),
            "segments": [
                {
                    "episode": s.episode_number,
                    "start_timestamp": s.start_timestamp,
                    "end_timestamp": s.end_timestamp,
                    "duration_seconds": s.duration_seconds
                }
                for s in p.segments
            ],
            "total_duration_seconds": p.total_duration_seconds,
            "hook": p.hook,
            "cliffhanger": p.cliffhanger,
            "standalone_context": p.standalone_context,
            "scores": {
                "hook_strength": p.hook_score,
                "cliffhanger_strength": p.cliffhanger_score,
                "standalone_context": p.standalone_score,
                "emotional_impact": p.emotional_impact_score,
                "narrative_continuity": p.continuity_score
            },
            "overall_score": p.overall_score,
            "reason": p.reason,
            "validation_status": p.validation_status,
            "limitations": p.limitations,
            "approval_status": p.approval_status
        })

    return Response(
        content=json.dumps(results, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=kuku_validated_promos.json"}
    )


@router.get("/invalid/csv")
def export_invalid_promos_csv(
    show_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Exports rejected / invalid promotional candidates with detailed failure reasons."""
    repo = PromoRepository(db)
    all_promos = repo.list_promos(show_id=show_id, limit=2000)
    invalid_promos = [p for p in all_promos if p.validation_status == "invalid"]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Promo Identifier",
        "Episode Number",
        "Start Timestamp",
        "End Timestamp",
        "Total Duration (s)",
        "Overall Score",
        "Validation Status",
        "Rejection Reasons / Limitations"
    ])

    for p in invalid_promos:
        start_ts = p.segments[0].start_timestamp if p.segments else "N/A"
        end_ts = p.segments[0].end_timestamp if p.segments else "N/A"
        reasons = "; ".join(p.limitations) if p.limitations else "Failed validation boundaries"
        writer.writerow([
            p.promo_identifier,
            p.primary_episode_number,
            start_ts,
            end_ts,
            f"{p.total_duration_seconds:.2f}",
            f"{p.overall_score:.1f}",
            p.validation_status,
            reasons
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=kuku_rejected_candidates.csv"}
    )


@router.get("/invalid/json")
def export_invalid_promos_json(
    show_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Exports rejected / invalid promotional candidates in structured JSON with limitations."""
    repo = PromoRepository(db)
    all_promos = repo.list_promos(show_id=show_id, limit=2000)
    invalid_promos = [p for p in all_promos if p.validation_status == "invalid"]

    results = []
    for p in invalid_promos:
        results.append({
            "promo_id": p.promo_identifier,
            "primary_episode_number": p.primary_episode_number,
            "total_duration_seconds": p.total_duration_seconds,
            "validation_status": p.validation_status,
            "rejection_reasons": p.limitations,
            "hook": p.hook,
            "cliffhanger": p.cliffhanger
        })

    return Response(
        content=json.dumps(results, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=kuku_rejected_candidates.json"}
    )
