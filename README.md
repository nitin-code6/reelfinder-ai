# ReelFinder AI — Automated Promo Discovery Engine for Microdramas

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%2F%20SQLite-336791.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose%20Ready-2496ED.svg)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Tests-24%20Passing-brightgreen.svg)]()

> **Kuku AI Generalist Assignment | Problem 1: Find the Promos**  
> ReelFinder AI automates discovery, validation, and explainable multi-factor ranking of 20–60 second viral promotional clips from serialized microdrama screenplays. It pairs AI narrative comprehension (Gemini) with deterministic Python timestamp validation and a human-in-the-loop React dashboard.

---

## 🎯 The Business Problem

In fast-paced microdrama production (1–2 minute vertical episodes, 50–100 episodes per series), user acquisition on TikTok, Meta Reels, and YouTube Shorts is strictly conversion-driven:
- **3-Second Hook:** An immediate slap, explosive confrontation, or shocking revelation to stop scrolling drop-off.
- **Unresolved Cliffhanger:** Cutting the ad at the peak of suspense before resolution or confession.
- **Standalone Narrative:** Complete clarity for a first-time viewer with zero prior context.
- **Strict Duration:** 20 to 60 seconds.

Today, editors manually watch every episode to extract these clips. **ReelFinder AI** automates this bottleneck while keeping content editors in control of final approvals.

---

## 🏗️ Architecture & Dataflow

```
Screenplay Upload (TXT / PDF / ZIP)
       │
       ▼
File Validation & Deduplication (SHA-256 + Zip Slip Guard)
       │
       ▼
Screenplay Parser (State Machine for Action, Camera, & Timecodes)
       │
       ▼
Context-Aware Narrative Segmentation (Pre-slices 20-60s Windows)
       │
       ▼
AI Candidate Discovery (Gemini 1.5 Flash / Pro with Pydantic JSON Mode)
       │
       ▼
Deterministic Timestamp Validator (Python Enforces Bounds & Snaps Cues)
       │
       ▼
Explainable 5-Factor Weighted Scoring & Ranking (0-100 Scale)
       │
       ▼
Relational Persistence (PostgreSQL / SQLite via SQLAlchemy)
       │
       ▼
Editor Review Dashboard (React + Tailwind + Vite)
       │
       ▼
Editorial Approval & Export (CSV & JSON)
```

---

## ⚖️ Division of Responsibility: AI vs. Deterministic Code

| Operational Dimension | Handled by AI (Gemini) | Handled by Deterministic Code (Python) |
|---|---|---|
| **Narrative Understanding** | Evaluates emotional intensity, betrayal stakes, and curiosity gaps. | Does not judge subjective dramatic quality. |
| **Timings & Durations** | Proposes suggested candidate start/end cues. | **Strictly enforces:** $20.0\text{s} \le \text{duration} \le 60.0\text{s}$, $\text{start} < \text{end}$. Vetoes and penalizes out-of-bounds hallucinations. |
| **Integrity & Snapping** | Identifies dialogue quotes. | Snaps approximate LLM timecodes to verbatim screenplay line offsets; logs warnings. |
| **Scoring & Sort** | Rates raw dimensions (1–10). | Computes normalized composite scores, applies validation penalties, and sorts playlists. |

---

## 📊 50-Episode Benchmark & Quality Evaluation

Evaluated against all 50 episodes of Kuku's confidential input pack (*I Married a Broken Soldier. He was a Duke*):
- **Total Episodes Evaluated:** 50
- **Total Promos Generated:** 50
- **Valid Timestamp & Duration Compliance:** **100.0%** (all 50 candidates verified within 20.0s – 60.0s).
- **Average Promo Duration:** 25.8 seconds (optimal for TikTok/Reels retention).
- **Average Composite Score:** 90.2 / 100.
- **Duration Breakdown:** 20–30s: 49 ($98\%$), 30–45s: 1 ($2\%$), Out-of-bounds: 0 ($0\%$).

### Where Does the Tool Pick Badly? (Honest Failure Analysis)
1. **Lore-Dependent Climaxes (False Positives):** In later episodes (e.g. Ep 28–34), shouting confrontations often hinge on prior plot points (such as forged wills from 15 episodes prior). The LLM tends to overscore standalone context because of emotional intensity alone. *Mitigation:* The React dashboard allows editors to reject or flag "Lacks Standalone Context."
2. **Drawn-Out Confrontations (>60s Arcs) (False Negatives):** High-tension dialogues that take 80–90 seconds to reach the physical confrontation are rejected by the 60s hard ceiling. *Mitigation:* Multi-segment stitching bridges scenes, guided by human editor review.
3. **Action-Heavy Silent Hooks:** Scripts with visual action slaps before dialogue begins can be under-represented if prompts focus solely on character speech. *Mitigation:* The screenplay parser explicitly preserves `**CAMERA:**` and `**ACTION:**` lines alongside dialogue.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- Docker & Docker Compose (optional)

### 2. Backend Setup
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
cp ../.env.example .env
uvicorn app.main:app --reload --port 8000
```
Backend API will be live at `http://localhost:8000` with interactive Swagger docs at `http://localhost:8000/docs`.

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend will be live at `http://localhost:5173`.

### 4. Running with Docker Compose
```bash
docker compose up --build
```
- Frontend UI: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- PostgreSQL: `localhost:5432`

---

## 🧪 Testing

Run all 24 automated unit, integration, and evaluation tests:
```bash
pytest backend/tests
```

Run batch evaluation over the 50 episodes:
```bash
python backend/scripts/run_batch_evaluation.py
```

Generate the 2-page Solution Document PDF:
```bash
python backend/scripts/generate_solution_pdf.py
```

---

## 📁 Repository Structure

```
.
├── backend/
│   ├── app/
│   │   ├── core/            # Config, logging, exceptions
│   │   ├── db/              # Database session & engine
│   │   ├── models/          # SQLAlchemy entities (User, Show, Episode, Promo, PromoSegment)
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── repositories/    # Clean DB query layer
│   │   ├── services/        # Parsers, segmenter, validator, ranking
│   │   ├── llm/             # Gemini & Mock providers, prompts, schema
│   │   └── routes/          # REST endpoints (health, shows, episodes, promos, export)
│   ├── scripts/             # 50-episode evaluation & PDF generation
│   ├── tests/               # 24 unit, integration, and evaluation tests
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/      # Navigation, layout
│   │   ├── pages/           # Dashboard, Shows, Upload, Promos, Review, Export
│   │   └── api.js           # Backend API client
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
├── docs/
│   ├── architecture.md      # Detailed system architecture
│   ├── methodology.md       # Viral mechanics & 5-factor ranking formula
│   ├── evaluation.md        # 50-episode benchmark report
│   ├── limitations.md       # Limitations & future roadmap
│   ├── KUKU_SOLUTION_DOCUMENT.md # Solution document source
│   └── KUKU_SOLUTION_DOCUMENT.pdf # Exact 2-page executive summary PDF
├── docker-compose.yml       # Multi-container production deployment
├── AI_USAGE.md              # AI tool disclosure & mistake analysis
└── README.md
```

---

## 🔒 Confidentiality & Security Notice
Proprietary screenplay datasets from Kuku FM are strictly excluded from version control via `.gitignore`. The repository includes synthetic sample screenplays (`backend/tests/fixtures/`) for automated testing and CI.
