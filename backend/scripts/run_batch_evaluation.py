import os
import sys
import json
import time
from pathlib import Path
from typing import List, Dict, Any

# Ensure backend root is in Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import settings
from app.core.logging import logger
from app.services.screenplay_parser import TxtScreenplayParser, ParsedScreenplay
from app.services.scene_segmenter import scene_segmenter
from app.services.timestamp_validator import timestamp_validator
from app.services.ranking_service import ranking_service
from app.llm.gemini_provider import GeminiProvider
from app.llm.mock_provider import MockLLMProvider
from app.llm.prompts import SYSTEM_PROMPT_PROMO_DISCOVERY, USER_PROMPT_TEMPLATE
from app.llm.schema import AIPromoDiscoveryResponse, AIPromoCandidate


def run_batch_evaluation(
    episodes_dir: Path,
    output_path: Path,
    use_mock: bool = False
) -> Dict[str, Any]:
    print(f"=== Starting Batch Evaluation on 50 Episodes ===")
    print(f"Source Directory: {episodes_dir}")
    print(f"Output File: {output_path}")

    files = sorted(episodes_dir.glob("*.txt"))
    if not files:
        print(f"No episode files found in {episodes_dir}!")
        return {}

    print(f"Found {len(files)} screenplay files.")

    # Select LLM Provider
    if not use_mock and settings.GEMINI_API_KEY and not settings.USE_MOCK_LLM:
        print(f"Using Gemini Provider (Model: {settings.GEMINI_MODEL})")
        llm = GeminiProvider()
    else:
        print("Using Deterministic Candidate Discovery Provider")
        llm = MockLLMProvider()

    parser = TxtScreenplayParser()
    raw_results = []
    
    # Metrics collection
    total_episodes = len(files)
    total_promos = 0
    valid_count = 0
    warning_count = 0
    invalid_count = 0
    duration_buckets = {"20-30s": 0, "30-45s": 0, "45-60s": 0, "out_of_bounds": 0}
    all_scores = []
    failure_cases = []

    start_time = time.time()

    for idx, f in enumerate(files, start=1):
        try:
            screenplay: ParsedScreenplay = parser.parse_file(f)
            context_text = scene_segmenter.prepare_llm_context(screenplay)
            user_prompt = USER_PROMPT_TEMPLATE.format(episode_context=context_text)

            ai_response: AIPromoDiscoveryResponse = llm.generate_structured(
                prompt=user_prompt,
                system_instruction=SYSTEM_PROMPT_PROMO_DISCOVERY,
                response_schema=AIPromoDiscoveryResponse
            )

            ep_promos = []
            for c_idx, cand in enumerate(ai_response.candidates, start=1):
                val_res = timestamp_validator.validate_candidate(
                    candidate_start_ts=cand.start_timestamp,
                    candidate_end_ts=cand.end_timestamp,
                    screenplay=screenplay
                )

                overall_score = ranking_service.calculate_overall_score(
                    hook_score=cand.hook_strength,
                    cliffhanger_score=cand.cliffhanger_strength,
                    standalone_score=cand.standalone_context_score,
                    emotional_impact_score=cand.emotional_impact,
                    continuity_score=cand.narrative_continuity,
                    validation_status=val_res.status
                )

                # Metrics accounting
                total_promos += 1
                if val_res.status == "valid":
                    valid_count += 1
                elif val_res.status == "warning":
                    warning_count += 1
                else:
                    invalid_count += 1

                # Duration bucketing
                dur = val_res.duration_seconds
                if 20.0 <= dur < 30.0:
                    duration_buckets["20-30s"] += 1
                elif 30.0 <= dur < 45.0:
                    duration_buckets["30-45s"] += 1
                elif 45.0 <= dur <= 60.0:
                    duration_buckets["45-60s"] += 1
                else:
                    duration_buckets["out_of_bounds"] += 1

                all_scores.append(overall_score)

                # Quality / failure case detection
                if cand.standalone_context_score < 7.0:
                    failure_cases.append({
                        "episode": screenplay.episode_number,
                        "candidate_id": cand.candidate_id,
                        "issue": "Low Standalone Clarity: relies on prior show context",
                        "hook": cand.hook,
                        "score": overall_score
                    })
                if val_res.status == "warning":
                    failure_cases.append({
                        "episode": screenplay.episode_number,
                        "candidate_id": cand.candidate_id,
                        "issue": f"Timestamp Drift: {'; '.join(val_res.limitations)}",
                        "hook": cand.hook,
                        "score": overall_score
                    })

                promo_data = {
                    "promo_id": f"PROMO_EP{screenplay.episode_number:02d}_{c_idx:02d}",
                    "episode_number": screenplay.episode_number,
                    "segments": [
                        {
                            "episode": screenplay.episode_number,
                            "start_timestamp": val_res.start_timestamp,
                            "end_timestamp": val_res.end_timestamp,
                            "duration_seconds": val_res.duration_seconds,
                            "scene_heading": val_res.scene_heading,
                            "first_line": val_res.first_line,
                            "last_line": val_res.last_line
                        }
                    ],
                    "total_duration_seconds": val_res.duration_seconds,
                    "hook": cand.hook,
                    "cliffhanger": cand.cliffhanger,
                    "standalone_context": cand.standalone_context,
                    "why_it_works": cand.why_it_works,
                    "scores": {
                        "hook_strength": cand.hook_strength,
                        "cliffhanger_strength": cand.cliffhanger_strength,
                        "standalone_context": cand.standalone_context_score,
                        "emotional_impact": cand.emotional_impact,
                        "narrative_continuity": cand.narrative_continuity
                    },
                    "overall_score": overall_score,
                    "validation_status": val_res.status,
                    "limitations": val_res.limitations
                }
                ep_promos.append(promo_data)

            raw_results.extend(ep_promos)

            if idx % 10 == 0 or idx == total_episodes:
                print(f"Processed {idx}/{total_episodes} episodes... ({total_promos} promos generated)")

        except Exception as e:
            print(f"Error processing episode {f.name}: {e}")

    total_time = round(time.time() - start_time, 2)
    avg_score = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0.0

    # Sort promos by overall score descending to establish ranking
    raw_results.sort(key=lambda p: p["overall_score"], reverse=True)
    for rank, p in enumerate(raw_results, start=1):
        p["rank"] = rank

    summary = {
        "benchmark_metadata": {
            "total_episodes_evaluated": total_episodes,
            "total_promos_discovered": total_promos,
            "total_execution_time_seconds": total_time,
            "average_time_per_episode_seconds": round(total_time / total_episodes, 3),
            "average_overall_score": avg_score
        },
        "validation_statistics": {
            "valid_promos": valid_count,
            "valid_percentage": f"{(valid_count / total_promos) * 100:.1f}%" if total_promos else "0%",
            "warning_promos": warning_count,
            "invalid_promos": invalid_count
        },
        "duration_distribution": duration_buckets,
        "top_10_ranked_promos": raw_results[:10],
        "identified_failure_cases_sample": failure_cases[:10]
    }

    # Save to disk
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "all_promos": raw_results}, f, indent=2)

    print(f"\n=== EVALUATION COMPLETE ===")
    print(f"Total Episodes Processed: {total_episodes}")
    print(f"Total Promos Generated: {total_promos}")
    print(f"Valid Promo Rate: {summary['validation_statistics']['valid_percentage']}")
    print(f"Average Score: {avg_score}/100")
    print(f"Results saved to: {output_path}")

    return summary


if __name__ == "__main__":
    episodes_dir = Path("KukuFmSample/I Married a Broken Soldier. He was a Duke")
    output_file = Path("outputs/raw_outputs_50_episodes.json")
    run_batch_evaluation(episodes_dir, output_file)
