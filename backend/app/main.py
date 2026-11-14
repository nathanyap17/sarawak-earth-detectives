"""FastAPI entry point. Routes per MASTER_SHEET §9 are added under app/api/.
AI-assisted: scaffolded with Claude Code."""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import get_settings
from app.vault.store import load_index

settings = get_settings()
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")

@asynccontextmanager
async def lifespan(_: FastAPI):
    if not settings.mock_agents:  # warm the model in the background (cold start 10–27 s, EXP-6)
        from app.agents import partner
        from app.agents.runtime import warm
        from app.agents import chief
        loop = asyncio.get_running_loop()
        loop.create_task(warm("partner", partner.INSTRUCTION))
        loop.create_task(warm("chief", chief.INSTRUCTION))
    yield


app = FastAPI(title="Sarawak Earth Detectives API", version="0.1.0", lifespan=lifespan)
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
    return {"ok": True, "env": settings.app_env, "data_backend": settings.data_backend,
            "sessions": settings.session_backend, "model": settings.model_name,
            "mock_agents": settings.mock_agents}
