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
from app.reports import casefile, insights
from app.vault.store import root

pytestmark = pytest.mark.skipif(not (root() / "index.json").exists(), reason="vault not built")
from tests.conftest import ADMIN

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
    c = casework.load_case("001")
    items = insights.build(c)

    async def liar(*a, **k):
        return json.dumps({k: "Soil fell by 42.7 percent." for k in reporter.SECTIONS}), 0.4, ""
    monkeypatch.setattr(reporter, "run_once", liar)
    out, source, note = asyncio.run(reporter.summarise(c, insights.facts(c, items), items))
    assert source == "code" and note.startswith("guard") and "42.7" not in json.dumps(out)


@pytest.mark.parametrize("text", [
    "The evidence supports that trends do not show a worsening pattern, meaning 2026 was one bad year.",
    "Records show 2026 was simply a bad year rather than a worsening trend.",
    "The fires were a one-off.",
    "Conditions are not worsening.",
    "The drying is driven by El Nino.",
    "This proves the peat is drying out.",
])
def test_reporter_overclaims_are_caught(text):
    # seen live on 2026-11-20: a "can't tell yet" case written up as "2026 was one bad year"
    assert reporter.overclaims(text)


@pytest.mark.parametrize("text", [
    "The analysis cannot yet show proof of what causes fires, as people, land use and drainage matter too.",
    "It does not prove direct causes of fires.",
    "El Nino years may be doing much of the work.",
    "No record shows a trend strong enough to rule out chance.",
    "The case asked whether 2026 was one bad year or part of a trend, and the record cannot yet tell.",
])
def test_reporter_honest_text_passes(text):
    assert reporter.overclaims(text) == ""


def test_reporter_one_bad_year_falls_back(monkeypatch):
    c = casework.load_case("001")
    items = insights.build(c)
    good = reporter.template(c, items)

    async def overclaimer(*a, **k):
        return json.dumps({**good, "impact": "The evidence shows 2026 was one bad year."}), 0.4, ""
    monkeypatch.setattr(reporter, "run_once", overclaimer)
    out, source, note = asyncio.run(reporter.summarise(c, insights.facts(c, items), items))
    assert source == "code" and "over-claims" in note
    assert not reporter.overclaims(" ".join(out.values()))


def test_summary_has_story_sections_and_code_charts():
    sid = _played(); _close(sid)
    a = client.post(f"/sessions/{sid}/summary").json()
    assert a["v"] == 3 and set(a["sections"]) == {"headline", "issue", "response", "insights", "impact"}
    items = a["insights"]
    # the exemplar: every record that bears on the question, tested by this student or not; no red herring
    assert {i["card_id"] for i in items} == {"soil_dry3", "humidity_feb_apr", "rain_feb_apr", "dry_spell"}
    groups = [i["group"] for i in items]
    assert groups == sorted(groups, key=["robust", "elnino", "not"].index)     # robust, then El Niño-only, then not
    assert "not" in groups and any(not i["significant"] for i in items)       # the insignificant ones are kept
    i = next(i for i in items if i["card_id"] == "soil_dry3")
    assert i["points"] and i["metrics"]["t_test_p"] and i["metrics"]["mann_kendall_p"] and i["metrics"]["r2"]
    assert i["caption"] and "0.05" in i["caption"]
    # the line runs past the record only for a trend that survives every check, and is labelled as such
    for i in items:
        robust = i["group"] == "robust"
        assert (len(i["line"]) == 3) == robust and (i["extend_years"] > 0) == robust
    body = json.dumps(a)
    for leak in ("red_herring", "main_cards", "answer_key", "elnino_stamp", "key_overall", "wind"):
        assert leak not in body
    # an exemplar, not a report card: nothing about this student
    for personal in ("Tester", "score", "badge", "attempt"):
        assert personal not in body


def test_captions_explain_significant_and_not():
    from app.analysis.trend import TrendTest
    from app.reports.insights import caption
    sig = TrendTest(30, 2.0, (1.0, 3.0), 0.001, 0.002, 1.9, "significant", "rising", None)
    lamp_gone = TrendTest(30, 0.5, (-0.5, 1.5), 0.3, 0.4, 0.4, "needs_more_years", "rising", 40)
    c1 = caption("Fire days", "days", sig, lamp_gone, 1995, 2024, 0.42, 0.5)
    assert "rose" in c1 and "Mann-Kendall" in c1 and "El Niño" in c1 and "no longer passes" in c1 and "42%" in c1
    flat = TrendTest(30, 0.01, (-0.1, 0.1), 0.8, 0.7, 0.0, "not_significant", "flat", None)
    assert "too small to matter" in caption("Rain", "mm", flat, None, 1995, 2024, 0.01, 0.5)
    more = TrendTest(30, 1.0, (-0.5, 2.5), 0.2, 0.3, 0.9, "needs_more_years", "rising", 60)
    assert "more than 50 years" in caption("Rain", "mm", more, None, 1995, 2024, 0.05, 0.5)


def test_teacher_desk_shows_every_case_with_its_configuration():
    assert client.get("/admin/cases").status_code == 401        # never open without the key
    rows = client.get("/admin/cases", headers=ADMIN).json()
    one = next(r for r in rows if r["case"]["id"] == "001")
    assert one["origin"] == "repository" and one["key_overall"] and one["key_cards"]
    roles = {d["id"]: d["role"] for d in one["datasets"]}
    assert set(roles) == set(one["case"]["evidence"])
    assert {"main", "red_herring"} <= set(roles.values())
    d = next(d for d in one["datasets"] if d["role"] == "main")
    assert d["mission"] and d["months"] and d["vault"][one["case"]["region"]["id"]]["n_years"] >= 20
