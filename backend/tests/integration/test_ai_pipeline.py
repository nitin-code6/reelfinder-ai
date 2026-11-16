from pathlib import Path
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.database import Base
from app.models.show import Show
from app.models.episode import Episode, ProcessingStatus
from app.services.candidate_detector import CandidateDetector
from app.llm.mock_provider import MockLLMProvider
from app.repositories.promo_repository import PromoRepository

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"


@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_ai_pipeline_end_to_end(test_db):
    # 1. Create show and episode
    show = Show(title="Mock Microdrama Show", language="English")
    test_db.add(show)
    test_db.commit()

    sample_file = FIXTURES_DIR / "sample_screenplay.txt"
    ep = Episode(
        show_id=show.id,
        episode_number=1,
        original_filename="sample_screenplay.txt",
        file_path=str(sample_file),
        processing_status=ProcessingStatus.PENDING.value
    )
    test_db.add(ep)
    test_db.commit()

    # 2. Run CandidateDetector with MockLLMProvider
    detector = CandidateDetector(llm_provider=MockLLMProvider())
    promos = detector.process_episode(ep.id, test_db)

    # 3. Assertions
    assert len(promos) >= 1
    test_db.refresh(ep)
    assert ep.processing_status == ProcessingStatus.COMPLETED.value
    assert ep.scene_count >= 1
    assert ep.duration_estimate_seconds > 0

    first_promo = promos[0]
    assert first_promo.primary_episode_number == 1
    assert first_promo.overall_score > 0
    assert len(first_promo.segments) >= 1

    seg = first_promo.segments[0]
    assert 20.0 <= seg.duration_seconds <= 60.0
    assert seg.start_timestamp is not None
    assert seg.end_timestamp is not None
    assert seg.first_line is not None

    # 4. Human-in-the-loop review
    promo_repo = PromoRepository(test_db)
    approved = promo_repo.update_approval(first_promo.id, "approved")
    assert approved.approval_status == "approved"
