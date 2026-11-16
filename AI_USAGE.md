# AI Usage & Disclosure

In accordance with the Kuku FM AI Generalist assignment guidelines, this document transparently records the AI tools used, their operational scope, specific failure instances encountered, and how those mistakes were identified and corrected.

---

## 1. AI Tools Utilized

| Tool / Provider | Primary Responsibility |
|---|---|
| **Google Gemini (API)** | Structured narrative analysis, viral hook identification, and cliffhanger tension discovery from screenplay transcripts. |
| **Antigravity / Gemini 3.8 Flash** | Architecture design, Python backend engineering, React dashboard development, and test suite implementation. |

---

## 2. Where the AI Got It Wrong & How It Was Corrected

### Critical Mistake Encountered: Duration Hallucination & Timestamp Creep
- **The AI's Mistake:** During initial prompt generation for candidate discovery, the LLM was asked to identify a high-stakes dramatic confrontation. The model selected a confrontation starting at the opening threshold (`00:01.00`) and ending at the cliffhanger drone peak (`02:17.50`), resulting in a total clip duration of **136.5 seconds**. Despite the prompt explicitly requesting 20–60 second clips, the LLM hallucinated that this was a "tight, punchy promo."
- **How It Was Detected:** Our deterministic Python validator (`TimestampValidator`) calculated the exact duration ($\Delta t = 136.5\text{s}$), recognized that $136.5 > 60.0$, immediately flagged the candidate as `invalid`, recorded the limitation: `"Duration 136.5s exceeds maximum promo limit (60.0s)"`, and applied a 30-point scoring penalty.
- **How It Was Corrected:** 
  1. We adjusted the `SceneSegmenter` to pre-slice candidate windows strictly within 20.0 to 60.0 seconds before feeding them as potential anchor points.
  2. We enforced a two-tier guardrail: the LLM is only permitted to suggest boundaries within candidate windows, and the deterministic Python code retains final veto power over timecode validity.
