# ReelFinder AI — Known Limitations & Future Architecture

## 1. Current System Limitations

1. **Screenplay Format Dependency:**
   - The primary parser is optimized for structured microdrama cue-sheets (containing `**ACTION:**`, `**CAMERA:**`, and explicit timecode markers).
   - If fed traditional Hollywood formatted Fountain scripts without timecodes, timestamps must be estimated via dialogue word-count heuristics (approx. 2.5 words per second).

2. **LLM Boundary Drift:**
   - Raw generative models occasionally propose timecodes that land in between spoken syllables (e.g. `00:11.00` instead of `00:11.30`).
   - Our system mitigates this via deterministic Python snapping, but human review remains essential before final video rendering.

3. **Multi-Episode Continuity Stitching:**
   - While the data model fully supports multi-episode `promo_segments`, stitching clips across disparate episodes requires video-level audio and color matching that cannot be validated from text scripts alone.

---

## 2. Production Scalability Roadmap (10,000+ Episodes)

To scale ReelFinder AI across hundreds of parallel weekly microdrama releases:

1. **Asynchronous Distributed Queue:**
   - Introduce Redis and Celery to process episodes asynchronously in background worker pools.
   - Decouple file upload from LLM inference to handle API rate limits and spikes smoothly.

2. **Cloud Object Storage:**
   - Migrate local `uploads/` directory to Amazon S3 or Google Cloud Storage with presigned URLs.

3. **Provider Failover & Tiering:**
   - Implement an intelligent model router: use lightweight models (`gemini-1.5-flash`) for initial candidate discovery and larger models (`gemini-1.5-pro` / `claude-3-5-sonnet`) only for quality evaluation of top 5% candidates.
