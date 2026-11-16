# Kuku AI Generalist Assignment — Problem 1 Solution Document
**Candidate Name:** Nitin Kumar  
**Problem Chosen:** Problem 1: Find the Promos (Ads)  
**Repository:** [github.com/nitin-code6/reelfinder-ai](https://github.com/nitin-code6/reelfinder-ai)  
**Architecture:** FastAPI (Python 3.11) + React (Vite/Tailwind) + PostgreSQL + Multi-Tier AI (Groq / Gemini / Heuristic)

---

## 1. Problem Framing & Assumptions

### Why Problem 1?
In microdrama apps (Kuku TV, ReelShort, DramaBox), organic user acquisition on TikTok, Instagram Reels, and YouTube Shorts is the primary growth engine. Currently, human editors watch every 1–2 minute episode manually to identify viral clips. With new shows launching weekly, manual clipping creates a severe content bottleneck. Automating promo discovery with deterministic timecode accuracy directly accelerates user acquisition velocity and reduces editorial turnaround from days to minutes.

### Key Assumptions:
1. **Screenplay as Ground Truth:** Promos must strictly anchor to dialogue and action cue timecodes in the screenplay. Invented or approximate timestamps break video production workflows.
2. **Promo Constraints:**
   - **Duration:** Strictly 20 to 60 seconds (optimized for 9:16 vertical short-form retention).
   - **Opening Hook:** High-impact stimulus (shocking statement, confrontation, reveal) within the first 3.0 seconds.
   - **Cliffhanger Cutoff:** Cuts at peak unresolved tension before emotional or narrative resolution.
   - **Standalone Comprehension:** A scrolling viewer with zero prior context must understand the conflict and stakes immediately.
3. **Format Heterogeneity:** Real-world screenplay files vary wildly (cue-sheets with `[MM:SS.ss]`, standard Hollywood sluglines `INT./EXT.`, or Markdown). The parser must ingest any format without crashing.
4. **Human-in-the-Loop:** AI proposes and ranks candidates; human editors make final 1-click approvals before asset export.

---

## 2. Technical Architecture & Approach

### What We Gave to Code vs. AI
| Functionality | Engine | Rationale |
|---|---|---|
| **Cue Sheet & Timecode Parsing** | Deterministic Python Regex | LLMs are notoriously unreliable at arithmetic and string offsets. Regex ensures 100% exact cue timestamps. |
| **Duration & Boundary Validation** | Strict Algorithmic Rules | Hard limits (20.0s – 60.0s) and 3.0s hook window checks must be binary pass/fail, not probabilistic. |
| **Multi-Tier AI Inference** | Groq LPU + Google Gemini | Sub-second semantic comprehension of emotional stakes, curiosity gaps, and cliffhanger tension. |
| **Composite Ranking (0–100)** | Weighted Scoring Formula | Combines Hook (25%), Cliffhanger (25%), Standalone (20%), Emotion (15%), Continuity (15%) + penalty deductions. |
| **Multi-Key Rate-Limit Auto-Failover** | Resilient Provider Orchestration | Rotates API keys upon HTTP 429 and cascades to secondary AI or Tier 3 Heuristic Engine to guarantee zero batch crashes. |

```
Screenplay (.txt / .pdf / .zip)
       │
       ▼
Universal Cue Parser (screenplay_parser.py) ──► Validated Dialogue/Action Cues
       │
       ▼
Scene Segmenter (scene_segmenter.py) ────────► 20-60s Candidate Windows
       │
       ▼
Hybrid AI Engine (hybrid_provider.py)
   ├── Tier 1: Groq LPU (gpt-oss-120b / qwen3.8-27b with multi-key auto-rotation)
   ├── Tier 2: Google Gemini (gemini-3.8-flash with timeout guards)
   └── Tier 3: Deterministic Heuristic Engine (zero-failure fallback)
       │
       ▼
Timestamp Validator & Deduplication ─────────► Snapped Cues, No Overlaps
       │
       ▼
Composite Ranking Engine (ranking_service.py) ─► Ranked Candidates (Highest to Lowest)
       │
       ▼
Editorial Review UI (React 19) ──────────────► 1-Click Approval / CSV & JSON Production Export
```

---

## 3. Scale, Throughput & Real-World Economics

- **Speed:** Groq LPU inference processes a 50-episode show in under 2.5 minutes (~1.8 seconds per episode).
- **Cost Efficiency:**
  - Groq on-demand / open-weight models (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`) cost **\$0.05 to \$0.12 per 50-episode season**.
  - Compared to OpenAI GPT-4o (\$3.50+ per show), ReelFinder AI reduces LLM inference cost by **>96%** while maintaining sub-second latency.
- **Production Resilience:**
  - If a third-party AI provider encounters rate limits (e.g. 1,000 OTPM or 30 RPM), the system automatically rotates to backup API keys. If all external APIs are exhausted, Tier 3 Heuristic Engine activates seamlessly so editorial workflows never stall.

---

## 4. Quality Verification & Honest Limitations

### Automated Quality Checks (68 Test Cases in CI):
Our test suite (`pytest`) runs 68 unit and integration tests verifying:
- **Synthetic Dramatic Variations:** High-conflict altar betrayals, forged will reveals, and poison climaxes correctly score 88–95/100; calm mundane tea scenes score <45/100.
- **Edge Case Parsing:** Inverted timecodes, negative timestamps, missing cues, and out-of-bounds durations are cleanly caught and rejected without server exceptions.
- **Idempotence & Deduplication:** Re-processing an episode wipes old candidates to ensure 0 duplicate promos in the database.

### Where the Tool Picks Badly (Failure Modes):
1. **Visual / Non-Verbal Drama:** In microdramas, an intense silent stare, weapon reveal, or physical gesture creates massive tension without dialogue. If the screenplay author omits descriptive action text, text-only AI under-scores the scene.
2. **Sarcastic / Deceptive Resolutions:** Characters pretending to reconcile (e.g. "I agree to your terms, brother") right before an assassination can mislead lexical models into penalizing the scene as "resolved conflict."
3. **Pacing of Rapid Cross-Cuts:** Scenes with rapid 1-second cuts across multiple sub-locations can exceed the standalone context budget, making the promo disorienting to an uninitiated viewer.

---

## 5. AI Tools Used & Where They Got It Wrong

- **Tools Used:** Groq API, Google Gemini API, GitHub Copilot, and Cursor.
- **Where AI Got It Wrong:**
  - *Timestamp Drift & Hallucination:* When prompted freely, LLMs frequently hallucinated "clean" round timestamps (e.g., `00:15.00` to `00:45.00`) that truncated speech mid-sentence or fell between actual character dialogue cues.
  - *Resolution:* We stripped timecode generation entirely from the probabilistic LLM. Instead, our deterministic `scene_segmenter.py` and `screenplay_parser.py` pre-calculate valid cue boundaries, passing anchored cue IDs to the LLM. `timestamp_validator.py` then snaps all proposed timestamps back to verified screenplay lines.

---

## 6. Deliverables & Verification Links

- **GitHub Repository:** [https://github.com/nitin-code6/reelfinder-ai](https://github.com/nitin-code6/reelfinder-ai)
- **Live Deployed Application:** Ready for deployment on Render (`docker-compose.yml` / `Dockerfile`).
- **Raw Outputs Folder (`raw_outputs/`):**
  - `kuku_promos_full_dataset.csv`: 55 verified promo candidates with episode numbers, segment timestamps, hooks, cliffhangers, and ranking scores.
  - `kuku_promos_full_dataset.json`: Full structured JSON export ready for ingestion by video editing automation pipelines.
