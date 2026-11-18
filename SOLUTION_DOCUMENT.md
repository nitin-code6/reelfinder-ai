# Kuku — AI Generalist Assignment (Problem 1: Find the Promos)
## Executive Solution Document & Technical Report

**Problem Chosen:** Problem 1: Find the Promos (Ads)  
**Candidate Name:** Nitin Kumar  
**Live Application (Frontend):** [https://reelfinder-frontend.onrender.com/](https://reelfinder-frontend.onrender.com/)  
**Live Backend API (Health):** [https://reelfinder-backend.onrender.com/api/health](https://reelfinder-backend.onrender.com/api/health)  
**GitHub Repository:** [https://github.com/nitin-code6/reelfinder-ai](https://github.com/nitin-code6/reelfinder-ai)  
**Raw Outputs:** `outputs/raw_outputs_50_episodes.json` and `outputs/raw_outputs_50_episodes.csv`  

---

## 1. Problem Framing & Core Assumptions

### The Situation
At Kuku, AI-generated microdramas (1-to-2 minute vertical episodes, 50–100 episodes per show) are published weekly. Today, content editors manually watch every episode to extract 20–60 second ad clips for TikTok, Meta Reels, and YouTube Shorts. This manual workflow creates a severe operational bottleneck. 

### Core Assumptions Made Where the Brief was Silent:
1. **Screenplay Ground Truth:** Timecodes must never be hallucinated or estimated. Start and end points must bind strictly to verifiable dialogue or action cues present in the transcript.
2. **The 3-Second Hook Rule:** Organic scroll-stopping power on vertical video requires an immediate stimulus (a physical slap, public accusation, paternity reveal, or weapon drawn) within the opening 3.0 seconds.
3. **The Curiosity-Gap Cliffhanger:** A high-converting promo must cut abruptly before emotional resolution, reaction, apology, or confession. Resolved dialogue scenes are heavily penalized ($score \le 4.0$).
4. **Standalone Comprehension:** A first-time viewer must understand the stakes instantly without prior knowledge of the series lore. Episodes consisting solely of mundane exposition or calm filler return `0` candidates (`[]`).
5. **Human-in-the-Loop:** AI proposals and scores are recommendations; final editorial sign-off remains manual via an approval dashboard.

---

## 2. Approach & Architecture: AI vs. Deterministic Code

We deliberately decoupled **probabilistic semantic narrative comprehension** from **deterministic boundary validation and mathematical scoring**:

```
Screenplay File (.txt / .pdf / .zip)
       │
       ▼
1. File Ingestion & Security ──────► SHA-256 deduplication, Zip-Slip path sanitization
       │
       ▼
2. Regex State Machine Parser ─────► Extracts scenes, cues, dialogue & canonical MM:SS.ss timecodes
       │
       ▼
3. Resilient Multi-Key AI Engine ──► Tier 1: Groq LPU (qwen/qwen3.8-27b) with 20s cooldown key rotation
                                    └── Tier 2: Google Gemini (gemini-flash-lite-latest) automatic failover
       │
       ▼
4. Deterministic Validator ────────► Enforces 20.0s–60.0s duration, start < end, snaps cues (±0.5s)
       │
       ▼
5. Semantic Duplicate Filter ──────► Discards temporal overlaps (≥75%) and repeated narrative tropes
       │
       ▼
6. 5-Factor Weighted Ranker ───────► Mathematical 0–100 score: Hook(25%), Cliffhanger(25%), Standalone(20%), Impact(15%), Continuity(15%)
       │
       ▼
7. Editorial Review Station ───────► React 19 UI: Side-by-side cue inspection, 1-click Approve/Reject, CSV/JSON export
```

### Responsibility Split
- **What We Gave to AI (Groq + Gemini):** Narrative tension scoring, hook extraction, identifying emotional climax points, and evaluating curiosity gaps.
- **What We Kept as Code (Python):** Duration calculations ($\Delta t = \text{end} - \text{start}$), timestamp verification against actual cue bounds, strict 20–60s limit enforcement, deduplication, and mathematical ranking formulas. LLMs struggle with arithmetic; deterministic code guarantees zero duration violations.
- **Strict No-Silent-Mock Fallback:** When online AI is active (`USE_MOCK_LLM=false`), if all API keys fail or hit timeouts, the system cleanly logs the failed episode. It **never silently replaces failed AI responses with synthetic heuristic text**.

---

## 3. Real-World Scale, Economics & Model Swapping

- **Inference Speed:** Powered by Groq LPUs, episode analysis completes in **1.5 to 4.0 seconds**. The entire 50-episode season evaluated in **509 seconds (~8.5 minutes)**.
- **Cost Efficiency:** Using open-weight models on Groq (`qwen/qwen3.8-27b`) and lightweight Gemini (`gemini-flash-lite-latest`), inference costs approximately **$0.02 to $0.05 per 50-episode season**. Compared to GPT-4o ($3.50+ per show), this represents a **>98% cost reduction**.
- **Model Agnostic Architecture:** Built on an abstract `BaseLLMProvider`. In an interview or production setting, swapping to Claude 3.5 Sonnet, DeepSeek, or an internal fine-tuned Kuku model requires changing just one environment variable (`GROQ_MODEL` or `GEMINI_MODEL`).
- **Resilience Pool:** Automatically round-robins across multiple API keys per provider, tracks per-key rate limits with isolated cooldowns, and cascades cleanly between providers.

---

## 4. Quality Checking, Real 50-Episode Run & Honest Failures

### 50-Episode Screenplay Evaluation (*"I Married a Broken Soldier. He was a Duke"*)
Across all 50 serialized episodes, the automated batch evaluation generated:
* **Total Promos Generated:** 63 candidate promos
* **Provider Distribution:** **25 Groq LPU (39.7%)**, **38 Google Gemini (60.3%)**, **0 Heuristic/Mock (0.0%)**
* **Validation Status Breakdown:**
  * **Valid (37 Promos):** 100% compliant with 20.0s–60.0s bounds, verified timestamps, and strong conflict.
  * **Warning (13 Promos):** Soft cue alignments or minor boundary proximity; flagged for editorial review.
  * **Invalid (13 Promos):** Paced outside strict limits; cleanly flagged with reasons in limitations.
* **Failed Episodes (1 Episode):** Episode 32 failed due to an upstream Google Gemini 504 Gateway Timeout while Groq keys were in rate-limit cooldown. Captured transparently in `failed_episodes` rather than faked.
* **Automated Test Suite:** **91/91 unit and integration tests passing** in `pytest`.

### Where Does the Tool Pick Badly? (Honest Failure Modes)
1. **Lore-Heavy Climaxes (False Positives):** In late episodes (Ep 38–48), heated shouting matches often depend on backstory revealed 20 episodes prior (e.g. forged War Office warrants). The LLM scores the hook high ($9.5/10$) based on angry dialogue, but an outsider finds the scene confusing. *Mitigation:* The Standalone Context penalty lowers the score, and the editorial review station displays the dialogue context.
2. **Slow-Burn Arcs >60s (False Negatives):** High-tension confrontations taking 75–90 seconds to escalate from dialogue to action are rejected by the 60s hard limit. *Mitigation:* Multi-segment stitching allows combining the opening accusation and final slap, dropping mundane intermediate lines.
3. **Dialogue-Free Action Hooks:** Cues where dramatic tension is purely visual (e.g., character silently draws a dagger or collapses) can be underscored by text LLMs. *Mitigation:* Screenplay parser explicitly tags `**ACTION:**` and camera directions as first-class cues.

---

## 5. AI Tooling Disclosure: Where AI Got It Wrong

Per assignment instructions, we utilized AI tools (ChatGPT, Claude, Gemini, Cursor) during development:
- **Where AI Got It Wrong:** When tasked with validating timestamps, LLMs consistently hallucinated mathematical time differences (e.g., claiming `00:48.30` minus `00:12.10` was `45.0` seconds) and attempted to generate timestamps that did not exist in the screenplay. Furthermore, Gemini repeatedly returned root-level JSON arrays rather than structured object schemas. 
- **The Solution:** We stripped mathematical logic away from the LLM entirely, enforcing timestamp math and schema normalization through deterministic Pydantic validators and Python regex state machines.

---

## 6. How We Know It Worked in Production

Once deployed to a real editorial team:
1. **Time-to-Publish Metric:** Editor review time drops from **2.5 hours per show** (watching 50 episodes) to **<15 minutes** (reviewing top-ranked, pre-clipped candidates).
2. **Conversion Feedback Loop:** Approval/rejection decisions are stored in SQLite/PostgreSQL. Discarded candidates feed an active rejection dataset to continuously refine prompt few-shot exemplars.
