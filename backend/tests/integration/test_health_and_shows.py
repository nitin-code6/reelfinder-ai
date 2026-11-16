import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.db.database import Base
from app.routes.health import health_check
from app.routes.shows import create_show, get_show, list_shows
from app.schemas.show import ShowCreate


@pytest.fixture
def db_session():
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    yield session
    session.close()


def test_health_check(db_session):
    data = health_check(db=db_session)
    assert data["status"] == "ok"
    assert data["database"] == "healthy"


def test_shows_crud_flow(db_session):
    # 1. Create show
    payload = ShowCreate(
        title="Integration Test Microdrama",
        language="English",
        description="Test series description"
    )
    created_show = create_show(show_in=payload, db=db_session)
    assert created_show.title == payload.title
    show_id = created_show.id

    # 2. Get show
    retrieved_show = get_show(show_id=show_id, db=db_session)
    assert retrieved_show.id == show_id
    assert retrieved_show.title == payload.title

    # 3. List shows
    all_shows = list_shows(skip=0, limit=100, db=db_session)
    assert any(s.id == show_id for s in all_shows)
