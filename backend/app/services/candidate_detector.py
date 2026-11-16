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
from app.services.screenplay_parser import TxtScreenplayParser, PdfScreenplayParser, ParsedScreenplay
from app.services.scene_segmenter import scene_segmenter
from app.services.timestamp_validator import timestamp_validator
from app.services.ranking_service import ranking_service
from app.llm.base_provider import BaseLLMProvider
from app.llm.gemini_provider import GeminiProvider
from app.llm.mock_provider import MockLLMProvider
from app.llm.prompts import SYSTEM_PROMPT_PROMO_DISCOVERY, USER_PROMPT_TEMPLATE
from app.llm.schema import AIPromoDiscoveryResponse


class CandidateDetector:
    def __init__(self, llm_provider: Optional[BaseLLMProvider] = None):
        if llm_provider:
            self.llm = llm_provider
        elif settings.USE_MOCK_LLM or not settings.GEMINI_API_KEY:
            logger.info("Using MockLLMProvider (no GEMINI_API_KEY configured or USE_MOCK_LLM=True).")
            self.llm = MockLLMProvider()
        else:
            logger.info(f"Using GeminiProvider with model: {settings.GEMINI_MODEL}")
            self.llm = GeminiProvider()

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
            ep_repo.update_status(episode_id, ProcessingStatus.FAILED.value, f"File not found: {file_path}")
            return []

        try:
            ep_repo.update_status(episode_id, ProcessingStatus.PROCESSING.value)

            # 1. Parse screenplay
            if file_path.suffix.lower() == ".pdf":
                screenplay = self.pdf_parser.parse_file(file_path)
            else:
                screenplay = self.txt_parser.parse_file(file_path)

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

            saved_promos: List[Promo] = []

            # 4. Validate & Score each candidate
            for idx, cand in enumerate(ai_response.candidates, start=1):
                # Deterministic validation
                val_res = timestamp_validator.validate_candidate(
                    candidate_start_ts=cand.start_timestamp,
                    candidate_end_ts=cand.end_timestamp,
                    screenplay=screenplay
                )

                # Calculate composite overall score
                overall_score = ranking_service.calculate_overall_score(
                    hook_score=cand.hook_strength,
                    cliffhanger_score=cand.cliffhanger_strength,
                    standalone_score=cand.standalone_context_score,
                    emotional_impact_score=cand.emotional_impact,
                    continuity_score=cand.narrative_continuity,
                    validation_status=val_res.status
                )

                promo_in = PromoCreate(
                    show_id=episode.show_id,
                    promo_identifier=f"PROMO_EP{episode.episode_number:02d}_{idx:02d}",
                    primary_episode_number=episode.episode_number,
                    hook=cand.hook,
                    cliffhanger=cand.cliffhanger,
                    standalone_context=cand.standalone_context,
                    reason=cand.why_it_works,
                    total_duration_seconds=val_res.duration_seconds,
                    hook_score=cand.hook_strength,
                    cliffhanger_score=cand.cliffhanger_strength,
                    standalone_score=cand.standalone_context_score,
                    emotional_impact_score=cand.emotional_impact,
                    continuity_score=cand.narrative_continuity,
                    overall_score=overall_score,
                    validation_status=val_res.status,
                    limitations=val_res.limitations,
                    approval_status="pending",
                    segments=[
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
                    ]
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
