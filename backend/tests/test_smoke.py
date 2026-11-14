"""Smoke tests. Known-answer tests for app/analysis go in tests/test_analysis_known_answers.py.
AI-assisted: scaffolded with Claude Code."""
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import CasePack


def test_health():
    r = TestClient(app).get("/health")
    assert r.status_code == 200 and r.json()["ok"] is True


def test_case_packs_validate():
    from app.config import get_settings
    for p in get_settings().cases_dir.glob("*.json"):
        CasePack.model_validate_json(p.read_text(encoding="utf-8"))
