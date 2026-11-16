# ReelFinder AI — 50-Episode Benchmark & Quality Evaluation

## 1. Evaluation Dataset Overview

- **Series Tested:** *I Married a Broken Soldier. He was a Duke* (Kuku FM confidential input pack).
- **Scope:** First 50 serialized episodes.
- **Input Format:** Structured screenplay cue-sheets with explicit camera directions, action descriptions, and character dialogue with timecodes (`MM:SS.ss`).
- **Benchmark Script:** `backend/scripts/run_batch_evaluation.py`.
- **Raw Unedited Output:** `outputs/raw_outputs_50_episodes.json`.

---

## 2. Quantitative Performance & Compliance

| Metric | Result | Benchmark Target | Compliance |
|---|---|---|---|
| **Total Episodes Processed** | 50 | 50 | 100% |
| **Total Promos Generated** | 50 | 50 | 100% |
| **Duration Compliance (20s - 60s)** | 50 / 50 | 100% | **Passed** |
| **Valid Timestamp Fidelity** | 100% | > 95% | **Passed** |
| **Average Promo Duration** | 25.8s | 20s - 60s | **Optimal** |
| **Average Composite Score** | 90.2 / 100 | > 80.0 | **High Quality** |
| **Processing Speed** | ~0.02s / episode (local) | < 5s / episode | **High Throughput** |

### Duration Distribution
- **20s to 30s:** 49 promos ($98\%$) — optimal for TikTok & Instagram Reels.
- **30s to 45s:** 1 promo ($2\%$) — high-tension multi-beat confrontation.
- **45s to 60s:** 0 promos.
- **Out of bounds (<20s or >60s):** 0 promos ($0\%$).

---

## 3. Detailed Quality Evaluation: Where Does the Tool Pick Badly?

A core evaluation requirement of the Kuku assignment is: **"Check quality. Where does your tool pick badly?"**

Through rigorous inspection across the 50 episodes, three distinct failure modes and edge cases were identified:

### Failure Mode 1: Lore-Dependent Climax (False Positive)
- **Problem:** In later episodes (e.g. Episodes 28–34), climactic confrontations hinge on knowledge of a forged will or illegitimate birth revealed 15 episodes prior.
- **Tool Behavior:** The AI scores the confrontation high on Hook and Cliffhanger because of aggressive language and shouts, but gives an over-generous score for Standalone Context.
- **Editor Impact:** A scrolling viewer has no idea why the forged will matters, reducing conversion.
- **System Mitigation:** The editor review dashboard allows human editors to flag "Lacks Standalone Context" and downgrade the recommendation.

### Failure Mode 2: Slow-Burn Build-ups (>60s Arc) (False Negative)
- **Problem:** Masterfully acted scenes where the psychological confrontation unfolds gradually over 85 seconds.
- **Tool Behavior:** The strict 60-second duration validator cuts off either the initial provocation or the final slap.
- **Solution:** Multi-segment promo construction (stitching Scene A's provocation with Scene B's payoff), which requires human-in-the-loop oversight to ensure visual continuity.

### Failure Mode 3: Action-Only Hooks with Silent Characters
- **Problem:** An episode opens with a dramatic camera crane shot of a shattered carriage, but character dialogue does not begin until second 12.
- **Tool Behavior:** If relying primarily on dialogue transcripts, the tool risks missing high-impact visual action hooks.
- **Solution:** Our screenplay parser explicitly extracts `**CAMERA:**` and `**ACTION:**` cues alongside dialogue, ensuring visual slap/confrontation beats are surfaced.
