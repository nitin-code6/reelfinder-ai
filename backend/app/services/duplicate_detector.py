import re
from typing import List, Tuple, Set, Optional
from pydantic import BaseModel


def normalize_beat_text(text: str) -> str:
    """Removes punctuation and normalizes spacing for semantic comparison."""
    return re.sub(r"[^\w\s]", "", text.lower()).strip()


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


GENERIC_BEAT_PATTERNS = [
    r"this was not here yesterday",
    r"someone has been hiding something",
    r"clock begins? to tick",
    r"tense silence settles",
    r"door slams? (?:shut|closed)",
    r"footsteps echo(?:ing)?",
    r"suspenseful silence",
    r"shadows? fall(?:s)? across"
]


class CandidateMoment(BaseModel):
    id: str
    episode_number: int
    start_seconds: float
    end_seconds: float
    hook: str
    cliffhanger: str
    score: float
    first_line: Optional[str] = None
    last_line: Optional[str] = None


class DuplicateDetector:
    """
    Detects and eliminates identical, near-duplicate, or generic repetitive promotional candidates:
    - Identifies candidates covering substantially identical timecodes (>= 75% temporal overlap).
    - Detects narrative hook duplication across the same or multiple episodes (>= 75% word similarity).
    - Detects verbatim identical cue endpoints (sharing first or last line within the same episode).
    - Identifies repeated generic filler beats across episodes (e.g. repeated clock ticking or missing object tropes).
    - Preserves genuinely distinct moments even when they feature the same characters.
    """

    def __init__(
        self,
        temporal_overlap_threshold: float = 0.75,
        hook_similarity_threshold: float = 0.75
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
        # Check generic trope repetition against existing pool
        cand_combined = f"{candidate.hook} {candidate.cliffhanger}".lower()
        cand_generic_match = None
        for pat in GENERIC_BEAT_PATTERNS:
            if re.search(pat, cand_combined):
                cand_generic_match = pat
                break

        for existing in existing_pool:
            # 1. Exact match
            if (
                candidate.episode_number == existing.episode_number
                and abs(candidate.start_seconds - existing.start_seconds) < 1.0
                and abs(candidate.end_seconds - existing.end_seconds) < 1.0
            ):
                return True, f"Identical timestamps to candidate '{existing.id}' in Ep {existing.episode_number}."

            # 2. Identical screenplay cue boundary within the same episode
            if candidate.episode_number == existing.episode_number:
                if (
                    candidate.last_line and existing.last_line
                    and normalize_beat_text(candidate.last_line) == normalize_beat_text(existing.last_line)
                ):
                    return True, f"Identical climactic cutoff line as candidate '{existing.id}' in Ep {existing.episode_number}."

                if (
                    candidate.first_line and existing.first_line
                    and normalize_beat_text(candidate.first_line) == normalize_beat_text(existing.first_line)
                ):
                    return True, f"Identical opening hook line as candidate '{existing.id}' in Ep {existing.episode_number}."

            # 3. Temporal overlap within the same episode
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

            # 4. Hook narrative similarity (same narrative beat repeated)
            hook_sim = compute_word_similarity(candidate.hook, existing.hook)
            cliff_sim = compute_word_similarity(candidate.cliffhanger, existing.cliffhanger)

            if hook_sim >= self.hook_threshold:
                if candidate.episode_number == existing.episode_number or cliff_sim >= 0.50:
                    return True, (
                        f"Repeated narrative hook ({hook_sim:.0%} similarity) with candidate '{existing.id}'."
                    )

            # 5. Generic trope repetition across episodes
            if cand_generic_match:
                exist_combined = f"{existing.hook} {existing.cliffhanger}".lower()
                if re.search(cand_generic_match, exist_combined):
                    return True, (
                        f"Repeated generic suspense beat ('{cand_generic_match}') already utilized in candidate '{existing.id}'."
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

