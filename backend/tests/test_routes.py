"""Route tests: Gate 2 (a real stamp from the API) and the answer-key leak guard (rule 3).
Needs the vault built: uv run python -m app.vault.build && uv run python -m app.casework
AI-assisted: written with Claude Code."""
import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.vault.store import root

pytestmark = pytest.mark.skipif(not (root() / "index.json").exists(), reason="vault not built")
client = TestClient(app)


def _session():
    r = client.post("/sessions", json={"case_id": "001", "nickname": "Tester"})
    assert r.status_code == 200
    return r.json()["id"]


def test_cases_list_hides_answer_material():
    r = client.get("/cases")
    assert r.status_code == 200
    body = json.dumps(r.json())
    for secret in ("red_herrings", "main_cards", "hints", "per_card", "overall", "worse_when"):
        assert secret not in body


def test_gate2_real_stamp():
    sid = _session()
    r = client.post(f"/sessions/{sid}/analyse",
                    json={"session_id": sid, "card_id": "soil_dry3", "tool": "scales"})
    assert r.status_code == 200
    j = r.json()
    assert j["stamp"] in {"significant", "not_significant", "needs_more_years"}
    assert j["mission"] and j["data_as_of"] and j["n_years"] >= 20


def test_all_tools_run():
    sid = _session()
    for tool in ["magnifier", "season", "ruler", "scales", "elnino", "twin"]:
        r = client.post(f"/sessions/{sid}/analyse",
                        json={"session_id": sid, "card_id": "humidity_feb_apr", "tool": tool})
        assert r.status_code == 200, (tool, r.text)
    assert r.json()["twin"]["region_id"] == "south-west"


def test_card_outside_case_rejected():
    sid = _session()
    r = client.post(f"/sessions/{sid}/analyse",
                    json={"session_id": sid, "card_id": "hot_days", "tool": "scales"})
    assert r.status_code == 400


def test_no_route_serves_answer_keys():
    paths = [getattr(r, "path", "") for r in app.routes]
    assert not any("answer" in p or "key" in p for p in paths)


def test_vault_health():
    j = client.get("/vault/health").json()
    assert j["regions"]["north-peat"]["data_as_of"] == "2026-11-10"
