# Kuku AI Generalist Assignment — Problem 1 Solution Document

**Problem Chosen:** Problem 1: Find the Promos (Ads)  
**Project Name:** ReelFinder AI  
**Candidate Name:** Nitin Kumar  
**Live Application (Frontend):** [https://reelfinder-frontend.onrender.com/](https://reelfinder-frontend.onrender.com/)  
**Live Backend API (Health):** [https://reelfinder-backend.onrender.com/api/health](https://reelfinder-backend.onrender.com/api/health)  
**GitHub Repository:** [https://github.com/nitin-code6/reelfinder-ai](https://github.com/nitin-code6/reelfinder-ai)  

---

## 1. Problem Framing & Business Assumptions

### Operational Bottleneck in Microdrama Scaling
In short vertical microdramas (1-to-2 minute episodes, 50–100 episodes per series), user acquisition on TikTok, Meta Reels, and YouTube Shorts is strictly conversion-driven. The core marketing asset is a 20–60 second unedited clip taken directly from the show. 

Currently, content editors watch every episode end-to-end to manually extract promotional moments. With new series releasing weekly, this creates a severe operational bottleneck. ReelFinder AI automates promo discovery from screenplay text, identifies exact start/end timestamps, ranks candidates by promotional potential, and presents them for 1-click human editorial approval.

### Non-Negotiable Promo Invariants & Assumptions
1. **Screenplay as Ground Truth:** All candidate timestamps must anchor directly to existing lines and action cues in the screenplay. The system must never invent or estimate timecodes.
2. **The 3-Second Hook:** The clip must open with an immediate high-impact stimulus (physical slap, public accusation, unmasking) to prevent drop-off within the first 3 seconds.
3. **Unresolved Cliffhanger:** The clip must cut abruptly at the peak of dramatic tension before confession, apology, or resolution, creating a compelling curiosity gap.
4. **Standalone Comprehension:** A viewer who has never seen the series must understand the conflict and stakes within seconds.
5. **Strict Duration (20s to 60s):** Clips under 20s fail to build narrative investment; clips over 60s suffer heavy completion drop-off.
6. **Human-in-the-Loop:** AI proposals and scores are recommendations; editorial human sign-off remains mandatory before publishing.

---

## 2. Technical Architecture & End-to-End Pipeline

ReelFinder AI decouples probabilistic semantic narrative comprehension from deterministic boundary and timing validation:

```
Screenplay File (.txt / .pdf / .zip)
       │
       ▼
1. File Safety & Ingestion (file_service.py) ─────► SHA-256 deduplication, Zip-Slip guard
       │
       ▼
2. Regex State Machine Parser (screenplay_parser.py) ► Scenes, dialogue, camera directions & normalized timestamps
       │
       ▼
3. Context Segmenter (scene_segmenter.py) ────────► Pre-slices 20–60s narrative tension windows
       │
       ▼
4. Multi-Tier AI Discovery (hybrid_provider.py)
   ├── Tier 1 (Primary): Groq LPU (openai/gpt-oss-120b, qwen3.8-27b) — Sub-second structured JSON, multi-key rotation
   ├── Tier 2 (Secondary Failover): Google Gemini (gemini-3.8-flash) — Automatic cascade on rate limits
   └── Tier 3 (Zero-Crash Fallback): Deterministic Heuristic Engine — Rule-based offline guarantee
       │
       ▼
5. Deterministic Validator (timestamp_validator.py) ► Enforces 20.0s–60.0s bounds, start < end, snaps cues (<0.5s)
       │
       ▼
6. Semantic Duplicate Filter (duplicate_detector.py) ► Rejects >=75% temporal overlap or repeated generic tropes
       │
       ▼
7. 5-Factor Weighted Ranker (ranking_service.py) ──► Computes 0–100 score + penalty deductions
       │
       ▼
8. Editorial Review Station (React 19 Dashboard) ──► Side-by-side evidence review, 1-click approval, CSV/JSON export
```

---

## 3. Division of Responsibility: AI vs. Deterministic Code

| Dimension | Handled by AI (Groq / Gemini) | Handled by Deterministic Code (Python) | Rationale |
|---|---|---|---|
| **Narrative Understanding** | Evaluates emotional stakes, curiosity gaps, and dramatic tension. | Does not judge subjective literary quality. | LLMs excel at nuanced semantic and contextual comprehension. |
| **Timecodes & Bounds** | Proposes candidate start/end anchors. | **Strictly enforces:** Normalization, $\Delta t = \text{end} - \text{start}$, $20\text{s} \le \text{duration} \le 60\text{s}$, and $\text{start} < \text{end}$. | LLMs are notoriously bad at arithmetic; deterministic rules guarantee 100% compliance. |
| **Source Grounding** | Selects verbatim dialogue quotes. | Snaps approximate timecodes ($\le 0.5\text{s}$) to verified screenplay lines; rejects invented timestamps ($>1.0\text{s}$). | Prevents hallucinated timestamps from entering video production pipelines. |
| **Deduplication** | Identifies narrative themes. | Computes Jaccard word similarity and temporal overlap ratios ($\ge 75\%$). | Algorithms reliably filter redundant candidates covering the same story beat. |
| **Composite Ranking** | Scores raw qualitative factors (1–10). | Computes normalized 0–100 weighted score and applies penalty deductions. | Ensures transparent, explainable, and reproducible candidate rankings. |

### Explainable 5-Factor Ranking Formula
$$\text{Base Score} = 10 \times \left( 0.25 \cdot \text{Hook} + 0.25 \cdot \text{Cliffhanger} + 0.20 \cdot \text{Standalone} + 0.15 \cdot \text{Impact} + 0.15 \cdot \text{Continuity} \right)$$
- **Penalties:** $-5.0$ points for warnings (cue snapping / minor evidence flag); score forced to $0.0$ for invalid candidates.

---

## 4. Scale, Throughput & Real-World Economics

- **Inference Speed:** Powered by Groq LPU inference, candidate discovery runs in **0.8–1.5 seconds per episode**. An entire 50-episode season is processed in under 2.5 minutes.
- **Cost Efficiency:** Using open-weight models on Groq (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`) costs **\$0.05 to \$0.12 per 50-episode season**. Compared to GPT-4o (\$3.50+ per show), ReelFinder AI reduces LLM inference costs by **>96%**.
- **Production Resilience:** If a provider hits rate limits (HTTP 429), the system automatically rotates across backup API keys, cascades to Google Gemini (`gemini-3.8-flash`), and falls back to Tier 3 Heuristic Engine if external APIs are exhausted, ensuring batch pipelines never crash.

---

## 5. Quality Checking & Honest Failure Analysis

### Automated Test Verification (86 Tests Passing)
Our test suite (`pytest`) runs 86 automated unit, integration, and benchmark tests in CI:
- **30 Synthetic Episodes (40 Test Scenarios):** Verifies 10 high-conflict viral hooks (altar betrayal, poison climax, arrest warrant), 6 mundane scenes (<45/100 score), 6 resolved conflicts (penalized for weak cliffhanger), 5 malformed timestamps, 5 invented timestamps, and 4 out-of-bounds durations.
- **50-Episode Benchmark (*I Married a Broken Soldier. He was a Duke*):** Processed all 50 serialized episodes; achieved 100% compliance on the 20–60s duration requirement (average promo duration: 25.8 seconds).

### Where Does the Tool Pick Badly? (Honest Failure Modes)
1. **Lore-Dependent Climaxes (False Positives):** In late episodes (e.g. Ep 28–34), shouting confrontations often hinge on prior plot points (such as forged wills from Episode 15). The LLM detects shouting and scores the scene high on Hook ($9/10$), but overestimates Standalone Context. *Mitigation:* The Editorial Review Station allows editors to review evidence and flag "Lacks Standalone Context."
2. **Slow-Burn Build-ups (>60s Arcs) (False Negatives):** High-tension dialogues that take 80–90 seconds to reach the physical confrontation are rejected by the 60s hard ceiling. *Mitigation:* Multi-segment stitching bridges non-continuous beats, guided by human editor review.
3. **Silent Action Hooks:** Scripts opening with intense visual action (e.g. drawn weapon, silent slap) without dialogue for the first 10 seconds can be overlooked if prompts focus only on speech. *Mitigation:* The parser explicitly extracts `**CAMERA:**` and `**ACTION:**` cues alongside dialogue.

---

## 6. AI Usage Disclosure & Genuine Failure Analysis

### AI Tools Utilized
- **Development Assistance:** Antigravity (Google DeepMind), Claude, ChatGPT.
- **Runtime Application Models:** Groq LPU (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`) as Tier 1, Google Gemini (`gemini-3.8-flash`) as Tier 2, and Deterministic Heuristic Engine as Tier 3.

### Critical Mistake Encountered & Resolved: Duration Hallucination
- **The Mistake:** During initial prompt testing, the LLM proposed a candidate spanning `00:01.00` to `02:17.50` (**136.5 seconds**), while describing it in its rationale as a *"tight, fast-paced 30-second promo."*
- **How It Was Detected:** Our deterministic Python validator calculated $\Delta t = 136.5\text{s}$, flagged the candidate as `invalid` ($136.5 > 60.0$), docked 30 points, and logged the limitation note.
- **Root Cause:** LLMs understand dramatic narrative arcs but lack internal clocks to perform arithmetic on timecode strings.
- **Correction:** Pre-segmented candidate windows strictly to 20–60s in Python *before* calling the LLM, and gave `TimestampValidator` hard veto power over timecode validity.

---

## 7. Production Roadmap (To 10,000+ Episodes)

1. **Asynchronous Task Queue:** Decouple episode ingestion and AI analysis using **Celery** and **Redis** worker pools to process hundreds of shows in parallel with WebSocket status updates.
2. **Cloud Object Storage:** Decouple local uploads to **Amazon S3** or **Google Cloud Storage** with presigned URLs.
3. **Hierarchical Model Tiering:** Use lightweight models (`qwen/qwen3.8-27b`) to filter out the bottom 70% of low-tension scenes, routing only the top 30% to frontier models (`gpt-oss-120b`), reducing token costs by $>80\%$.
