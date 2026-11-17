# Deploying ReelFinder AI on Render (Free & Easy Guide)

This guide walks you through deploying **ReelFinder AI** on [Render](https://render.com) using the included `render.yaml` Blueprint or via the Render Web Dashboard.

---

## Method 1: Instant 1-Click Blueprint (Recommended)

Render's Blueprint feature automatically reads [`render.yaml`](../render.yaml) in your repository and provisions:
1. **Managed PostgreSQL Database** (Free)
2. **Backend Web Service** (FastAPI on Python 3.11)
3. **Frontend Static Site** (React + Vite with automatic SPA routing and backend proxy)

### Step 1: Push Repository to GitHub
Make sure your latest code is committed and pushed:
```bash
git add .
git commit -m "feat: configure render deployment blueprint"
git push origin main
```

### Step 2: Open Render Dashboard
1. Go to [dashboard.render.com](https://dashboard.render.com).
2. Sign in with your GitHub account.

### Step 3: Create Blueprint
1. Click the **"New +"** button in the top right.
2. Select **"Blueprint"**.
3. Connect your GitHub repository: `nitin-code6/reelfinder-ai` (or your repo name).
4. Render will detect the `render.yaml` file and show the 3 resources:
   - `reelfinder-db` (PostgreSQL)
   - `reelfinder-backend` (Web Service)
   - `reelfinder-frontend` (Static Site)

### Step 4: Add Your AI API Keys
In the Blueprint configuration screen, Render will prompt you for the un-synced secrets:
- `GROQ_API_KEY`: Paste your primary Groq key (`gsk_...`)
- `GROQ_API_KEY_2`: Paste your secondary backup Groq key (optional, for rate limit rotation)
- `GEMINI_API_KEY`: Paste your Gemini key (`AIza...`)
- `GEMINI_API_KEY_2`: Paste your secondary backup Gemini key (optional)

### Step 5: Click "Apply"
Render will automatically build and deploy:
1. The database initializes in ~30 seconds.
2. The backend builds and runs database migrations automatically on startup.
3. The frontend builds and connects automatically to the backend URL via `VITE_API_URL`.

Once finished, click the `reelfinder-frontend` URL (e.g., `https://reelfinder-frontend.onrender.com`) to use the live app!

---

## Method 2: Manual Dashboard Setup (If preferred)

If you prefer to configure each service manually in Render without Blueprints:

### Step 1: Create PostgreSQL Database
1. Click **New +** -> **PostgreSQL**.
2. **Name**: `reelfinder-db`
3. **Plan**: `Free`
4. Click **Create Database**.
5. Once created, copy the **Internal Database URL** (e.g. `postgres://promofinder:...`).

### Step 2: Create Backend Web Service
1. Click **New +** -> **Web Service**.
2. Connect your GitHub repo.
3. Settings:
   - **Name**: `reelfinder-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: `Free`
4. In **Environment Variables**, add:
   - `DATABASE_URL`: Paste the Internal Database URL from Step 1.
   - `GROQ_API_KEY`: Your Groq API key.
   - `GEMINI_API_KEY`: Your Gemini API key.
   - `ENVIRONMENT`: `production`
5. Click **Create Web Service**.
6. Copy your live backend URL (e.g. `https://reelfinder-backend.onrender.com`).

### Step 3: Create Frontend Static Site
1. Click **New +** -> **Static Site**.
2. Connect your GitHub repo.
3. Settings:
   - **Name**: `reelfinder-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. In **Redirects / Rewrites**:
   - **Type**: `Rewrite`
   - **Source**: `/*`
   - **Destination**: `/index.html`
5. In **Environment Variables**:
   - `VITE_API_URL`: Paste your backend URL from Step 2 (e.g. `https://reelfinder-backend.onrender.com`).
6. Click **Create Static Site**.

---

## Live Application Verification

Once deployed:
1. Open your frontend URL (`https://reelfinder-frontend.onrender.com`).
2. Go to **Library** (`/shows`). The default show and episodes will be ready.
3. Click **"Re-process All"** or upload a new screenplay ZIP to test end-to-end AI discovery.
4. Go to **Promos** and test the 1-Click editorial approval and CSV/JSON downloads.
