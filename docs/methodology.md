# ReelFinder AI — Methodology & Viral Selection Mechanics

## 1. The Microdrama Promotional Problem

In microdramas (1–2 minute vertical episodes), organic reach and paid acquisition on TikTok, Meta Reels, and YouTube Shorts depend on user watch-through rate in the first 3 seconds and conversion at the 30–50 second mark.

Editors manually watch hundreds of episodes to find:
1. **The 3-Second Hook:** A physical slap, explosive reveal, or shocking confrontation that stops a user from swiping away.
2. **The Unresolved Cliffhanger:** Cutting the promo precisely before the truth is revealed, identity confirmed, or consequence executed.
3. **Standalone Narrative:** The ad must make sense to an audience that has never watched the series before.

---

## 2. Multi-Stage Pipeline Methodology

```
Parsed Screenplay
       │
       ▼
1. Context Segmentation ─── Groups dialogues into candidate narrative arcs
       │
       ▼
2. AI Discovery ─────────── LLM identifies emotional peaks, hooks, & cliffhangers
       │
       ▼
3. Deterministic Python ─── Validates timestamps, duration (20-60s), & snaps cues
       │
       ▼
4. Composite Scoring ────── Computes 5-factor weighted score (0-100 scale)
       │
       ▼
5. Editorial Review ─────── Human-in-the-loop approves, rejects, or modifies
```

---

## 3. Explainable 5-Factor Ranking Formula

Scores across 5 narrative dimensions are generated on a 1–10 scale:

$$\text{Weighted Sum} = w_1 \cdot \text{Hook} + w_2 \cdot \text{Cliffhanger} + w_3 \cdot \text{Standalone} + w_4 \cdot \text{Impact} + w_5 \cdot \text{Continuity}$$

Where:
- $w_{\text{hook}} = 0.25$ ($25\%$): Immediate impact within the first 3 seconds.
- $w_{\text{cliffhanger}} = 0.25$ ($25\%$): Curiosity gap created by the final cutoff.
- $w_{\text{standalone}} = 0.20$ ($20\%$): Clarity for a completely new viewer.
- $w_{\text{impact}} = 0.15$ ($15\%$): Emotional intensity (betrayal, shock, outrage).
- $w_{\text{continuity}} = 0.15$ ($15\%$): Dialogue flow without confusing jumps.

### Base Score & Penalty Adjustments
$$\text{Base Score} = 10 \times \text{Weighted Sum} \quad (\text{Range: } 0 - 100)$$

- **Valid Status:** No penalty ($\text{Overall} = \text{Base Score}$).
- **Warning Status (e.g. timestamp snapping required):** $-5.0$ penalty.
- **Invalid Status (e.g. duration out of bounds):** $-30.0$ penalty.

---

## 4. Prompt Engineering Strategy

- **Role Priming:** Instructs the model as a Senior Microdrama Promo Strategist familiar with ReelShort and DramaBox ad structures.
- **Structured Schema Enforcement:** Response mime-type set to `application/json` conforming to `AIPromoDiscoveryResponse`.
- **Verbatim Anchor Requirement:** Demands verbatim start and end timestamps directly from the input text rather than arbitrary numbers.
