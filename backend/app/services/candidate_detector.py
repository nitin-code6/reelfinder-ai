import os
from pathlib import Path
from typing import List, Optional
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.logging import logger
from app.models.episode import Episode, ProcessingStatus
from app.models.promo import Promo, PromoSegment
from app.repositories.episode_repository import EpisodeRepository
from app.repositories.promo_repository import PromoRepository
from app.schemas.promo import PromoCreate, PromoSegmentCreate
from app.services.screenplay_parser import TxtScreenplayParser, PdfScreenplayParser, ParsedScreenplay, parse_timestamp_to_seconds
from app.services.scene_segmenter import scene_segmenter
from app.services.timestamp_validator import timestamp_validator
from app.services.ranking_service import ranking_service
from app.services.duplicate_detector import duplicate_detector, CandidateMoment
from app.llm.base_provider import BaseLLMProvider
from app.llm.hybrid_provider import HybridLLMProvider
from app.llm.gemini_provider import GeminiProvider
from app.llm.groq_provider import GroqProvider
from app.llm.mock_provider import MockLLMProvider
from app.llm.prompts import SYSTEM_PROMPT_PROMO_DISCOVERY, USER_PROMPT_TEMPLATE
from app.llm.schema import AIPromoDiscoveryResponse


class CandidateDetector:
    def __init__(self, llm_provider: Optional[BaseLLMProvider] = None):
        if llm_provider:
            self.llm = llm_provider
        elif settings.USE_MOCK_LLM or (not settings.GROQ_API_KEY and not settings.GEMINI_API_KEY):
            logger.info("Using MockLLMProvider (no API keys configured or USE_MOCK_LLM=True).")
            self.llm = MockLLMProvider()
        else:
            logger.info("Using HybridLLMProvider with multi-tier failover (Groq primary -> Gemini secondary -> Heuristic fallback)")
            self.llm = HybridLLMProvider()

        self.txt_parser = TxtScreenplayParser()
        self.pdf_parser = PdfScreenplayParser()

    def process_episode(self, episode_id: int, db: Session) -> List[Promo]:
        """
        Processes a single episode from raw file to validated & ranked promos in database.
        """
        ep_repo = EpisodeRepository(db)
        promo_repo = PromoRepository(db)
        
        episode = ep_repo.get_by_id(episode_id)
        if not episode:
            raise ValueError(f"Episode with id {episode_id} not found.")

        file_path = Path(episode.file_path)
        if not file_path.exists():
            fname = file_path.name
            candidates = [
                Path("uploads") / fname,
                Path("backend/uploads") / fname,
                Path(settings.UPLOAD_DIR) / fname,
                *list(Path("uploads").glob(f"**/{fname}")),
                *list(Path("backend/uploads").glob(f"**/{fname}")),
                *list(Path("KukuFmSample").glob(f"**/{fname}")),
            ]
            for cand in candidates:
                if cand.exists():
                    file_path = cand
                    episode.file_path = str(cand)
                    try:
                        db.commit()
                    except Exception:
                        pass
                    break

        if not file_path.exists():
            ep_repo.update_status(episode_id, ProcessingStatus.FAILED.value, f"File not found: {file_path}")
            return []

        try:
            ep_repo.update_status(episode_id, ProcessingStatus.PROCESSING.value)

            # 1. Parse screenplay
            if file_path.suffix.lower() == ".pdf":
                screenplay = self.pdf_parser.parse_file(file_path)
            else:
                screenplay = self.txt_parser.parse_file(file_path)

            all_lines = screenplay.get_all_lines()
            if not screenplay.scenes or not all_lines:
                error_msg = f"Screenplay file '{file_path.name}' contains no parseable scenes or dialogue lines."
                logger.error(error_msg)
                ep_repo.update_status(episode_id, ProcessingStatus.FAILED.value, error_msg)
                return []

            # Update episode metadata
            ep_repo.update_metadata(
                episode_id=episode_id,
                logline=screenplay.logline,
                continuity_notes=screenplay.continuity_notes,
                scene_count=len(screenplay.scenes),
                duration_estimate_seconds=int(screenplay.total_duration_seconds)
            )

            # 2. Prepare context for AI discovery
            context_text = scene_segmenter.prepare_llm_context(screenplay)
            user_prompt = USER_PROMPT_TEMPLATE.format(episode_context=context_text)

            # 3. AI Candidate Discovery
            ai_response: AIPromoDiscoveryResponse = self.llm.generate_structured(
                prompt=user_prompt,
                system_instruction=SYSTEM_PROMPT_PROMO_DISCOVERY,
                response_schema=AIPromoDiscoveryResponse
            )

            # 4. Remove previous promos for this show & episode to guarantee zero duplicates
            deleted_prev = promo_repo.delete_by_show_and_episode(episode.show_id, episode.episode_number)
            if deleted_prev > 0:
                logger.info(f"Purged {deleted_prev} existing promo(s) for Show {episode.show_id} Ep {episode.episode_number} to prevent duplicates.")

            saved_promos: List[Promo] = []
            seen_moments: List[CandidateMoment] = []

            # 4. Validate & Score each candidate
            for idx, cand in enumerate(ai_response.candidates, start=1):
                segments_to_save: List[PromoSegmentCreate] = []
                total_duration = 0.0
                cand_limitations = []
                cand_status = "valid"

                # Check for multi-segment candidate
                if cand.segments and len(cand.segments) > 1:
                    is_multi_valid = True
                    prev_end_sec = -1.0
                    for seg_idx, seg in enumerate(cand.segments, start=1):
                        seg_res = timestamp_validator.validate_candidate(
                            candidate_start_ts=seg.start_timestamp,
                            candidate_end_ts=seg.end_timestamp,
                            screenplay=screenplay,
                            is_segment=True
                        )
                        cand_limitations.extend(seg_res.limitations)
                        if seg_res.status == "invalid":
                            is_multi_valid = False
                            cand_status = "invalid"
                        elif seg_res.status == "warning" and cand_status != "invalid":
                            cand_status = "warning"

                        # Ensure segments are chronological and non-overlapping
                        if prev_end_sec > 0 and seg_res.start_seconds < prev_end_sec:
                            cand_status = "invalid"
                            cand_limitations.append(
                                f"Segment {seg_idx} ({seg_res.start_timestamp}) overlaps with previous segment."
                            )
                        prev_end_sec = seg_res.end_seconds

                        total_duration += seg_res.duration_seconds
                        # In episode processing, segments belong to the source episode being processed
                        segment_ep_num = episode.episode_number
                        segments_to_save.append(
                            PromoSegmentCreate(
                                episode_id=episode.id,
                                episode_number=segment_ep_num,
                                start_timestamp=seg_res.start_timestamp,
                                end_timestamp=seg_res.end_timestamp,
                                duration_seconds=seg_res.duration_seconds,
                                segment_order=seg_idx,
                                scene_heading=seg_res.scene_heading,
                                first_line=seg_res.first_line,
                                last_line=seg_res.last_line
                            )
                        )
                    total_duration = round(total_duration, 2)
                    if total_duration < timestamp_validator.min_duration or total_duration > timestamp_validator.max_duration:
                        cand_status = "invalid"
                        cand_limitations.append(
                            f"Combined multi-segment duration {total_duration:.1f}s is outside valid 20-60s limit."
                        )
                else:
                    # Single segment candidate
                    val_res = timestamp_validator.validate_candidate(
                        candidate_start_ts=cand.start_timestamp,
                        candidate_end_ts=cand.end_timestamp,
                        screenplay=screenplay,
                        hook_text=cand.hook,
                        cliffhanger_text=cand.cliffhanger
                    )
                    cand_status = val_res.status
                    cand_limitations = val_res.limitations
                    total_duration = val_res.duration_seconds
                    segments_to_save.append(
                        PromoSegmentCreate(
                            episode_id=episode.id,
                            episode_number=episode.episode_number,
                            start_timestamp=val_res.start_timestamp,
                            end_timestamp=val_res.end_timestamp,
                            duration_seconds=val_res.duration_seconds,
                            segment_order=1,
                            scene_heading=val_res.scene_heading,
                            first_line=val_res.first_line,
                            last_line=val_res.last_line
                        )
                    )

                # Calculate composite overall score
                overall_score = ranking_service.calculate_overall_score(
                    hook_score=cand.hook_strength,
                    cliffhanger_score=cand.cliffhanger_strength,
                    standalone_score=cand.standalone_context_score,
                    emotional_impact_score=cand.emotional_impact,
                    continuity_score=cand.narrative_continuity,
                    validation_status=cand_status
                )

                # Quality filter: If candidate is below quality threshold (< 50.0), flag it
                if overall_score < 50.0 and cand_status == "valid":
                    cand_status = "warning"
                    cand_limitations.append("Low dramatic tension: scenes lack sufficient viral hook or cliffhanger conflict.")

                # Near-duplicate detection against already accepted candidates in this episode
                cand_moment = CandidateMoment(
                    id=cand.candidate_id or f"PROMO_EP{episode.episode_number:02d}_{idx:02d}",
                    episode_number=episode.episode_number,
                    start_seconds=parse_timestamp_to_seconds(segments_to_save[0].start_timestamp) if segments_to_save else 0.0,
                    end_seconds=parse_timestamp_to_seconds(segments_to_save[-1].end_timestamp) if segments_to_save else 0.0,
                    hook=cand.hook,
                    cliffhanger=cand.cliffhanger,
                    score=overall_score
                )

                is_dup, dup_reason = duplicate_detector.is_near_duplicate(cand_moment, seen_moments)
                if is_dup:
                    logger.warning(f"Dropping near-duplicate candidate for Ep {episode.episode_number}: {dup_reason}")
                    continue  # Do not generate duplicate candidates for the same narrative beat

                seen_moments.append(cand_moment)

                promo_in = PromoCreate(
                    show_id=episode.show_id,
                    promo_identifier=f"PROMO_EP{episode.episode_number:02d}_{idx:02d}",
                    primary_episode_number=episode.episode_number,
                    hook=cand.hook,
                    cliffhanger=cand.cliffhanger,
                    standalone_context=cand.standalone_context,
                    reason=cand.why_it_works,
                    total_duration_seconds=total_duration,
                    hook_score=cand.hook_strength,
                    cliffhanger_score=cand.cliffhanger_strength,
                    standalone_score=cand.standalone_context_score,
                    emotional_impact_score=cand.emotional_impact,
                    continuity_score=cand.narrative_continuity,
                    overall_score=overall_score,
                    validation_status=cand_status,
                    limitations=cand_limitations,
                    approval_status="pending",
                    provider_name=getattr(self.llm, "last_provider", "groq"),
                    model_name=getattr(self.llm, "last_model", "openai/gpt-oss-120b"),
                    segments=segments_to_save
                )

                created_promo = promo_repo.create(promo_in)
                saved_promos.append(created_promo)

            ep_repo.update_status(episode_id, ProcessingStatus.COMPLETED.value)
            logger.info(f"Episode {episode.episode_number} processed: created {len(saved_promos)} promos.")
            return saved_promos

        except Exception as e:
            logger.error(f"Error processing episode {episode_id}: {str(e)}", exc_info=True)
            ep_repo.update_status(episode_id, ProcessingStatus.FAILED.value, str(e))
            raise


candidate_detector = CandidateDetector()
