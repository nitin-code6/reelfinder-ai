from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.database import get_db
from app.core.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint verifying API, Database, and AI provider connectivity."""
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    groq_keys = settings.get_groq_api_keys()
    gemini_keys = settings.get_gemini_api_keys()

    ai_providers = {
        "groq_configured": len(groq_keys) > 0,
        "groq_keys_count": len(groq_keys),
        "gemini_configured": len(gemini_keys) > 0,
        "gemini_keys_count": len(gemini_keys),
        "use_mock_llm": settings.USE_MOCK_LLM,
    }

    if not groq_keys and not gemini_keys and not settings.USE_MOCK_LLM:
        ai_status = "no_keys"
        ai_message = "No AI API keys configured. Using deterministic heuristic engine."
    else:
        ai_status = "active"
        ai_message = f"AI Online ({len(groq_keys)} Groq key(s), {len(gemini_keys)} Gemini key(s))"

    return {
        "status": "ok" if db_status == "healthy" else "degraded",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "database": db_status,
        "environment": settings.ENVIRONMENT,
        "ai": {
            "status": ai_status,
            "message": ai_message,
            "providers": ai_providers
        }
    }
