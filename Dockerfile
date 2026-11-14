# Cloud Run image for the FastAPI backend (built by Cloud Build from the repo root).
# The vault (1.4 MB) and approved cases are baked in, so no NASA data is fetched at request time (rule 7).
# AI-assisted: written with Claude Code.
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.11.32 /uv /usr/local/bin/uv
WORKDIR /srv/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/app ./app
COPY cases /srv/cases
COPY data/vault /srv/data/vault
ENV PORT=8080 APP_ENV=cloud DATA_BACKEND=local SESSION_BACKEND=firestore PYTHONUNBUFFERED=1
CMD ["sh", "-c", "uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
