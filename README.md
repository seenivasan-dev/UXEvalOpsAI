# EvalOps AI — Multi-Agent UX Evaluation Platform

> A production-style AI agent platform that evaluates UI screenshots using 4 parallel LangChain agents, demonstrating Parallelization, Reflection, Tool Use, and Orchestrator-Synthesis patterns.

---

## Architecture Overview

```
Frontend (Lit Web Components)
    ↓ POST /api/evaluations/upload
Backend (Node.js + Express + BullMQ)
    ↓ enqueues job to Redis
BullMQ Worker
    ↓ spawns Python subprocess
Python Agent Pipeline (LangChain + Azure OpenAI)
    ├── Visual Hierarchy Agent
    ├── Accessibility Agent  ← Reflection Pattern (2-pass)
    ├── Copy and Tone Agent
    └── Design Consistency Agent
        ↓ asyncio.gather (Parallelization)
    Synthesis Agent           ← Tool Use + Orchestrator-Synthesis
        ↓ JSON result via stdout
Worker → PostgreSQL (Prisma)
Worker → Eval Service (FastAPI) → EvalScore
Frontend polls /api/evaluations/:id every 2s → displays report
```

## 4 Named AI Patterns (Interview Highlights)

| Pattern | Where | How |
|---|---|---|
| **Parallelization** | `coordinator.py` | `asyncio.gather` runs all 4 agents concurrently |
| **Reflection** | `agents/accessibility.py` | 2-pass: initial eval → LLM self-critique → improved output |
| **Tool Use** | `agents/synthesis.py` | `@tool calculate_weighted_score(...)` called before synthesis |
| **Orchestrator-Synthesis** | `coordinator.py` + `agents/synthesis.py` | Coordinator routes to 4 agents; Synthesis assembles holistic report |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Lit Web Components + Vite + TailwindCSS |
| Backend | Node.js + TypeScript + Express |
| Job Queue | BullMQ + Redis |
| Database | PostgreSQL + Prisma ORM |
| AI Agents | Python + LangChain + Azure OpenAI GPT-4o |
| Eval Service | Python + FastAPI |
| Deploy | Render (backend+worker) + Vercel (frontend) + Neon + Upstash |

---

## Local Development

### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker Desktop

### 1. Start infrastructure
```bash
docker compose up -d
```

### 2. Install dependencies
```bash
npm install
pip3 install -r python-agents/requirements.txt
pip3 install -r eval-service/requirements.txt
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env — set DATABASE_URL, REDIS_URL, and LLM keys
cp apps/backend/.env.example apps/backend/.env
cp python-agents/.env.example python-agents/.env
# Set AZURE_OPENAI_API_KEY + AZURE_OPENAI_ENDPOINT (or OPENAI_API_KEY)
```

### 4. Database setup
```bash
npm run db:migrate
npm run db:seed
```

### 5. Start all services
```bash
# Terminal 1 — Backend API
npm run dev --workspace=apps/backend

# Terminal 2 — BullMQ Worker
npm run worker --workspace=apps/backend

# Terminal 3 — Python Eval Service
cd eval-service && uvicorn main:app --reload --port 8000

# Terminal 4 — Frontend
npm run dev --workspace=apps/frontend
```

Frontend: http://localhost:5173  
Backend API: http://localhost:3001  
Eval Service: http://localhost:8000/docs  

---

## Using a Standard OpenAI Key (No Azure)

In `python-agents/.env`:
```
# Comment out Azure vars:
# AZURE_OPENAI_API_KEY=...
# AZURE_OPENAI_ENDPOINT=...

# Add:
OPENAI_API_KEY=sk-...
```

The `create_llm()` function in `agents/base.py` auto-detects which key is available.

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/evaluations/upload` | Upload image, returns pending job |
| `GET` | `/api/evaluations` | List all evaluations |
| `GET` | `/api/evaluations/:id` | Get full evaluation + agent results |
| `DELETE` | `/api/evaluations/:id` | Delete evaluation |
| `GET` | `/api/evaluations/telemetry/summary` | Platform metrics |
| `POST` | `/api/reviews` | Submit human review (approve/reject/escalate) |
| `GET` | `/api/reviews/pending` | List evaluations awaiting review |
| `GET` | `/health` | Health check |

---

## Deployment (Free Tier, ~$0-15/month)

| Service | Provider | Cost |
|---|---|---|
| PostgreSQL | Neon (free tier) | $0 |
| Redis | Upstash (free tier) | $0 |
| Backend + Worker | Render (free tier) | $0 (spins down after inactivity) |
| Frontend | Vercel (free tier) | $0 |

### Steps
1. Create Neon DB → copy connection string
2. Create Upstash Redis → copy connection string
3. Push repo to GitHub
4. Connect GitHub to Render → select `render.yaml` → set env vars
5. Connect GitHub to Vercel → select `apps/frontend` → deploy

---

## Project Structure

```
.
├── apps/
│   ├── backend/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   └── src/
│   │       ├── config/
│   │       ├── jobs/           # BullMQ queue + worker
│   │       ├── middleware/
│   │       ├── routes/
│   │       ├── services/
│   │       ├── telemetry/
│   │       └── index.ts
│   └── frontend/
│       └── src/
│           ├── components/     # Lit Web Components
│           ├── pages/
│           ├── services/
│           └── app-shell.ts
├── python-agents/
│   ├── agents/
│   │   ├── base.py             # LLM factory (Azure/OpenAI)
│   │   ├── visual_hierarchy.py
│   │   ├── accessibility.py    # Reflection pattern
│   │   ├── copy_tone.py
│   │   ├── consistency.py
│   │   └── synthesis.py        # Tool Use + Orchestrator-Synthesis
│   ├── coordinator.py          # Parallelization pattern
│   └── main.py                 # stdin/stdout bridge
├── eval-service/
│   ├── routers/
│   │   ├── evaluate.py         # Completeness + schema scoring
│   │   └── metrics.py          # Trend metrics
│   └── main.py
├── docker-compose.yml
├── render.yaml
└── package.json                # npm workspaces root
```
