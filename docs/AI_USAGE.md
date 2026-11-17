# ReelFinder AI — AI Usage Disclosure & Analysis

In accordance with the Kuku AI Generalist Assignment evaluation guidelines, this document transparently discloses:
1. Which AI tools were used during development.
2. Which AI providers operate within the production application.
3. Where AI got something wrong, how the failure was detected, why it happened, and how it was corrected.

---

## 1. Development Tools vs. Runtime Application AI

To maintain total clarity, we separate AI tools used to write code from AI models executed by the application at runtime:

### A. Development Assistance Tools
- **Antigravity (Google DeepMind):** Used for architecture design, Python backend engineering, React 19 UI component development, and test suite authoring.
- **ChatGPT (OpenAI) & Claude (Anthropic):** Used for brainstorming edge cases, prompt refinement, and reviewing screenplay formatting patterns.

### B. Production Application AI Providers (Runtime)
- **Groq LPU Inference (Primary Provider):**
  - Models: `openai/gpt-oss-120b`, `qwen/qwen3.8-27b`.
  - Role: Sub-second structured JSON candidate discovery, evaluating dramatic tension, hook strength, and cliffhanger curiosity gaps.
  - Resilience: Built-in multi-key rotation upon HTTP 429 rate limits.
- **Google Gemini API (Secondary Provider):**
  - Model: `gemini-3.8-flash`.
  - Role: Secondary failover provider when Groq keys are exhausted or rate-limited.
- **Deterministic Heuristic Engine (`MockLLMProvider`):**
  - Rule-based algorithmic fallback ensuring that local development, offline runs, and CI test pipelines never crash due to network or quota failures.

---

## 2. Division of Labor: What AI Does vs. What Code Does

```
               Screenplay File (.txt / .pdf / .zip)
                                │
                 [ Deterministic Code (Python) ]
                 • Regex cue extraction & normalization
                 • SHA-256 deduplication & path security
                 • Pre-slicing into 20–60s candidate windows
                                │
                                ▼
                     [ AI Inference Layer ]
                     • Evaluates emotional tension & stakes
                     • Identifies 3s hook & ending cliffhanger
                     • Proposes candidate boundaries & rationale
                                │
                                ▼
                 [ Deterministic Code (Python) ]
                 • Enforces 20.0s <= duration <= 60.0s
                 • Snaps timestamps to exact cue lines (<0.5s)
                 • Rejects invented timestamps (>1.0s diff)
                 • Eliminates duplicates (>=75% overlap)
                 • Calculates 0-100 weighted rank score
                                │
                                ▼
                 [ Human-in-the-Loop Review ]
                 • Content editor approves or rejects
                 • Exports marketing CSV & structured JSON
```

---

## 3. Where AI Got It Wrong & How It Was Resolved

The Kuku assignment explicitly requires: **"In your doc, tell us which tools you used and one place where they got it wrong."**

Below are two genuine mistakes encountered during development:

### Case 1: Duration Hallucination & Arithmetic Blindness

#### 1. What the incorrect result was:
During prompt testing for candidate discovery on Episode 1, the LLM proposed a promotional candidate spanning from timestamp `00:01.00` to `02:17.50`—a total clip duration of **136.5 seconds**. In its generated rationale (`why_it_works`), the model stated: *"This is a tight, punchy, fast-paced 30-second promo that hooks the viewer instantly."*

#### 2. How it was detected:
Our deterministic validation engine (`TimestampValidator`) calculated the exact duration:
$$\Delta t = 137.5 - 1.0 = 136.5\text{ seconds}$$
Because $136.5 > 60.0$, the validator immediately caught the violation, flagged the candidate as `invalid`, appended the limitation note: `"Duration 136.5s exceeds maximum promo limit (60.0s)"`, and docked 30 points from the candidate's score.

#### 3. What the actual cause was:
Large language models are probabilistic token predictors, not arithmetic calculators. While the model understood the dramatic arc of the scene, it could not calculate the difference between minute-second strings (`02:17.50` minus `00:01.00`), hallucinating that a two-minute stretch was a 30-second clip.

#### 4. How it was corrected:
1. We modified `SceneSegmenter` to pre-calculate valid 20–60 second narrative windows in Python *before* calling the LLM, feeding the model pre-bounded candidate ranges.
2. We gave `TimestampValidator` absolute veto authority over LLM outputs. Any candidate outside 20.0s–60.0s is rejected.

#### 5. What was learned:
Never rely on generative AI to enforce physical constraints, file sizes, or timecode math. Use deterministic code as a hard boundary around probabilistic AI outputs.

---

### Case 2: Multi-Segment Episode Default Bug

#### 1. What the incorrect result was:
In early test runs of multi-segment promos, candidates discovered for Episode 3 (`PROMO_EP03_01`) and Episode 4 (`PROMO_EP04_02`) had their individual segments mislabeled as `Episode 1` in the database and export files, even though the screenplay content clearly belonged to Episodes 3 and 4.

#### 2. How it was detected:
During an automated reconciliation audit between the SQLite database and exported CSV files, our audit script verified that `primary_episode_number == segment.episode_number` for single-episode promos. The script threw an assertion error when it encountered segments belonging to Episode 1 attached to an Episode 3 promo.

#### 3. What the actual cause was:
In `backend/app/llm/schema.py`, the Pydantic schema for segment candidates had:
```python
class AIPromoSegmentCandidate(BaseModel):
    episode_number: int = Field(default=1)  # <-- The bug
```
When the LLM returned structured JSON for multi-segment candidates without repeating the episode number for each segment, Pydantic silently populated the default value `1`. In `candidate_detector.py`, the line `seg.episode_number or episode.episode_number` evaluated `1 or 3`, which returned `1`.

#### 4. How it was corrected:
1. Changed `default=1` to `default=None` in `schema.py`.
2. Enforced `segment_ep_num = episode.episode_number` during episode batch processing.
3. Added dedicated regression unit tests in `tests/unit/test_episode_mapping.py`.

#### 5. What was learned:
Pydantic model defaults must be configured with extreme caution when parsing AI outputs. A silent fallback default is often worse than an explicit `None` that triggers a validation exception.
