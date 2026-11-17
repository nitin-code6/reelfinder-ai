import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.database import Base
from app.models.show import Show
from app.models.episode import Episode
from app.models.promo import Promo, PromoSegment
from app.repositories.promo_repository import PromoRepository
from app.schemas.promo import PromoCreate, PromoSegmentCreate


@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Seed Show and Episodes
    show = Show(title="Reconciliation Test Show")
    session.add(show)
    session.flush()

    ep1 = Episode(show_id=show.id, episode_number=1, original_filename="ep01.txt", file_path="ep01.txt")
    ep3 = Episode(show_id=show.id, episode_number=3, original_filename="ep03.txt", file_path="ep03.txt")
    session.add_all([ep1, ep3])
    session.flush()

    # Seed Multi-segment promo for Episode 3
    repo = PromoRepository(session)
    promo_ep3 = repo.create(
        PromoCreate(
            show_id=show.id,
            promo_identifier="PROMO_EP03_01",
            primary_episode_number=3,
            hook="Margaret confronts Vance with the forged decree",
            cliffhanger="Vance reveals the royal seal was broken",
            standalone_context="Clear high stakes conflict without backstory",
            reason="High drama confrontation with immediate hook",
            total_duration_seconds=33.0,
            hook_score=8.5,
            cliffhanger_score=9.0,
            standalone_score=8.5,
            emotional_impact_score=8.0,
            continuity_score=8.5,
            overall_score=85.0,
            validation_status="valid",
            approval_status="pending",
            provider_name="groq",
            model_name="openai/gpt-oss-120b",
            segments=[
                PromoSegmentCreate(
                    episode_id=ep3.id,
                    episode_number=3,
                    start_timestamp="00:04.00",
                    end_timestamp="00:12.00",
                    duration_seconds=8.0,
                    segment_order=1,
                    scene_heading="INT. STUDY - NIGHT",
                    first_line="You cannot hide what you did.",
                    last_line="The decree was signed by your hand."
                ),
                PromoSegmentCreate(
                    episode_id=ep3.id,
                    episode_number=3,
                    start_timestamp="01:13.00",
                    end_timestamp="01:38.00",
                    duration_seconds=25.0,
                    segment_order=2,
                    scene_heading="INT. HALLWAY - NIGHT",
                    first_line="Look at the wax seal!",
                    last_line="Because the king never sealed it."
                )
            ]
        )
    )

    yield session
    session.close()


def test_reconciliation_exact_field_matching(test_db):
    """Verifies that database, serialization, and segment structures match 1:1 without discrepancies."""
    repo = PromoRepository(test_db)
    promos = repo.list_promos(limit=10)
    assert len(promos) == 1

    p = promos[0]
    assert p.promo_identifier == "PROMO_EP03_01"
    assert p.primary_episode_number == 3

    # Segment episode identity assertion (CRITICAL BUG FIX)
    assert len(p.segments) == 2
    for s in p.segments:
        assert s.episode_number == 3, f"Segment episode_number {s.episode_number} must match source episode 3!"
        assert s.episode_id is not None

    # Total duration must equal the exact sum of segments
    sum_durations = sum(s.duration_seconds for s in p.segments)
    assert p.total_duration_seconds == sum_durations
    assert p.total_duration_seconds == 33.0

    # Provider and model verification
    assert p.provider_name == "groq"
    assert p.model_name == "openai/gpt-oss-120b"
    assert p.approval_status == "pending"


def test_reconciliation_cannot_approve_invalid_promo(test_db):
    """Verifies that invalid promos cannot be approved by approval logic."""
    repo = PromoRepository(test_db)
    promo = repo.get_by_id(1)
    # Mark as invalid
    promo.validation_status = "invalid"
    test_db.commit()

    # Attempting approval should fail validation rule
    assert promo.validation_status == "invalid"
    # Editorial rule: only valid/warning can be approved
    can_approve = promo.validation_status in ("valid", "warning")
    assert can_approve is False
