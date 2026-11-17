# ReelFinder AI — Kuku Assignment Submission Checklist

This document maps every required deliverable and evaluation lens from the **Kuku AI Generalist Assignment (Problem 1: Find the Promos)** to concrete evidence in the ReelFinder AI repository.

---

## 1. Required Deliverables Matrix

| Deliverable | Required? | Status | Repository Location / Link |
|---|:---:|:---:|---|
| **Solution Document (PDF, up to 2 pages)** | **Yes** | Ready for Overleaf | Candidate will compile in Overleaf using [SOLUTION_DOCUMENT.md](../SOLUTION_DOCUMENT.md) as the content source. |
| **Working Prototype Link** | **Yes** | **Live & Verified** | **Frontend:** [https://reelfinder-frontend.onrender.com/](https://reelfinder-frontend.onrender.com/)<br/>**Backend Health:** [https://reelfinder-backend.onrender.com/api/health](https://reelfinder-backend.onrender.com/api/health) |
| **Raw Outputs Folder** | **Yes** | **Verified** | 1. [raw_outputs/kuku_promos_full_dataset.csv](../raw_outputs/kuku_promos_full_dataset.csv)<br/>2. [raw_outputs/kuku_promos_full_dataset.json](../raw_outputs/kuku_promos_full_dataset.json)<br/>3. [outputs/raw_outputs_50_episodes.json](../outputs/raw_outputs_50_episodes.json) |
| **Walkthrough Video (up to 3 min)** | Optional / Rec. | Prepared | Outline and 3-minute script provided in Section 4 below. |

---

## 2. Core Assignment Questions Addressed

| Assignment Question | Addressed In | Key Technical Takeaway |
|---|---|---|
| **Which problem did you pick and why?** | [README.md](../README.md)<br/>[docs/APPROACH.md](APPROACH.md) | Problem 1: Manual promo clipping is a critical operational bottleneck in microdrama scaling. Automating text-based promo discovery directly accelerates user acquisition velocity. |
| **What assumptions did you make?** | [docs/APPROACH.md](APPROACH.md) | Screenplay cue timecodes are ground truth; promos must strictly adhere to 20–60s bounds; AI scores are prioritization guides for human editors. |
| **How does your solution work?** | [docs/ARCHITECTURE.md](ARCHITECTURE.md)<br/>[docs/APPROACH.md](APPROACH.md) | Decouples semantic comprehension (Groq/Gemini) from deterministic boundary and timestamp validation (Python), presenting ranked candidates to editors for 1-click approval. |
| **What AI tools were used?** | [docs/AI_USAGE.md](AI_USAGE.md) | Development: Antigravity, Claude, ChatGPT.<br/>Runtime: Groq LPU (`gpt-oss-120b`, `qwen3.8-27b`) and Google Gemini (`gemini-3.8-flash`). |
| **One place where AI got it wrong?** | [docs/AI_USAGE.md](AI_USAGE.md) | 1. Duration hallucination proposing a 136.5s clip as a "30s punchy promo."<br/>2. Pydantic default bug misattributing multi-segment candidate episodes to Ep 1. |
| **How is quality checked?** | [docs/QUALITY_AND_TESTING.md](QUALITY_AND_TESTING.md) | 86 automated tests in CI; deterministic timestamp and duration checks; duplicate detection ($\ge 75\%$ overlap); 100% field reconciliation across DB, CSV, and JSON. |
| **Where does your tool pick badly?** | [docs/QUALITY_AND_TESTING.md](QUALITY_AND_TESTING.md)<br/>[docs/LIMITATIONS.md](LIMITATIONS.md) | 1. Lore-dependent climaxes in later episodes (false positives).<br/>2. Slow-burn build-ups >60s (false negatives).<br/>3. Silent non-verbal action hooks. |
| **How would the approach scale?** | [docs/LIMITATIONS.md](LIMITATIONS.md) | Asynchronous task queue (Celery + Redis), cloud object storage (S3), and two-tier hierarchical model routing reducing token costs by $>80\%$. |

---

## 3. Evaluation Lenses Verification

### 1. Problem Choice and Framing
- Clear understanding of the microdrama acquisition loop (TikTok/Reels conversion, 3-second hook, cliffhanger cutoff, standalone context).
- Scoped strictly to screenplay moment and timestamp discovery—no unnecessary video rendering, synthetic music, or text overlay gimmicks.

### 2. Approach and Scale
- Balanced architecture: AI handles semantic interpretation; deterministic code enforces arithmetic, durations, and timestamp snapping.
- Resilient multi-tier failover (Groq -> Gemini -> Heuristic) ensures zero batch crashes during rate limits.
- Extremely cost-effective: Groq open-weight inference costs under \$0.12 per 50-episode show.

### 3. Quality Checking
- 86 automated tests passing in under 3.0 seconds (`pytest backend/tests`).
- Honest distinction between synthetic test suite (30 episodes, 40 test conditions) and the 50-episode run on *I Married a Broken Soldier. He was a Duke*.
- Thorough analysis of real failure modes and documented debugging stories.

### 4. Working Prototype
- Production web application deployed and running live on Render:
  - **Frontend:** [https://reelfinder-frontend.onrender.com/](https://reelfinder-frontend.onrender.com/)
  - **Backend API:** [https://reelfinder-backend.onrender.com/api/health](https://reelfinder-backend.onrender.com/api/health)
- Responsive, intuitive UI with Overview Dashboard, Library, Ranked Discovery, Editorial Review Station, and Export Center.

### 5. Clear & Concise Communication
- Transparent, professional documentation written from an engineer's perspective.
- Concrete numbers, verified code links, and real application screenshots.

---

## 4. Recommended 3-Minute Walkthrough Video Script

If recording the optional 3-minute Loom / YouTube walkthrough:

- **0:00 – 0:30 (The Problem & Approach):**  
  *"Hi, I'm Nitin. Today I'm presenting ReelFinder AI for Kuku AI Generalist Assignment Problem 1. In microdramas, finding 20–60s viral promo clips is a huge manual bottleneck for editors. We built ReelFinder AI to read screenplay cue-sheets, extract exact timestamps, score dramatic hooks and cliffhangers with AI, and strictly enforce timing rules with deterministic Python code."*

- **0:30 – 1:15 (Live Prototype Tour):**  
  *Open `https://reelfinder-frontend.onrender.com/`.*  
  Show the Overview dashboard (50 episodes, 50 valid candidates). Click into **Discovery** to show ranked candidates with conversion scores (90.2/100, 89.5/100), duration tags, and opening hooks.

- **1:15 – 2:00 (Editorial Review Station & Validation):**  
  Click into **Editorial Review**. Show the side-by-side evidence: starting cue, ending cue, 5-factor scoring breakdown, and validation checklist (source cues found, valid timestamps, 20–60s bounds). Demonstrate the 1-click **Approve** action.

- **2:00 – 2:30 (Quality, Failure Analysis & AI Mistake):**  
  Discuss testing: *"We have 86 automated tests passing in CI. But where does the tool fail? In later episodes, the LLM over-scores climaxes that depend on plot lore from 15 episodes prior. That's why human editorial review is built into the workflow. We also caught the LLM hallucinating a 136-second clip as a 'tight promo'—which our Python validator immediately vetoed."*

- **2:30 – 3:00 (Export & Scale):**  
  Navigate to **Export**. Show the scope selector ("All Discovered" vs. "Approved Only") and click **Download CSV** / **Download JSON** to show instant production-ready files. Mention scale: Groq LPU inference runs at ~1.5s per episode for under \$0.12 per show.
