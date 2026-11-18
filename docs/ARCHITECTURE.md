# ReelFinder AI — System Architecture & Technical Design

## 1. Architectural Philosophy

ReelFinder AI is built on a clear design principle: **separate semantic narrative understanding from deterministic structural validation**.

Generative language models excel at evaluating dramatic tension, identifying emotional hooks, and spotting curiosity-inducing cliffhangers. However, LLMs are fundamentally probabilistic and unreliable at arithmetic, timestamp normalization, duration bounds enforcement, and non-overlapping sequence validation.

To solve this, ReelFinder AI couples high-speed LLM inference with a deterministic Python validation engine and a human-in-the-loop editorial dashboard.

```
+-----------------------------------------------------------------------------------+
|                              REACT 19 SPA (Vite + Tailwind)                       |
|  - Metrics Overview     - Screenplay Uploader    - Ranked Candidate Feed          |
|  - Series Management    - Side-by-Side Review    - CSV & Structured JSON Exporter |
+-----------------------------------------------------------------------------------+
                                       │ HTTPS / JSON REST API
                                       ▼
+-----------------------------------------------------------------------------------+
|                             FASTAPI APPLICATION BACKEND                           |
|  - Routers: shows, episodes, promos, export, health                               |
|  - Ingestion Security: Zip-Slip protection, SHA-256 deduplication, 50MB quotas   |
+-----------------------------------------------------------------------------------+
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
+-----------------------+  +-----------------------+  +-----------------------------+
|   SCREENPLAY ENGINE   |  |   AI DISCOVERY LAYER  |  |    VALIDATION & RANKING     |
| - TxtScreenplayParser |  | - HybridLLMProvider   |  | - TimestampValidator        |
| - PdfScreenplayParser |  |   • Tier 1: Groq LPU  |  | - DuplicateDetector         |
| - SceneSegmenter      |  |   • Tier 2: Gemini    |  | - 5-Factor Ranking Engine   |
|   (20-60s windows)    |  |   • Tier 3: Heuristic |  | - SQLAlchemy Persistence    |
+-----------------------+  +-----------------------+  +-----------------------------+
```

---

## 2. Core Subsystems & Responsibilities

### A. Screenplay Ingestion & Parsing (`app/services/screenplay_parser.py`)

Microdrama screenplays arrive in various formats: cue-sheets with explicit bracketed timecodes, standard Hollywood sluglines (`INT.` / `EXT.`), or continuous text files.

The parsing pipeline operates as a deterministic regex state machine:
- **Episode & Scene Extraction:** Detects episode numbers, loglines, continuity notes, and scene boundaries (`SCENE ##`).
- **Cue Categorization:** Differentiates dialogue lines, character names, parenthetical mood directions, camera angles (`**CAMERA:**`), and action descriptions (`**ACTION:**`).
- **Timestamp Normalization:** Converts arbitrary timecode strings into canonical floating-point seconds and standardized `MM:SS.ss` strings. Handles seconds overflow (e.g., `00:73.00` correctly normalizes to `01:13.00`).
- **Evidence Preservation:** Preserves line-level verbatim cues so every candidate promo can point to the exact dialogue or action beat that justified its selection.

### B. Context-Aware Narrative Segmentation (`app/services/scene_segmenter.py`)

Feeding an entire 50-episode screenplay into an LLM at once causes token bloat, high latency, and diluted focus. 

The `SceneSegmenter` pre-processes the screenplay into overlapping narrative windows:
- Groups continuous scenes into candidates between 20 and 60 seconds without slicing across a speaker's single sentence.
- Formats structured prompt context including scene headings, character interactions, and explicit cue timestamp anchors.

### C. Multi-Tier AI Provider Abstraction (`app/llm/`)

The application defines an abstract interface (`BaseLLMProvider`) to ensure zero vendor lock-in. The runtime implementation uses `HybridLLMProvider` with automated multi-tier failover:

