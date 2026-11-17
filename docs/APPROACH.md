# ReelFinder AI — Problem-Solving Approach & Methodology

## 1. Problem Definition & Operational Context

In the microdrama ecosystem (platforms like Kuku TV, ReelShort, and DramaBox), series are published in vertical 1-to-2 minute episodes, often spanning 50 to 100 episodes per series. 

User acquisition on social platforms (TikTok, Instagram Reels, YouTube Shorts) relies heavily on short promotional video ads. These promos are not trailers in the traditional film sense; they are exact, unedited narrative moments taken directly from the show itself.

A successful promotional clip must satisfy four non-negotiable criteria:
1. **A 3-Second Hook:** An immediate stimulus (a physical slap, a public accusation, an unmasking, or a shocking revelation) that halts a scrolling viewer before they swipe away.
2. **An Unresolved Cliffhanger:** The clip must cut abruptly at the moment of highest dramatic tension—before the truth is explained, the apology accepted, or the consequence revealed.
3. **Standalone Comprehension:** A viewer who has never heard of the series must understand who the victim is, who the antagonist is, and what is at stake within seconds.
4. **Strict Duration (20 to 60 seconds):** Clips under 20 seconds fail to build narrative investment; clips over 60 seconds experience severe completion rate drop-off in ad auctions.

Today, editorial teams watch every episode manually to identify these moments. ReelFinder AI was built to analyze screenplay text and surface ranked, grounded, and verified candidates so editors can review and approve them in seconds.

---

## 2. Core Assumptions

1. **Screenplay Text as Ground Truth:** All candidate timestamps must anchor directly to existing cues in the script. The system must never guess or fabricate timecodes.
2. **Human-in-the-Loop:** AI scores and boundaries are recommendations to prioritize editor attention, not autonomous publishing decisions.
3. **Format Heterogeneity:** Real-world screenplays vary across production houses. Some use bracketed timecodes `[MM:SS.ss]`, some use parentheses `(00:15.50)`, and others format scene headings differently. The parser must ingest these robustly without throwing unhandled exceptions.
4. **Multi-Segment Discovery:** While continuous stretches are common, high-performing promos often combine two separate beats (e.g., an inciting provocation in Scene 1 stitched with a dramatic confrontation in Scene 3). The system must support multi-segment promos while verifying chronological order and cumulative duration.

---

## 3. What We Gave to Code vs. AI

| System Dimension | Handled by AI | Handled by Deterministic Code | Rationale |
|---|---|---|---|
| **Narrative Semantics** | Evaluates emotional tension, betrayal stakes, curiosity gaps, and dramatic irony. | Does not attempt subjective literary analysis. | Large language models excel at contextual comprehension and tone analysis. |
| **Timecodes & Arithmetic** | Proposes candidate start and end anchors. | **Strictly enforces:** Normalization, $\Delta t = \text{end} - \text{start}$, $20\text{s} \le \text{duration} \le 60\text{s}$, and $\text{start} < \text{end}$. | LLMs are notoriously unreliable at arithmetic and boundary math; deterministic rules guarantee 100% adherence. |
| **Source Grounding** | Selects verbatim dialogue and action cues. | Snaps approximate timecodes ($\le 0.5\text{s}$ tolerance) to verbatim screenplay cues; flags invented timecodes ($>1.0\text{s}$). | Prevents hallucinated timestamps from entering post-production editing pipelines. |
| **Deduplication** | Identifies narrative hooks across scenes. | Computes Jaccard word similarity and temporal overlap ratios ($\ge 75\%$). | Algorithms cleanly filter near-duplicate candidates covering the same story beat. |
| **Composite Ranking** | Scores raw qualitative factors (1–10). | Computes normalized 0–100 weighted score and applies penalty deductions. | Ensures transparent, explainable, and reproducible candidate rankings. |

---

## 4. Explainable 5-Factor Ranking Formula

Every candidate is evaluated across five narrative dimensions, each scored from 1.0 to 10.0:

1. **Hook Strength ($w_{\text{hook}} = 0.25$ / $25\%$):** Evaluates the opening 3 seconds. Rewards physical action, high-volume accusations, or shocking visual cues.
2. **Cliffhanger Suspense ($w_{\text{cliff}} = 0.25$ / $25\%$):** Measures the size of the unanswered question at the cutoff point.
3. **Standalone Context ($w_{\text{standalone}} = 0.20$ / $20\%$):** Assesses whether the core conflict is self-evident to a brand-new viewer without lore exposition.
4. **Emotional Impact ($w_{\text{impact}} = 0.15$ / $15\%$):** Gauges the visceral reaction (outrage, heartbreak, vindication) evoked by the scene.
5. **Narrative Continuity ($w_{\text{continuity}} = 0.15$ / $15\%$):** Verifies that dialogue transitions flow smoothly without jarring or confusing gaps.

### Formula & Penalty Engine

$$\text{Base Score} = 10 \times \left( 0.25 \cdot H + 0.25 \cdot C + 0.20 \cdot S + 0.15 \cdot E + 0.15 \cdot N \right)$$

Where:
- $H$ = Hook Strength (0.0 – 10.0)
- $C$ = Cliffhanger Suspense (0.0 – 10.0)
- $S$ = Standalone Context (0.0 – 10.0)
- $E$ = Emotional Impact (0.0 – 10.0)
- $N$ = Narrative Continuity (0.0 – 10.0)

**Validation Penalty Adjustments:**
- **Valid Status:** No penalty applied ($\text{Final Score} = \text{Base Score}$).
- **Warning Status (e.g., cue snapping required or minor evidence note):** $-5.0$ point deduction.
- **Invalid Status (e.g., duration out of bounds or invented timecodes):** $\text{Final Score} = 0.0$ (candidate rejected from ranking consideration).

---

## 5. Multi-Segment Selection Mechanics

Promos joining multiple moments (whether from the same episode or across consecutive episodes) follow strict structural rules:
1. **Cumulative Duration:** The sum of all segment durations across narrative gaps must strictly adhere to $20.0\text{s} \le \sum \text{duration}_i \le 60.0\text{s}$.
2. **Segment Floor:** Every individual segment must be at least $3.0\text{s}$ to avoid micro-fragmentation.
3. **Chronological Ordering:** Segments must progress chronologically: $\text{start}_k \ge \text{end}_{k-1}$.
4. **No Overlaps:** Any temporal overlap between segments causes the candidate to be rejected as `invalid`.
5. **Episode Mapping Grounding:** Every segment retains its explicit source episode number and filename, ensuring that video editors can retrieve footage without confusion.
