"""The case desk: checklist, draft, answer key in code, human approval (rules 1, 3, 4).
No network and no model: headlines are handed in, agents are mocked (conftest).
AI-assisted: written with Claude Code."""
import asyncio
import json

import pytest
from fastapi.testclient import TestClient

from app.agents import scout
from app.agents.scout import Headline
from app.main import app
from app.vault.store import root

pytestmark = pytest.mark.skipif(not (root() / "index.json").exists(), reason="vault not built")
from tests.conftest import ADMIN

client = TestClient(app)

HEADS = [
    Headline("Heat wave: Kuching schools told to limit outdoor activities", "https://example.org/a", "2026-11-10", "Test Post", "Hot weather in Kuching this week."),
    Headline("Bintulu peat fire spreads to 40 hectares", "https://example.org/b", "2026-11-11", "Test Post", "Firefighters at work near Bintulu."),
    Headline("Floods hit Miri after heavy rain", "https://example.org/c", "2026-11-11", "Test Post", ""),
    Headline("Premier opens new bridge in Sibu", "https://example.org/d", "2026-11-12", "Test Post", ""),
    Headline("Drought worsens in Kenya", "https://example.org/e", "2026-11-12", "Test Post", ""),
]


def test_checklist_sorts_headlines():
    kinds = [scout.classify(h) for h in HEADS]
    assert kinds[0][:2] == ("heat", "south-west") and kinds[0][2] == ""
    assert kinds[1][:2] == ("fire", "north-peat")
    assert "rain record" in kinds[2][2]
    assert kinds[3][2] == "not a weather or land event"
    assert kinds[4][2] == "not in Sarawak"


def test_feed_parser_keeps_headline_fields_only():
    xml = """<rss><channel><title>Test Post</title><item><title>Haze in Miri</title>
    <link>https://example.org/x</link><pubDate>Sun, 15 Nov 2026 07:18:22 +0000</pubDate>
    <description><![CDATA[<p>Air quality <b>dropped</b>.</p>]]></description></item></channel></rss>"""
    h = scout.parse_feed(xml, "x")[0]
    assert (h.title, h.date, h.source, h.summary) == ("Haze in Miri", "2026-11-15", "Test Post", "Air quality dropped .")


def test_run_drafts_a_case_that_students_cannot_see_until_a_human_approves():
    out = asyncio.run(scout.run(HEADS))
    # the Bintulu fire duplicates case 001 (fire, north-peat); the Kuching heat wave becomes a draft
    assert (out["drafted"][0]["type"], out["drafted"][0]["region"]) == ("heat", "south-west")
    assert all((d["type"], d["region"]) != ("fire", "north-peat") for d in out["drafted"])
    cid = out["drafted"][0]["id"]
    assert cid not in [c["id"] for c in client.get("/cases").json()]
    assert client.get(f"/cases/{cid}").status_code == 404
    assert client.post("/sessions", json={"case_id": cid, "nickname": "T"}).status_code == 404

    drafts = client.get("/admin/cases", headers=ADMIN).json()
    mine = next(d for d in drafts if d["case"]["id"] == cid)
    assert mine["case"]["status"] == "draft" and mine["key_overall"]
    assert mine["case"]["sources"][0]["url"] == "https://example.org/a"

    assert client.post(f"/admin/cases/{cid}/approve", headers=ADMIN).json()["status"] == "open"
    pub = client.get(f"/cases/{cid}")
    assert pub.status_code == 200
    body = json.dumps(pub.json())
    for secret in ("red_herrings", "main_cards", "hints", "per_card", "overall"):
        assert secret not in body
    # a student can now play it and be graded against the stored key
    sid = client.post("/sessions", json={"case_id": cid, "nickname": "T"}).json()["id"]
    r = client.post(f"/sessions/{sid}/analyse", json={"session_id": sid, "card_id": "hot_days", "tool": "scales"})
    assert r.status_code == 200 and r.json()["stamp"]
    # a second run does not draft the same case again
    again = asyncio.run(scout.run(HEADS))
    assert all((d["type"], d["region"]) != ("heat", "south-west") for d in again["drafted"])


def test_quiet_news_lets_an_unusual_reading_open_a_case(monkeypatch):
    flag = {"region": "Northern Sarawak (Bintulu to Miri)", "region_id": "north-peat", "card_id": "soil_dry3",
            "card": "Soil wetness (driest months)", "year": 2025, "z": -2.0, "side": "below"}
    monkeypatch.setattr(scout, "data_watch", lambda: {"checked": 1, "regions": 2, "unusual": [flag],
                                                      "data_as_of": "2026-11-10", "stale": False})
    out = asyncio.run(scout.run([]))
    assert [(d["type"], d["region"]) for d in out["drafted"]] == [("dry", "north-peat")]
    drafts = client.get("/admin/cases", headers=ADMIN).json()
    src = next(d for d in drafts if d["case"]["id"] == out["drafted"][0]["id"])["case"]["sources"][0]
    assert "NASA record" in src["title"] and src["url"].startswith("https://power.larc.nasa.gov")


def test_activity_feed_is_public_and_carries_no_secrets():
    r = client.get("/agency/activity")
    assert r.status_code == 200
    j = r.json()
    assert j["counts"]["open"] >= 1 and len(j["steps"]) == 5
    text = json.dumps(j)
    assert "Kuching schools told" not in text          # no raw headline
    assert "not_enough_evidence" not in text and "per_card" not in text
    agents = {e["agent"] for e in j["events"]}
    assert {"Scout", "Case Builder", "Editor", "Data desk"} <= agents


def test_admin_always_needs_the_key(monkeypatch):
    """No key, a wrong key, or no key configured: the desk stays shut, locally and in the cloud."""
    from app.config import get_settings

    st = get_settings()
    for env in ("local", "cloud"):
        monkeypatch.setattr(st, "app_env", env)
        monkeypatch.setattr(st, "admin_token", "s3cret")
        assert client.get("/admin/cases").status_code == 401
        assert client.get("/admin/cases", headers={"X-Admin-Token": "wrong"}).status_code == 401
        assert client.post("/admin/cases/x/approve").status_code == 401
        assert client.post("/admin/scout/run").status_code == 401
        assert client.get("/admin/cases", headers={"X-Admin-Token": "s3cret"}).status_code == 200
        monkeypatch.setattr(st, "admin_token", None)
        assert client.get("/admin/cases").status_code == 503
        assert client.get("/admin/cases", headers={"X-Admin-Token": ""}).status_code == 503
        assert client.post("/admin/scout/run").status_code == 503


def test_pins_can_be_replaced():
    sid = client.post("/sessions", json={"case_id": "001", "nickname": "T"}).json()["id"]
    client.post(f"/sessions/{sid}/log", json={"kind": "clue", "lonlat": [113.0, 3.1]})
    r = client.post(f"/sessions/{sid}/log", json={"kind": "pins", "pins": [[110.3, 1.5], [113.9, 4.4]]})
    assert r.status_code == 200
    from app.sessions import store

    assert store.get(sid).clue_pins == [[110.3, 1.5], [113.9, 4.4]]
