# KUKU AI GENERALIST ASSIGNMENT — SOLUTION DOCUMENT
## Problem 1: Find the Promos (Ads) | ReelFinder AI
**Candidate:** Nitin Kumar | **Track:** AI Generalist | **GitHub Repository:** [reelfinder-ai](https://github.com/nitin-code6/reelfinder-ai.git)

---

### 1. Problem Choice & Business Rationale
In fast-growing microdrama ecosystems (1–2 minute vertical episodes, 50–100 episodes per show), audience acquisition on TikTok, Meta Reels, and YouTube Shorts is strictly conversion-driven. Today, human editors watch every episode end-to-end to manually extract 20–60 second ad hooks. 

**ReelFinder AI** transforms this manual bottleneck into an automated, scalable pipeline that reads screenplays, extracts verifiable promotional moments, validates timing rules, and ranks the highest-converting candidates for editorial sign-off.

---

### 2. Core Assumptions
1. **Timestamp Granularity:** Microdrama cue-sheets contain explicit or inferable timecodes for scenes, actions, and dialogues.
2. **Promotional Invariants:** A viral ad requires a high-stakes hook within the first 3.0 seconds, an unresolved cliffhanger cutoff, and standalone narrative clarity for a first-time viewer.
3. **Human-in-the-Loop Authority:** The AI provides scored recommendations; editorial human sign-off remains mandatory prior to publishing.

---

### 3. How the Solution Works (End-to-End Architecture)
```
Screenplay Upload (TXT/PDF/ZIP) ──▶ Deduplication & Safe Ingestion (SHA-256)
                                        │
                                        ▼
Screenplay Parser (State Machine) ──▶ Extracts Action, Camera, Dialogue & Timecodes
                                        │
                                        ▼
Context-Aware Segmenter ─────────────▶ Pre-slices candidate 20-60s narrative windows
                                        │
                                        ▼
AI Candidate Discovery (Gemini) ─────▶ Discovers viral hooks, cliffhangers, & narrative rationale
                                        │
                                        ▼
Deterministic Validator (Python) ────▶ Strictly verifies 20-60s bounds, start < end, & snaps cues
                                        │
                                        ▼
Explainable Ranking Engine ──────────▶ Computes 5-factor weighted score (0-100 scale)
                                        │
                                        ▼
Relational Persistence (PostgreSQL) ─▶ Persists episodes, promos, segments, & feedback
                                        │
                                        ▼
React SaaS Dashboard ────────────────▶ Editor discovery, side-by-side review, & CSV/JSON export
```

---

### 4. AI vs. Code Division of Responsibility

| Dimension | Handled by AI (Gemini) | Handled by Deterministic Code (Python) |
|---|---|---|
| **Narrative Understanding** | Evaluates emotional intensity, betrayal stakes, and curiosity gaps. | Does not evaluate dramatic quality. |
| **Timings & Durations** | Proposes suggested candidate start/end cues. | **Strictly enforces:** $20.0\text{s} \le \text{duration} \le 60.0\text{s}$, $\text{start} < \text{end}$. Vetoes and penalizes out-of-bounds hallucinations. |
| **Integrity & Snapping** | Identifies dialogue quotes. | Snaps approximate LLM timecodes to verbatim screenplay line offsets. |
| **Scoring & Ranking** | Rates raw dimensions (1–10). | Computes normalized composite scores, applies validation penalties, and sorts playlists. |

---

### 5. Quality Evaluation & Honest Failure Analysis (50-Episode Benchmark)
The solution was benchmarked on all 50 episodes of Kuku's confidential input pack (*I Married a Broken Soldier. He was a Duke*):
- **Total Episodes Evaluated:** 50
- **Total Promos Generated:** 50
- **Valid Timestamp & Duration Compliance:** **100.0%** (all 50 candidates verified within 20.0s – 60.0s).
- **Average Promo Duration:** 25.8 seconds (optimal for TikTok/Reels retention).
- **Average Composite Score:** 90.2 / 100.

#### Honest Analysis: Where Does the Tool Pick Poorly?
1. **Lore-Dependent Climaxes (False Positives):** In later episodes, high-shouting confrontations often hinge on prior plot points (e.g. forged wills or secret lineages from Episode 15). The LLM tends to overscore standalone context based on emotional loudness alone. The editor review dashboard counters this with editorial overrides.
2. **Drawn-Out Confrontations (>60s Arcs) (False Negatives):** High-tension dialogues that take 80–90 seconds to reach the physical confrontation are rejected by the 60s hard ceiling. Multi-segment stitching can bridge this, but requires human editor oversight for visual match cuts.
3. **Action-Heavy Silent Hooks:** Scripts with visual action slaps before dialogue starts can be under-represented if prompts focus solely on character speech. Our parser explicitly preserves `**CAMERA:**` and `**ACTION:**` lines to mitigate this.

---

### 6. Scalability Roadmap (To 10,000+ Episodes)
- **Asynchronous Task Queue:** Introduce Celery & Redis to process hundreds of parallel series releases in background worker pools.
- **Hierarchical Model Tiering:** Use high-throughput lightweight models (`gemini-1.5-flash`) for bulk candidate extraction, routing only top 5% candidates to larger models (`gemini-1.5-pro`) for high-fidelity ranking.
- **Cloud Storage:** Decouple local disk uploads into Amazon S3/GCS with presigned URLs.
