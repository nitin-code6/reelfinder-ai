"""
Regression tests for episode mapping correctness.

Ensures that:
  1. Multi-segment candidates created for Episode N always have
     episode_number == N in every PromoSegmentCreate — never 1 or any other default.
  2. The candidate_detector uses episode.episode_number (not seg.episode_number)
     when building PromoSegmentCreate for single-episode screenplays.
  3. Segments do not inherit a wrong episode_number from a previous LLM call.

Covers the PROMO_EP03_01 / PROMO_EP04_02 regression (segments stored with
episode_number=1 instead of 3/4 when the AI-proposed seg.episode_number was
either missing or defaulted incorrectly by a previous version of the code).
"""
import pytest
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base
from app.models.show import Show
from app.models.episode import Episode, ProcessingStatus
from app.models.promo import Promo
from app.services.candidate_detector import CandidateDetector
from app.llm.mock_provider import MockLLMProvider
from app.llm.schema import (
    AIPromoDiscoveryResponse,
    AIPromoCandidate,
    AIPromoSegmentCandidate,
)


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def _make_episode(db, ep_number: int, file_path: str, show_id: int = 1) -> Episode:
    ep = Episode(
        show_id=show_id,
        episode_number=ep_number,
        original_filename=f"episode_{ep_number:02d}.txt",
        file_path=file_path,
        processing_status=ProcessingStatus.PENDING.value,
    )
    db.add(ep)
    db.commit()
    db.refresh(ep)
    return ep


EPISODE_3_SCRIPT = """\
EPISODE NUMBER: Episode 3
EPISODE LOGLINE: A soaked stranger asks for Mira by her childhood nickname.
SCENE 01
Scene heading: INT. SEASIDE HOTEL - MAIN HALL - DAY
Scene start: 00:00.00
Scene end: 02:00.00
**WOMAN (Drenched):**
Start: (00:04.00) | End: (00:12.00)
"Tell Mira her mother never left this town."
**DEV (Commanding):**
Start: (00:12.00) | End: (00:23.00)
"Security, remove her immediately."
**WOMAN (Desperate):**
Start: (00:23.00) | End: (00:43.00)
"She has to know the truth about her inheritance!"
**DEV (Furious):**
Start: (00:43.00) | End: (01:01.00)
"This conversation is over. Get out!"
**WOMAN (Tearful):**
Start: (01:01.00) | End: (01:13.00)
"You are hiding her from her own family."
**MAN (Cold):**
Start: (01:13.00) | End: (01:38.00)
"Leave before I have you arrested."
"""

EPISODE_4_SCRIPT = """\
EPISODE NUMBER: Episode 4
EPISODE LOGLINE: Dev confronts the board about the missing contracts.
SCENE 01
Scene heading: INT. BOARD ROOM - DAY
Scene start: 00:00.00
Scene end: 02:10.00
**DEV (Terse):**
Start: (00:04.00) | End: (00:15.00)
"Where are the contracts that were on my desk?"
**BOARD MEMBER (Nervous):**
Start: (00:15.00) | End: (00:35.00)
"We don't know. The safe was opened without authorization."
**DEV (Cold):**
Start: (00:35.00) | End: (01:01.00)
"Someone in this room is betraying the company."
**BOARD MEMBER 2 (Accusatory):**
Start: (01:01.00) | End: (01:13.00)
"Look at your own family before pointing fingers."
**DEV (Stunned):**
Start: (01:13.00) | End: (01:26.00)
"What are you implying?"
**BOARD MEMBER (Rising):**
Start: (01:26.00) | End: (01:38.00)
"Your brother signed those documents."
"""


def _write_tmp_script(tmp_path, name: str, content: str) -> str:
    p = tmp_path / name
    p.write_text(content, encoding="utf-8")
    return str(p)


