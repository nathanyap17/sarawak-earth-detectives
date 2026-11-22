"""Flood and heavy-rain cases: the desk opens them only where the rain record passed its cross-check
(EXP-11), the grader reads 'wetter' as the worse direction, and the map gets daily rain from code.
AI-assisted: written with Claude Code."""
import asyncio

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app import reasoning
from app.agents import scout
from app.agents.scout import Headline
from app.casework import build_answer_key_for, public_case
from app.main import app
from app.vault import enso
from app.vault.cards import CARDS, RAIN_PROVISIONAL, provisional_for
from app.vault.store import root
from tests.conftest import ADMIN

pytestmark = pytest.mark.skipif(not (root() / "index.json").exists(), reason="vault not built")
client = TestClient(app)

BINTULU = Headline("Devastating floods hit Bintulu, forcing hundreds to evacuate",
                   "https://www.theborneopost.com/2025/01/29/devastating-floods-hit-bintulu-forcing-hundreds-to-evacuate/",
                   "2025-01-29", "The Borneo Post", "Continuous heavy rain flooded parts of Bintulu.")
KUCHING = Headline("Floods in Kuching after hours of heavy rain", "https://example.org/k", "2026-11-12", "Test Post", "")


def test_rain_counts_only_where_it_passed_the_cross_check():
    card = CARDS["rain_nov_feb"]
    assert card.provisional == RAIN_PROVISIONAL
    assert provisional_for(card, "north-peat") is None          # EXP-11 passed in the north
    assert provisional_for(card, "south-west") == RAIN_PROVISIONAL  # and failed in the south
    for daily in ("heavy_rain_days", "wettest_5day"):              # daily rain was never cross-checked
        assert provisional_for(CARDS[daily], "north-peat")


def test_scout_checks_the_records_before_taking_a_flood_case():
    assert scout.classify(BINTULU)[:3] == ("flood", "north-peat", "")
    kind, region, why = scout.classify(KUCHING)
    assert (kind, region) == ("flood", None) and "cross-check" in why
    assert scout.classify(Headline("Landslide after torrential rain in Miri", "https://example.org/l", "2026-11-12", "T", ""))[:2] \
        == ("flood", "north-peat")


def test_an_editors_report_becomes_a_flood_draft_with_flood_limits():
    assert client.post("/admin/scout/report", json={"title": BINTULU.title, "url": BINTULU.url, "date": BINTULU.date}).status_code == 401
    r = client.post("/admin/scout/report", headers=ADMIN,
                    json={"title": BINTULU.title, "url": BINTULU.url, "date": BINTULU.date, "summary": BINTULU.summary})
    assert r.status_code == 200
    out = r.json()
    assert [(d["type"], d["region"]) for d in out["drafted"]] == [("flood", "north-peat")]   # no data-desk extras
    cid = out["drafted"][0]["id"]
    drafts = {d["case"]["id"]: d for d in client.get("/admin/cases", headers=ADMIN).json()}
    case = drafts[cid]["case"]
    assert case["status"] == "draft" and case["main_cards"] == ["rain_nov_feb", "soil_wet3"]
    assert any("stand-in for floods" in x for x in case["limits"])
    assert "heavy-rain" not in case["hints"]["evidence"][2]   # the worked example is not this case's answer
    assert drafts[cid]["key_overall"] in {"worsening", "improving", "no_change", "not_enough_evidence"}
    # approved, the student sees the north's rain card as checked
    client.post(f"/admin/cases/{cid}/approve", headers=ADMIN)
    pub = client.get(f"/cases/{cid}").json()
    prov = {e["id"]: e["provisional"] for e in pub["evidence"]}
    assert prov["rain_nov_feb"] is None and prov["heavy_rain_days"]
    rain = client.get(f"/cases/{cid}/rain").json()
    assert rain["days"] and rain["days"][-1]["d"] == "2025-01-29" and all(d["mm"] >= 0 for d in rain["days"])
    assert "not cross-checked" in rain["note"]


def test_a_south_flood_case_cannot_be_keyed_on_unchecked_rain():
    pack = scout.assemble(BINTULU, "flood", "south-west", "T", "brief " * 20, "999")
    with pytest.raises(ValueError):
        build_answer_key_for(pack)
    assert {e.id: e.provisional for e in public_case(pack).evidence}["rain_nov_feb"]


def test_wet_season_is_named_by_the_year_it_ends_in():
    idx = pd.to_datetime(["2024-11-15", "2024-12-15", "2025-01-15", "2025-02-15"])
    assert enso.season_year(idx, [11, 12, 1, 2], True) == [2025] * 4
    roni = pd.Series(range(12), index=pd.date_range("2024-01-01", periods=12, freq="MS"), dtype=float)
    roni = pd.concat([roni, pd.Series([20.0, 30.0], index=pd.to_datetime(["2025-01-01", "2025-02-01"]))])
    assert enso.for_months(roni, [11, 12, 1, 2], True).loc[2025] == (10 + 11 + 20 + 30) / 4


def test_wetter_is_the_worse_direction_in_a_flood_case():
    worse, better = reasoning.direction_words("flood")
    assert worse.search("the wet season is getting wetter") and not better.search("the wet season is getting wetter")
    worse, better = reasoning.direction_words("fire")
    assert better.search("the ground is getting wetter")


def test_scene_rain_for_case_001():
    j = client.get("/cases/001/rain").json()
    assert j["days"][0]["d"] == "2026-02-01" and len(j["days"]) > 80
    assert j["source"].startswith("NASA POWER")


def test_the_editors_report_route_rejects_bad_input():
    for body in ({"title": "x", "url": "https://a.b", "date": "2025-01-01"},
                 {"title": "Floods in Bintulu town", "url": "http://a.b", "date": "2025-01-01"},
                 {"title": "Floods in Bintulu town", "url": "https://a.b", "date": "29 Jan"}):
        assert client.post("/admin/scout/report", headers=ADMIN, json=body).status_code == 422


def test_a_south_flood_report_is_set_aside_and_says_why():
    out = asyncio.run(scout.run([KUCHING], from_editor=True))
    assert out["drafted"] == [] and "cross-check" in out["set_aside"]
