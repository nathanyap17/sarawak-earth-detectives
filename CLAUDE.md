# Sarawak Earth Detectives

A detective-agency web app for students: an AI client brings real cases about Sarawak's disasters and changing Earth, and the student solves them with NASA satellite data.

**Context:** NASA Space Apps 2026, challenge "Be An Earth System Trend Detective!". Build window 07:30 MYT Sat 14 Nov 2026 → submit by **21:00 MYT Sun 15 Nov 2026** (target 20:00). Required: open NASA / partner data; user selects variables, sees change over time, decides what/where/how much and whether it is significant. Demo ≤ 30 s with English subtitles; public links, no login; AI use disclosed.
**Team:** Nathan — CEO & CTO, the only developer (product, data, ML, agents, frontend, backend). Malcolm — CMO & CTO, pitch and technical support. Zoe — CMO & Media, video, visuals, slides.

> **Read `PLAN.md` before starting any task.** `MASTER_SHEET.md` is the single source of truth for the idea and the submission text (sections 1–7) and the build plan (8–22). `docs/PROJECT_SPEC.md` holds system design; `docs/DATA_MODEL.md` the contracts and Firestore schema; `docs/CREDENTIALS.md` every env var (names only); `docs/BUILD_LOG.md` what happened. If two documents disagree, the more recently dated correction wins — flag the conflict, don't silently pick one.

## The one-sentence product
The student does the science — chooses evidence, removes seasons, tests the trend, writes the verdict — and "not enough evidence" is a winning answer; the AI only finds cases and gives hints, code does every number.

## Stack
| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite; three.js via React Three Fiber + drei; Apache ECharts; Zustand |
| Hosting / auth / db | Firebase Hosting; Firebase Auth (anonymous); Cloud Firestore |
| Backend | Python 3.12, FastAPI, on Cloud Run (`uv` for env and deps) |
| Data | xarray, pandas; files in `data/vault` locally, Cloud Storage in cloud |
| Statistics | statsmodels, pymannkendall, SciPy (pure functions in `backend/app/analysis`) |
| AI | Gemini on Vertex AI via Google ADK (version pinned in `backend/pyproject.toml`) |

## Architecture
- `frontend/` — one React app. `src/beats/` holds the seven beats, shared by `src/lite/` (2D, built first) and `src/office/` (3D). `src/api/` is the only module that calls the backend.
- `backend/app/api/` routes · `analysis/` statistics (no I/O) · `vault/` ingest + region averaging · `agents/` ADK agents and tools · `reports/` case report.
- `cases/` approved CasePack JSON · `data/` downloaded data (never committed) · `infra/` deploy scripts.
- Diagram and routes: `MASTER_SHEET.md` §9.

## Non-negotiable rules
Full list with right/wrong examples: `.claude/skills/sed-rules/SKILL.md`.
1. **The AI never does the maths.** Every number shown comes from `analysis/`. A number guard blocks agent text containing a figure the code didn't produce.
2. **The Partner never sees the answer key** and never states a direction, rate or significance for the case's data.
3. **The AnswerKey never leaves the backend** (not to the browser, not to the Partner).
4. **No case reaches students without human approval** (`status: draft → open` only via the admin review route).
5. **Student safety:** anonymous nicknames only, no personal data, no student-to-student chat, Partner stays on topic.
6. **Every number shows its NASA mission and `data_as_of` date**; stale data is flagged.
7. **Never fetch NASA data during a request or demo.** Ingest caches to files; the API reads files.
8. **Known-answer tests pass** before any demo or deploy.
9. **Public link opens with no login** (sign-in is silent and anonymous).

## Conventions
- **One contract.** Pydantic models in `backend/app/schemas.py` are the source; frontend types in `frontend/src/api/types.ts` mirror them (generate from OpenAPI when possible). Change contracts only with a BUILD_LOG entry.
- **Configuration switches environments**, not code (`APP_ENV`, `DATA_BACKEND=local|gcs`, `MODEL_NAME`). Local must always keep working.
- **Deterministic around AI:** grading, stamps and the number guard are plain code. Agent loops have `max_iterations` and timeouts with a deterministic fallback.
- **Log every tool/agent call** (name, args, latency, result summary).
- **Times:** store UTC ISO-8601; display MYT (Asia/Kuching). Data dates are `YYYY-MM-DD`.
- **ADK:** read `.claude/skills/google-adk/SKILL.md` and grep `../adk-python` before writing agent code.
- **AI disclosure:** AI-assisted source files carry a one-line header note; README lists tools used.
- **Ownership:** Nathan runs logins, deploys and pushes. Claude prepares the exact command.

## Deployment targets
| | LOCAL | CLOUD |
|---|---|---|
| Frontend | `npm run dev` (Vite, :5173) | Firebase Hosting |
| Backend | `uv run uvicorn app.main:app --reload` (:8000) | Cloud Run (`asia-southeast1`) |
| Data | `data/vault/*.parquet` | Cloud Storage bucket |
| Model | Vertex AI (ADC) or `MOCK_AGENTS=1` | Vertex AI |

## Commands
```bash
cd backend && uv sync                       # install
cd backend && uv run python -m app.vault.build && uv run python -m app.casework   # build vault + answer keys
cd backend && uv run uvicorn app.main:app --reload --port 8000
cd backend && uv run pytest -q              # known-answer tests
cd frontend && npm install && npm run dev
cd frontend && npm run build
```

## What to never cut
The seven beats for case 001, real statistics in code, the student-written verdict, the Partner's "no answers" rule, lite mode.

## Shipping status
2026-11-14: repository initialised; nothing deployed. Only Nathan deploys or pushes.