def test_episode_3_segments_have_correct_episode_number(db_session, tmp_path):
    """
    PROMO_EP03_01 regression: segments must carry episode_number=3, not 1.
    """
    show = Show(title="Test Show")
    db_session.add(show)
    db_session.commit()
    db_session.refresh(show)

    file_path = _write_tmp_script(tmp_path, "episode_03.txt", EPISODE_3_SCRIPT)
    ep = _make_episode(db_session, ep_number=3, file_path=file_path, show_id=show.id)

    detector = CandidateDetector(llm_provider=MockLLMProvider())
    promos = detector.process_episode(ep.id, db_session)

    # At least one promo must have been created
    assert promos, "No promos created for episode 3 — cannot verify episode mapping"

    for promo in promos:
        assert promo.primary_episode_number == 3, (
            f"{promo.promo_identifier}: primary_episode_number should be 3, got {promo.primary_episode_number}"
        )
        for seg in promo.segments:
            assert seg.episode_number == 3, (
                f"{promo.promo_identifier} segment {seg.segment_order}: "
                f"episode_number should be 3, got {seg.episode_number} "
                f"(PROMO_EP03_01 regression)"
            )
            assert seg.episode_id == ep.id, (
                f"Segment episode_id {seg.episode_id} != episode pk {ep.id}"
            )


def test_episode_4_segments_have_correct_episode_number(db_session, tmp_path):
    """
    PROMO_EP04_02 regression: segments must carry episode_number=4, not 1.
    """
    show = Show(title="Test Show 4")
    db_session.add(show)
    db_session.commit()
    db_session.refresh(show)

    file_path = _write_tmp_script(tmp_path, "episode_04.txt", EPISODE_4_SCRIPT)
    ep = _make_episode(db_session, ep_number=4, file_path=file_path, show_id=show.id)

    detector = CandidateDetector(llm_provider=MockLLMProvider())
    promos = detector.process_episode(ep.id, db_session)

    assert promos, "No promos created for episode 4 — cannot verify episode mapping"

    for promo in promos:
        assert promo.primary_episode_number == 4, (
            f"{promo.promo_identifier}: primary_episode_number should be 4, got {promo.primary_episode_number}"
        )
        for seg in promo.segments:
            assert seg.episode_number == 4, (
                f"{promo.promo_identifier} segment {seg.segment_order}: "
                f"episode_number should be 4, got {seg.episode_number} "
                f"(PROMO_EP04_02 regression)"
            )


def test_ai_proposed_wrong_episode_number_is_overridden(db_session, tmp_path):
    """
    If the AI (MockLLMProvider) somehow proposes seg.episode_number=1 for an
    episode that is actually episode 7, the detector must correct it to 7.
    This guards against the original bug where seg.episode_number=1 was stored
    for PROMO_EP03_01 and PROMO_EP04_02.
    """
    show = Show(title="Override Test Show")
    db_session.add(show)
    db_session.commit()
    db_session.refresh(show)

    # Create a minimal episode 7 script
    script = """\
EPISODE NUMBER: Episode 7
EPISODE LOGLINE: Climactic reveal.
SCENE 01
Scene heading: INT. ROOFTOP - NIGHT
Scene start: 00:00.00
Scene end: 02:00.00
**VILLAIN (Triumphant):**
Start: (00:05.00) | End: (00:20.00)
"You were never the chosen one. I was!"
**HERO (Shocked):**
Start: (00:20.00) | End: (00:38.00)
"That is impossible. The oracle chose me!"
**VILLAIN (Gloating):**
Start: (00:38.00) | End: (01:05.00)
"The oracle lied. The prophecy was forged by your father."
"""
    file_path = _write_tmp_script(tmp_path, "episode_07.txt", script)
    ep = _make_episode(db_session, ep_number=7, file_path=file_path, show_id=show.id)

    # Inject a mock that returns seg.episode_number=1 (simulating the old bug)
    class BuggyMockProvider(MockLLMProvider):
        def generate_structured(self, prompt, system_instruction, response_schema, temperature=0.2):
            result = super().generate_structured(prompt, system_instruction, response_schema, temperature)
            # Corrupt the segment episode numbers to simulate the old bug
            for cand in result.candidates:
                if cand.segments:
                    for seg in cand.segments:
                        seg.episode_number = 1  # simulate wrong default
            return result

    detector = CandidateDetector(llm_provider=BuggyMockProvider())
    promos = detector.process_episode(ep.id, db_session)

    assert promos, "No promos for episode 7 — cannot verify episode override"
    for promo in promos:
        for seg in promo.segments:
            assert seg.episode_number == 7, (
                f"Segment episode_number was not corrected from 1 to 7: got {seg.episode_number}"
            )
