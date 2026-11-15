"""Case study and executive summary: only after the case is closed, built from the session (never
the answer key), and the Reporter falls back to the code template when the model is off.
AI-assisted: written with Claude Code."""
import asyncio
import json

import pytest
from fastapi.testclient import TestClient

from app import casework
from app.agents import reporter
from app.main import app
from app.reports import casefile
from app.vault.store import root

pytestmark = pytest.mark.skipif(not (root() / "index.json").exists(), reason="vault not built")
client = TestClient(app)
VERDICT = {"what": "Peat dried out", "where": "Northern Sarawak", "direction": "worsening", "how_much": "a little",
           "is_it_real": "yes", "why_hypothesis": "drier soil each year", "confidence": 2}


def _played() -> str:
    sid = client.post("/sessions", json={"case_id": "001", "nickname": "Tester"}).json()["id"]
    client.post(f"/sessions/{sid}/choose", json={"cards": ["soil_dry3", "humidity_feb_apr"]})
    client.post(f"/sessions/{sid}/analyse", json={"session_id": sid, "card_id": "soil_dry3", "tool": "scales"})
    return sid


def _close(sid: str) -> None:
    for _ in range(2):   # the second attempt is final, whatever the ending
        g = client.post(f"/sessions/{sid}/verdict", json={"session_id": sid, **VERDICT}).json()
        if not g.get("can_retry"):
            return


def test_casefile_locked_until_closed():
    sid = _played()
    assert client.get(f"/sessions/{sid}/casefile").status_code == 409
    assert client.post(f"/sessions/{sid}/summary").status_code == 409


def test_casefile_has_the_trail_and_no_key():
    sid = _played(); _close(sid)
    r = client.get(f"/sessions/{sid}/casefile")
    assert r.status_code == 200
    cf = r.json()
    stages = [s["stage"] for s in cf["steps"]]
    assert stages[0] == "The call" and "Evidence locker" in stages and "The lab" in stages and "The deduction" in stages
    t = cf["tests"][0]
    assert t["card"] and t["stamp"] and t["mann_kendall_p"] and t["mission"]
    body = json.dumps(cf)
    for leak in ("red_herring", "main_cards", "answer_key", "elnino_stamp"):
        assert leak not in body


def test_summary_falls_back_to_template_and_is_kept():
    sid = _played(); _close(sid)
    a = client.post(f"/sessions/{sid}/summary").json()
    assert a["source"] in ("ai", "code") and set(a["sections"]) == set(reporter.SECTIONS)
    assert client.post(f"/sessions/{sid}/summary").json() == a
    assert client.get(f"/sessions/{sid}/casefile").json()["summary"] == a


def test_reporter_invented_number_falls_back(monkeypatch):
    sid = _played(); _close(sid)
    from app.sessions import store
    cf = casefile.build(store.get(sid), casework.load_case("001"))

    async def liar(*a, **k):
        return json.dumps({k: "Soil fell by 42.7 percent." for k in reporter.SECTIONS}), 0.4, ""
    monkeypatch.setattr(reporter, "run_once", liar)
    out, source, note = asyncio.run(reporter.summarise(cf, casefile.facts(cf)))
    assert source == "code" and note.startswith("guard") and "42.7" not in json.dumps(out)
