# ReelFinder AI — System Limitations & Production Roadmap

## 1. Honest Technical Limitations

Building an AI system for creative media production requires honesty about what software can and cannot determine from text alone.

### A. Screenplay Text vs. Video Footage Reality
- **The Limitation:** ReelFinder AI analyzes written screenplays. It cannot verify whether the recorded footage has the required lighting, camera focus, actor facial expressions, or sound quality.
- **Why It Matters:** A moment that reads brilliantly on paper (e.g., "Julian's eyes blaze with cold fury") may suffer on set due to weak acting delivery or poor camera angle execution.
- **Mitigation:** Screenplay discovery serves as a first-pass candidate filter. Final creative judgment remains with the human editor, who reviews the video footage corresponding to the suggested timestamps.

### B. Subjectivity of Viral Selection
- **The Limitation:** Different marketing channels and media buyers prioritize different creative angles. A dramatic slap might perform best on TikTok, while an emotional conversation about betrayal might convert better on YouTube Shorts.
- **Why It Matters:** AI ranking scores are heuristic recommendations designed to prioritize editorial attention, not objective mathematical ground truth.
- **Mitigation:** The application exposes granular 5-factor score breakdowns (Hook, Cliffhanger, Standalone, Emotional Impact, Continuity) so editors can filter candidates by the specific metric relevant to their current marketing campaign.

### C. Dependence on Screenplay Cue Structure
- **The Limitation:** The parser relies on structured cue-sheets (timecodes like `[MM:SS.ss]`, scene headers, and speaker labels). If fed un-timed prose treatments or Hollywood Fountain scripts without timestamps, timecodes must be approximated using dialogue word-count heuristics (approx. 2.5 words per second).
- **Why It Matters:** Approximated timestamps require manual adjustment in post-production.
- **Mitigation:** Our `TimestampValidator` explicitly flags any timestamp estimated via heuristics with a warning note in export records.

### D. Late-Episode Narrative Lore Dependencies
- **The Limitation:** In long serialized dramas (episodes 30–80), climaxes frequently resolve conflicts established dozens of episodes prior. The text analysis may recognize elevated dramatic tension but overestimate how understandable the scene is to a first-time viewer.
- **Mitigation:** Editorial review allows content managers to flag candidates with "Lacks Standalone Context" and downgrade their priority.

### E. Cloud AI Provider Dependencies
- **The Limitation:** Third-party cloud LLMs (Groq, Gemini) are subject to rate limits, network latency spikes, and external service outages.
- **Mitigation:** Our `HybridLLMProvider` implements multi-tier automatic failover (Groq primary -> Gemini secondary -> Heuristic offline fallback) and multi-key rotation to guarantee zero batch crashes.

---

## 2. Production Scalability Roadmap (10,000+ Episodes)

To scale ReelFinder AI from a single-show prototype to enterprise volume processing hundreds of weekly episodes:

### 1. Asynchronous Distributed Task Queue
- **Current State:** Batch processing runs synchronously via FastAPI route handlers.
- **Production Architecture:** Decouple ingestion and AI analysis using **Celery** or **ARQ** backed by **Redis**. Episodes are pushed onto a message queue, processed in parallel by worker pools, and status updates are streamed to the frontend via WebSockets or Server-Sent Events (SSE).

### 2. Cloud Object Storage for Media Assets
- **Current State:** Screenplays are uploaded to local container volumes (`uploads/`).
- **Production Architecture:** Store uploaded screenplays and generated exports in **Amazon S3** or **Google Cloud Storage** with short-lived presigned URLs.

### 3. Hierarchical Multi-Model Routing
- **Current State:** Evaluates candidates in a single pass using Groq or Gemini.
- **Production Architecture:** Implement a two-stage filter:
  - *Stage 1 (High Throughput / Low Cost):* Use lightweight models (`qwen/qwen3.8-27b` or `gemini-3.8-flash`) to scan all candidate windows and filter out mundane/low-tension scenes (the bottom $70\%$).
  - *Stage 2 (Deep Evaluation):* Route the top $30\%$ of candidate moments to larger frontier models (`openai/gpt-oss-120b` or Claude 3.5 Sonnet) for detailed hook/cliffhanger scoring.
  - *Economic Impact:* Reduces LLM token costs by $>80\%$ while maintaining frontier reasoning on top candidates.

### 4. Multimodal Video Alignment (Future Vision)
- Connect candidate screenplay timestamps to actual MP4 video files. Use computer vision (OpenCV / PyTorch) to detect shot changes and align audio speech recognition (Whisper) with screenplay dialogue, automatically producing rendered 9:16 video clips with subtitles.
