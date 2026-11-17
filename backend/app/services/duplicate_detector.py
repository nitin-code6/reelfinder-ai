import re
from typing import List, Tuple, Set, Optional
from pydantic import BaseModel


def compute_word_similarity(text_a: str, text_b: str) -> float:
    """Computes Jaccard word-level similarity between two texts."""
    words_a = set(re.findall(r"\b\w{3,}\b", text_a.lower()))
    words_b = set(re.findall(r"\b\w{3,}\b", text_b.lower()))
    if not words_a or not words_b:
        return 0.0
    intersection = words_a.intersection(words_b)
    union = words_a.union(words_b)
    return len(intersection) / len(union)


def compute_timestamp_overlap(
    start_a: float, end_a: float, start_b: float, end_b: float
) -> float:
    """
    Computes overlap ratio between two time windows relative to the shorter window.
    Returns 0.0 to 1.0.
    """
    overlap_start = max(start_a, start_b)
    overlap_end = min(end_a, end_b)
    overlap = max(0.0, overlap_end - overlap_start)
    min_dur = min(max(0.1, end_a - start_a), max(0.1, end_b - start_b))
    return overlap / min_dur


class CandidateMoment(BaseModel):
    id: str
    episode_number: int
    start_seconds: float
    end_seconds: float
    hook: str
    cliffhanger: str
    score: float


class DuplicateDetector:
    """
    Detects and eliminates identical or near-duplicate promotional candidates:
    - Identifies candidates covering substantially identical timecodes (>= 75% temporal overlap).
    - Detects narrative hook duplication across the same or multiple episodes (>= 80% word similarity).
    - Preserves genuinely distinct moments even when they feature the same characters.
    """

    def __init__(
        self,
        temporal_overlap_threshold: float = 0.75,
        hook_similarity_threshold: float = 0.80
    ):
        self.temporal_threshold = temporal_overlap_threshold
        self.hook_threshold = hook_similarity_threshold

    def is_near_duplicate(
        self,
        candidate: CandidateMoment,
        existing_pool: List[CandidateMoment]
    ) -> Tuple[bool, Optional[str]]:
        """
        Evaluates whether candidate is a duplicate of any moment in existing_pool.
        Returns (is_dup, reason).
        """
        for existing in existing_pool:
            # 1. Exact match
            if (
                candidate.episode_number == existing.episode_number
                and abs(candidate.start_seconds - existing.start_seconds) < 1.0
                and abs(candidate.end_seconds - existing.end_seconds) < 1.0
            ):
                return True, f"Identical timestamps to candidate '{existing.id}' in Ep {existing.episode_number}."

            # 2. Temporal overlap within the same episode
            if candidate.episode_number == existing.episode_number:
                overlap_ratio = compute_timestamp_overlap(
                    candidate.start_seconds, candidate.end_seconds,
                    existing.start_seconds, existing.end_seconds
                )
                if overlap_ratio >= self.temporal_threshold:
                    return True, (
                        f"Substantial timestamp overlap ({overlap_ratio:.0%}) with candidate "
                        f"'{existing.id}' ({existing.start_seconds:.1f}s-{existing.end_seconds:.1f}s) in Ep {existing.episode_number}."
                    )

            # 3. Hook narrative similarity (same narrative beat repeated)
            similarity = compute_word_similarity(candidate.hook, existing.hook)
            if similarity >= self.hook_threshold:
                # If they also share cliffhanger or are in the same episode, definitely duplicate
                cliff_similarity = compute_word_similarity(candidate.cliffhanger, existing.cliffhanger)
                if candidate.episode_number == existing.episode_number or cliff_similarity >= 0.60:
                    return True, (
                        f"Repeated narrative hook ({similarity:.0%} match) with candidate '{existing.id}'."
                    )

        return False, None

    def filter_duplicates(
        self,
        candidates: List[CandidateMoment]
    ) -> Tuple[List[CandidateMoment], List[Tuple[CandidateMoment, str]]]:
        """
        Filters out duplicate candidates from a candidate list, keeping highest-scoring variant.
        Returns (unique_candidates, dropped_duplicates_with_reason).
        """
        # Sort candidates descending by score to always retain the higher quality candidate
        sorted_candidates = sorted(candidates, key=lambda c: c.score, reverse=True)
        unique: List[CandidateMoment] = []
        dropped: List[Tuple[CandidateMoment, str]] = []

        for cand in sorted_candidates:
            is_dup, reason = self.is_near_duplicate(cand, unique)
            if is_dup:
                dropped.append((cand, reason or "Duplicate narrative beat"))
            else:
                unique.append(cand)

        return unique, dropped


duplicate_detector = DuplicateDetector()
