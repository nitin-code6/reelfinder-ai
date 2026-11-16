from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import logger
from app.db.database import engine, Base
import app.models  # Ensure all models are registered

# Import routers
from app.routes.health import router as health_router
from app.routes.shows import router as shows_router
from app.routes.episodes import router as episodes_router
from app.routes.promos import router as promos_router
from app.routes.export import router as export_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Automated Promo Discovery Engine for Microdramas — Kuku AI Generalist Assignment (Problem 1)"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
api_prefix = settings.API_V1_STR
app.include_router(health_router, prefix=api_prefix)
app.include_router(shows_router, prefix=api_prefix)
app.include_router(episodes_router, prefix=api_prefix)
app.include_router(promos_router, prefix=api_prefix)
app.include_router(export_router, prefix=api_prefix)

# Also mount at /api for frontend proxy convenience
app.include_router(health_router)
app.include_router(health_router, prefix="/api")
app.include_router(shows_router, prefix="/api")
app.include_router(episodes_router, prefix="/api")
app.include_router(promos_router, prefix="/api")
app.include_router(export_router, prefix="/api")


@app.on_event("startup")
def startup_event():
    import os
    if os.environ.get("TESTING") == "1":
        logger.info("TESTING mode active: skipping startup PostgreSQL table creation.")
        return
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.warning(f"Database table auto-creation skipped: {e}")
    logger.info(f"{settings.PROJECT_NAME} v{settings.VERSION} started in {settings.ENVIRONMENT} mode.")


@app.get("/")
def root():
    return {
        "message": "Welcome to ReelFinder AI API",
        "docs_url": "/docs",
        "health_check": f"{api_prefix}/health",
        "version": settings.VERSION
    }
