import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.database import Base
from app.models.show import Show
from app.models.episode import Episode, ProcessingStatus
from app.models.promo import Promo, PromoSegment
from app.models.feedback import EditorFeedback


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_create_show_and_episodes(db_session):
    show = Show(title="Test Broken Soldier", language="English", description="Drama series")
    db_session.add(show)
    db_session.commit()
    assert show.id is not None

    ep = Episode(
        show_id=show.id,
        episode_number=1,
        original_filename="episode_001.txt",
        file_path="/tmp/ep1.txt",
        logline="Juliana arrives at cathedral",
        scene_count=3,
        processing_status=ProcessingStatus.PENDING.value
    )
    db_session.add(ep)
    db_session.commit()

    assert ep.id is not None
    assert ep.show.title == "Test Broken Soldier"
    assert len(show.episodes) == 1


def test_create_promo_with_segments_and_feedback(db_session):
    show = Show(title="Promo Series")
    db_session.add(show)
    db_session.commit()

    promo = Promo(
        show_id=show.id,
        promo_identifier="PROMO_001",
        primary_episode_number=1,
        hook="Gerald abandons Juliana at altar",
        cliffhanger="Juliana asks who is in the carriage",
        standalone_context="Clear betrothed betrayal arc",
        reason="High immediate shock value",
        total_duration_seconds=38.5,
        hook_score=9.0,
        cliffhanger_score=9.5,
        standalone_score=8.5,
        emotional_impact_score=9.0,
        continuity_score=9.0,
        overall_score=89.5,
        validation_status="valid",
        approval_status="pending"
    )
    db_session.add(promo)
    db_session.flush()

    segment = PromoSegment(
        promo_id=promo.id,
        episode_number=1,
        start_timestamp="00:11.30",
        end_timestamp="00:49.80",
        duration_seconds=38.5,
        segment_order=1
    )
    db_session.add(segment)
    db_session.commit()

    assert promo.id is not None
    assert len(promo.segments) == 1
    assert promo.segments[0].start_timestamp == "00:11.30"

    # Add feedback
    feedback = EditorFeedback(
        promo_id=promo.id,
        decision="approved",
        comments="Excellent opening hook for TikTok ad"
    )
    db_session.add(feedback)
    promo.approval_status = "approved"
    db_session.commit()

    assert len(promo.feedbacks) == 1
    assert promo.approval_status == "approved"
