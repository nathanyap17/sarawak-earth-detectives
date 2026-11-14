# Cloud Run image for the FastAPI backend. AI-assisted: scaffolded with Claude Code.
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /usr/local/bin/uv
WORKDIR /srv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY app ./app
ENV PORT=8080 APP_ENV=cloud DATA_BACKEND=gcs
CMD ["sh", "-c", "uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
