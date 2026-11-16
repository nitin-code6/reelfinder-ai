import io
import csv
import json
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.repositories.promo_repository import PromoRepository

router = APIRouter(prefix="/export", tags=["Export"])


@router.get("/csv")
def export_promos_csv(
    show_id: Optional[int] = Query(None),
    status: Optional[str] = Query("approved", description="Filter by approval status, default 'approved'"),
    db: Session = Depends(get_db)
):
    """Exports promotional candidates to a standard CSV for content editors and marketing teams."""
    repo = PromoRepository(db)
    promos = repo.list_promos(show_id=show_id, approval_status=status if status != "all" else None, limit=1000)

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

    for p in promos:
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

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=kuku_promos_export.csv"}
    )


@router.get("/json")
def export_promos_json(
    show_id: Optional[int] = Query(None),
    status: Optional[str] = Query("approved"),
    db: Session = Depends(get_db)
):
    """Exports promotional candidates in structured JSON format conforming to the assignment schema."""
    repo = PromoRepository(db)
    promos = repo.list_promos(show_id=show_id, approval_status=status if status != "all" else None, limit=1000)

    results = []
    for p in promos:
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

    json_str = json.dumps(results, indent=2)
    return Response(
        content=json_str,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=kuku_promos_export.json"}
    )
