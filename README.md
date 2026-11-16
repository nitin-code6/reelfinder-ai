# ReelFinder AI — Automated Promo Discovery Engine for Microdramas

[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%2F%20SQLite-336791.svg)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)]()

> **Kuku AI Generalist Assignment | Problem 1: Find the Promos**  
> AI Promo Finder discovers, validates, scores, and ranks 20–60 second viral promotional clips from microdrama screenplays with verifiable timestamps, hook/cliffhanger analysis, and human-in-the-loop editorial approval.

---

## 🎯 Executive Summary

In fast-paced microdrama production (1–2 minute vertical episodes, 50–100 episodes per show), marketing teams manually comb through scripts to find high-converting ad hooks. 

**ReelFinder AI** automates this bottleneck by:
1. **Parsing** structured microdrama screenplays (TXT/PDF/ZIP) with microsecond timestamp fidelity.
2. **Context-aware segmentation** that isolates narrative tension arcs without mid-dialogue cutoffs.
3. **AI candidate discovery** using Google Gemini (with strict Pydantic schemas and mock fallbacks).
4. **Deterministic Python validation** guaranteeing start/end timestamps exist in the screenplay, run between 20–60 seconds, and contain a 3-second hook.
5. **Explainable 5-factor scoring** (Hook, Cliffhanger, Standalone Context, Emotional Impact, Narrative Continuity).
6. **Human-in-the-Loop review dashboard** for content editors to approve, reject, comment, and export promo playlists.

---

## 🏗️ Architecture Overview

```
Screenplay Upload (TXT / PDF / ZIP)
       │
       ▼
File Validation & Deduplication (SHA-256)
       │
       ▼
Screenplay Parser (Action, Camera, Dialogue & Timecodes)
       │
       ▼
Context-Aware Narrative Segmentation
       │
       ▼
AI Candidate Detection (Gemini 1.5 Flash / Pro)
       │
       ▼
Deterministic Timestamp & Duration Validator (Python)
       │
       ▼
Explainable Weighted Scoring & Ranking Engine
       │
       ▼
Relational Persistence (PostgreSQL / SQLite via SQLAlchemy)
       │
       ▼
Editor Review Dashboard (React + Tailwind + Vite)
       │
       ▼
Editorial Approval & Export (JSON / CSV)
```

---

## 🛠️ Tech Stack

- **Backend:** FastAPI, Python 3.10+, Pydantic v2, SQLAlchemy, Alembic, Uvicorn
- **AI Engine:** Google Gemini API (structured JSON output), custom decoupled LLM provider abstraction, deterministic Python validation
- **Screenplay Parser:** Regex state-machine parser for microdrama cue sheets, PyMuPDF (`fitz`), PyPDF
- **Frontend:** React 18, Vite, Tailwind CSS, Lucide React, Axios
- **Database:** PostgreSQL (production / Docker) / SQLite (zero-config local dev)
- **Containerization:** Docker, Docker Compose
- **Testing:** Pytest, FastAPI TestClient, unittest.mock

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

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 4. Running with Docker Compose
```bash
docker compose up --build
```

---

## 🔒 Confidentiality Notice
Proprietary screenplay datasets from Kuku FM are confidential and strictly excluded from version control via `.gitignore`. The repository includes synthetic sample screenplays for testing and reproducibility.
