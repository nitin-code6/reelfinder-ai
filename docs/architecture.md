# ReelFinder AI — System Architecture & Component Design

## 1. High-Level Architectural Overview

ReelFinder AI is designed as a decoupled, modular micro-SaaS architecture to identify, validate, score, and rank promotional clips from serialized microdrama screenplays.

```
+-----------------------------------------------------------------------------------+
|                              REACT SAAS DASHBOARD                                 |
|  - Metrics Overview     - Screenplay Uploader    - Ranked Leaderboard             |
|  - Series Manager       - Side-by-Side Reviewer  - CSV & JSON Exporter            |
+-----------------------------------------------------------------------------------+
                                       │ HTTP / JSON
                                       ▼
+-----------------------------------------------------------------------------------+
|                             FASTAPI REST BACKEND                                  |
|  - Routers: shows, episodes, promos, export, health                               |
|  - File Ingestion & Deduplication Service (SHA-256)                               |
+-----------------------------------------------------------------------------------+
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
+-----------------------+  +-----------------------+  +-----------------------------+
|   SCREENPLAY ENGINE   |  |   AI DISCOVERY LAYER  |  |    VALIDATION & PERSISTENCE |
| - TxtScreenplayParser |  | - GeminiProvider      |  | - TimestampValidator        |
| - PdfScreenplayParser |  | - MockLLMProvider     |  | - 5-Factor Ranking Engine   |
| - SceneSegmenter      |  | - Structured JSON     |  | - SQLAlchemy / PostgreSQL   |
+-----------------------+  +-----------------------+  +-----------------------------+
```

---

## 2. Component Responsibilities & Invariants

### A. File Ingestion & Deduplication (`app/services/file_service.py`)
- **Supported Formats:** `.txt`, `.pdf`, and `.zip` archives.
- **Security:** Path traversal protection (`Zip Slip` guard) during extraction. File size quota enforcement (50MB).
- **Integrity:** SHA-256 content hashing prevents duplicate episode ingestion.

### B. Screenplay Parser (`app/services/screenplay_parser.py`)
- Operates as a deterministic regex state machine.
- Extracts:
  - Episode headers (Number, Logline, Continuity notes)
  - Scene boundaries (`SCENE ##`, Scene Heading, Scene Start, Scene End)
  - Camera directions, Action beats, and Character dialogue with mood parentheticals
  - Timecodes: Normalizes `MM:SS.ss`, `(MM:SS.ss)`, and `HH:MM:SS.ss` into exact floating-point second offsets.

### C. Context-Aware Segmenter (`app/services/scene_segmenter.py`)
- Isolates continuous narrative stretches without slicing mid-dialogue.
- Prepares prompt contexts preserving cue timestamps and character interactions.
- Avoids prompt token explosion by focusing on tension arcs.

### D. AI Discovery Layer (`app/llm/`)
- Uses Google Gemini (`gemini-1.5-flash` / `gemini-1.5-pro`) with strict Pydantic JSON schemas.
- Abstract `BaseLLMProvider` decouples the core logic from specific vendors.
- Implements `MockLLMProvider` for deterministic offline testing and CI without external API costs.

### E. Timestamp & Duration Validator (`app/services/timestamp_validator.py`)
- **Key Invariant:** The LLM is never permitted to invent timestamps or clip durations.
- Validates:
  1. $20.0\text{s} \le \text{duration} \le 60.0\text{s}$.
  2. $\text{start\_time} < \text{end\_time}$.
  3. Start and end timestamps exist in the parsed screenplay lines.
- Approximate timestamps from LLM outputs are snapped to ground-truth line cues and flagged with a warning.

### F. Multi-Factor Ranking Engine (`app/services/ranking_service.py`)
- Calculates a 0–100 normalized composite score based on:
  - Hook Strength ($25\%$)
  - Cliffhanger Strength ($25\%$)
  - Standalone Context ($20\%$)
  - Emotional Impact ($15\%$)
  - Narrative Continuity ($15\%$)
- Penalizes validation discrepancies ($-5$ points for snapping, $-30$ points for out-of-bounds duration).

---

## 3. Database Schema & Relational Design

The application uses SQLAlchemy with Alembic migration support:

- `shows`: Top-level series container (id, title, language, description, created_at).
- `episodes`: Screenplay records (id, show_id, episode_number, filename, file_path, logline, scene_count, processing_status).
- `promos`: Candidate promotional clips (id, show_id, primary_episode_number, hook, cliffhanger, scores, overall_score, approval_status).
- `promo_segments`: 1-to-many relationship supporting multi-segment promos (id, promo_id, episode_id, start_timestamp, end_timestamp, duration_seconds, first_line, last_line).
- `editor_feedback`: Editorial audit trail (id, promo_id, user_id, decision, comments, created_at).
