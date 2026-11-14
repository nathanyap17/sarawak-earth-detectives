"""Settings from the environment. Nothing is hard-coded (MASTER_SHEET §18).
AI-assisted: scaffolded with Claude Code."""
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(REPO_ROOT / ".env", ".env"), extra="ignore")

    app_env: Literal["local", "cloud"] = "local"
    allowed_origins: str = "http://localhost:5173"

    # Data Vault
    data_backend: Literal["local", "gcs"] = "local"
    data_dir: Path = REPO_ROOT / "data"
    cases_dir: Path = REPO_ROOT / "cases"
    gcs_bucket: str | None = None

    # Google Cloud / Vertex AI (ADK reads GOOGLE_* vars directly)
    google_cloud_project: str | None = None
    google_cloud_location: str = "asia-southeast1"
    model_name: str = "gemini-2.5-flash"
    mock_agents: bool = False

    # NASA / partner data (ingest jobs only, never at request time)
    firms_map_key: str | None = None
    earthdata_token: str | None = None

    # Cost guard
    partner_max_turns_per_session: int = 30
    partner_max_output_tokens: int = 200

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
