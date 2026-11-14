"""FastAPI entry point. Routes per MASTER_SHEET §9 are added under app/api/.
AI-assisted: scaffolded with Claude Code."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings

settings = get_settings()

app = FastAPI(title="Sarawak Earth Detectives API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "env": settings.app_env, "data_backend": settings.data_backend}
