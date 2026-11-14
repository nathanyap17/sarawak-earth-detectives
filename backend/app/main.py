"""FastAPI entry point. Routes per MASTER_SHEET §9 are added under app/api/.
AI-assisted: scaffolded with Claude Code."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import get_settings
from app.vault.store import load_index

settings = get_settings()

app = FastAPI(title="Sarawak Earth Detectives API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(router)


@app.get("/vault/health")
def vault_health() -> dict:
    """Freshness of every source (rule 6)."""
    idx = load_index()
    return {"built_at": idx.get("built_at"), "enso": idx.get("enso"),
            "regions": {rid: {"data_as_of": next(iter(r["cards"].values()))["data_as_of"],
                              "land_points": len(r["land_points"]), "cards": list(r["cards"])}
                        for rid, r in idx.get("regions", {}).items()}}


@app.get("/health")
def health() -> dict:
    return {"ok": True, "env": settings.app_env, "data_backend": settings.data_backend}