1. **Tier 1 — Groq LPU (`GroqProvider`):**
   - High-throughput inference using open-weight models (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`).
   - Completes candidate discovery in 0.8–1.5 seconds per episode.
   - Built-in multi-key rotation upon HTTP 429 rate limits.
2. **Tier 2 — Google Gemini (`GeminiProvider`):**
   - Secondary failover using `gemini-3.8-flash`.
   - Activated automatically if Groq keys are exhausted or unavailable.
3. **Tier 3 — Deterministic Heuristic Engine (`MockLLMProvider`):**
   - Rule-based algorithmic fallback ensuring that local development, offline runs, and CI test pipelines never crash due to network or quota failures.

All providers enforce structured output validation using Pydantic models (`AIPromoDiscoveryResponse`).

### D. Deterministic Timestamp & Evidence Validator (`app/services/timestamp_validator.py`)

The validator enforces assignment rules and invariants:
- **Strict Duration Bounds:** Rejects any promo where total duration falls outside 20.0s to 60.0s. For multi-segment promos, individual segments must be at least 3.0s and their cumulative duration must sum to 20.0s–60.0s.
- **Chronological Sequence:** Verifies that start timestamps strictly precede end timestamps, and that multi-segment sequences occur in forward chronological order without overlaps.
- **Cue Snapping & Zero Invention:** Compares candidate timestamps against ground-truth screenplay cues. If a proposed timestamp is within 0.5s of an actual line, it snaps to the exact cue offset and logs a minor alignment note. If a timestamp differs by >1.0s from any source cue, the candidate is flagged as `invalid` for inventing nonexistent timestamps.
- **Evidence Grounding:** Scans hook and cliffhanger descriptions to verify that named entities actually appear in the screenplay, and prevents `ACTION` labels from being treated as speaking characters.

### E. Semantic Duplicate Detector (`app/services/duplicate_detector.py`)

To prevent flooding content editors with redundant candidates:
- **Temporal Overlap:** Rejects candidates that share $\ge 75\%$ temporal overlap within the same episode.
- **Hook Word Similarity:** Computes Jaccard word similarity across opening hooks; candidates with $\ge 75\%$ lexical overlap are flagged and deduplicated.
- **Identical Cue Cutoffs:** Identifies candidates terminating on the exact same line.
- **Generic Beat Filter:** Detects repetitive stock phrases (e.g., repeated clock-ticking or door-slamming tropes) to preserve distinct, high-impact candidates.

### F. Multi-Factor Scoring & Ranking Engine (`app/services/ranking_service.py`)

Promos are prioritized by a normalized 0–100 composite score based on five weighted dimensions:
- **Hook Strength ($25\%$):** Evaluates whether the opening 3 seconds grab a scrolling viewer.
- **Cliffhanger Suspense ($25\%$):** Evaluates whether the cutoff point creates an intense curiosity gap.
- **Standalone Context ($20\%$):** Evaluates whether a first-time viewer can grasp the conflict without prior episodes.
- **Emotional Impact ($15\%$):** Measures dramatic stakes (betrayal, shock, confrontation).
- **Narrative Continuity ($15\%$):** Verifies logical flow without jarring narrative jumps.

Candidates receiving a validation warning (e.g., timestamp snapping) receive a $-5.0$ penalty. Candidates flagged as invalid receive an overall score of $0.0$.

### G. Resilient Client Operations & Batch Concurrency (`frontend/src/`)

To ensure smooth operation during full 50-episode batch processing and interactive review:
- **Series Scope Isolation:** All batch operations (`startBatchProcessing`) are strictly bound to the active series identifier (`selectedShow.id`), preventing cross-series data pollution. Series switching is safely locked during active runs.
- **Controlled Concurrency Pool:** Employs a worker pool of 2 (`CONCURRENCY = 2`) that runs episodes in parallel pairs, reducing batch discovery time by ~70% while remaining comfortably beneath Groq and Gemini API rate limits.
- **Dynamic Series-Synchronized Filtering:** Dropdowns automatically reflect the exact episode count of the active series (e.g., 40 episodes for a 40-episode show; disabled `No Episodes` state when empty) rather than using static hardcoded arrays.
- **Dual-Layer Cue Inspection Fallback:** When inspecting screenplay cues via `/api/episodes/{id}/inspection`, if ephemeral container restarts alter disk paths, the backend automatically performs multi-path glob search (`uploads/`, `backend/uploads/`, `KukuFmSample/`) and falls back to reconstructing verified cue sheets from database `PromoSegment` records.
- **Re-entrancy Protection:** All data mutation actions (Delete Series, Clear Episodes, Reset All) implement re-entrancy locks (`isDeleting`) with dynamic UI spinners, preventing duplicate requests and race conditions.
- **Reactive Upload Progression:** Stepper states in the ingestion pipeline react strictly to actual state transitions (series selection -> file drop -> preview -> process), preventing misleading premature completion indicators.

---

## 3. Database Schema & Data Models

The persistence layer uses SQLAlchemy 2.0 with PostgreSQL in production (Render) and SQLite for testing:

```
+--------------------+        +---------------------+
|       Show         |        |       Episode       |
+--------------------+        +---------------------+
| id (PK)            | 1    * | id (PK)             |
| title              |<------>| show_id (FK)        |
| description        |        | episode_number      |
| language           |        | file_path           |
| created_at         |        | processing_status   |
+--------------------+        +---------------------+
                                         │ 1
                                         │
                                         │ *
+--------------------+        +---------------------+
|   PromoSegment     |        |        Promo        |
+--------------------+        +---------------------+
| id (PK)            | *    1 | id (PK)             |
| promo_id (FK)      |<------>| show_id (FK)        |
| episode_id (FK)    |        | promo_identifier    |
| episode_number     |        | primary_ep_number   |
| segment_order      |        | total_duration      |
| start_timestamp    |        | overall_score       |
| end_timestamp      |        | hook                |
| duration_seconds   |        | cliffhanger         |
| scene_heading      |        | why_it_works        |
| first_line         |        | validation_status   |
| last_line          |        | approval_status     |
+--------------------+        | limitations (JSON)  |
                              | provider_name       |
                              | model_name          |
                              +---------------------+
                                         │ 1
                                         │
                                         │ *
                              +---------------------+
                              |   EditorFeedback    |
                              +---------------------+
                              | id (PK)             |
                              | promo_id (FK)       |
                              | decision            |
                              | notes               |
                              | created_at          |
                              +---------------------+
```

---

## 4. Deployment Topology

The production application is deployed on **Render** via Blueprint (`render.yaml`):

1. **Frontend (`reelfinder-frontend`):**
   - Static web service hosting the React 19 SPA.
   - Built with Vite and served with client-side SPA routing (`/* -> /index.html`).
   - Automatically connected to the backend via `VITE_API_URL`.

2. **Backend (`reelfinder-backend`):**
   - Python 3.11 web service running FastAPI and Uvicorn.
   - Automatically runs database table creation and startup health checks.
   - Supports wildcard and dynamic CORS to communicate with the frontend.

3. **Database (`reelfinder-db`):**
   - Managed PostgreSQL database on Render's free tier.
   - Automatic connection URL normalization (`postgres://` to `postgresql://`).
