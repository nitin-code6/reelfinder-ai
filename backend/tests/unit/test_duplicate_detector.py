import pytest
from app.services.duplicate_detector import (
    DuplicateDetector,
    CandidateMoment,
    compute_word_similarity,
    compute_timestamp_overlap,
)


def test_word_similarity_computation():
    text_a = "Lord Vance accuses Lady Margaret of treason before the court"
    text_b = "Lord Vance accuses Lady Margaret of betrayal and high treason"
    sim = compute_word_similarity(text_a, text_b)
    assert sim >= 0.50

    text_c = "The sun rises over the quiet distant mountains"
    sim_diff = compute_word_similarity(text_a, text_c)
    assert sim_diff < 0.10


def test_timestamp_overlap_computation():
    # 80% overlap
    overlap = compute_timestamp_overlap(10.0, 30.0, 14.0, 30.0)
    assert overlap == (16.0 / 16.0)  # relative to shorter window (14-30 is 16s, fully inside 10-30)

    # Disjoint windows
    overlap_disjoint = compute_timestamp_overlap(0.0, 20.0, 25.0, 45.0)
    assert overlap_disjoint == 0.0


def test_duplicate_detector_flags_near_duplicates():
    detector = DuplicateDetector(temporal_overlap_threshold=0.75, hook_similarity_threshold=0.80)

    pool = [
        CandidateMoment(
            id="PROMO_EP01_01",
            episode_number=1,
            start_seconds=10.0,
            end_seconds=40.0,
            hook="Lord Vance threatens to reveal the forged royal letters",
            cliffhanger="Cuts before Lord Vance signs the arrest warrant",
            score=85.0
        )
    ]

    # Candidate 2: High overlap in same episode (12.0 to 40.0)
    cand_dup_time = CandidateMoment(
        id="PROMO_EP01_02",
        episode_number=1,
        start_seconds=12.0,
        end_seconds=40.0,
        hook="Vance threatens to reveal royal letters to guards",
        cliffhanger="Cuts before Vance signs the arrest warrant",
        score=78.0
    )

    is_dup, reason = detector.is_near_duplicate(cand_dup_time, pool)
    assert is_dup is True
    assert "Substantial timestamp overlap" in reason or "overlap" in reason.lower()

    # Candidate 3: Distinct timecode (45.0 to 75.0) with distinct event
    cand_distinct = CandidateMoment(
        id="PROMO_EP01_03",
        episode_number=1,
        start_seconds=45.0,
        end_seconds=75.0,
        hook="Helena discovers the poisoned goblet behind the altar tapestry",
        cliffhanger="The poisoned cup falls to the stone floor as guards enter",
        score=88.0
    )

    is_dup3, reason3 = detector.is_near_duplicate(cand_distinct, pool)
    assert is_dup3 is False
    assert reason3 is None


def test_duplicate_detector_filter_duplicates():
    detector = DuplicateDetector()

    candidates = [
        CandidateMoment(
            id="PROMO_A",
            episode_number=2,
            start_seconds=10.0,
            end_seconds=35.0,
            hook="Captain Drake demands surrender",
            cliffhanger="Cannons fire across the bow",
            score=70.0
        ),
        CandidateMoment(
            id="PROMO_B",
            episode_number=2,
            start_seconds=10.0,
            end_seconds=36.0,  # Near-duplicate of PROMO_A
            hook="Captain Drake demands total surrender of the fortress",
            cliffhanger="Cannons fire across the open sea",
            score=85.0  # Higher score
        ),
        CandidateMoment(
            id="PROMO_C",
            episode_number=2,
            start_seconds=60.0,
            end_seconds=88.0,  # Distinct moment
            hook="The smuggler unlocks the secret subterranean catacombs",
            cliffhanger="A shadow rises behind the torchlight",
            score=90.0
        )
    ]

    unique, dropped = detector.filter_duplicates(candidates)
    assert len(unique) == 2
    assert len(dropped) == 1
    # Ensure higher scoring PROMO_B was kept, and lower PROMO_A was dropped
    unique_ids = [c.id for c in unique]
    assert "PROMO_B" in unique_ids
    assert "PROMO_C" in unique_ids
    assert "PROMO_A" not in unique_ids
