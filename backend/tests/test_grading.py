"""Grading through the API, against case 001's real answer key (not_enough_evidence).
AI-assisted: written with Claude Code."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.vault.store import root

pytestmark = pytest.mark.skipif(not (root() / "answer_keys" / "001.json").exists(),
                                reason="answer key not built")
c = TestClient(app)
MAIN = ["soil_dry3", "humidity_feb_apr"]


def run(cards, tools, verdict):
    sid = c.post("/sessions", json={"case_id": "001", "nickname": "T"}).json()["id"]
    ch = c.post(f"/sessions/{sid}/choose", json={"cards": cards}).json()
    for tool, card in tools:
        assert c.post(f"/sessions/{sid}/analyse",
                      json={"session_id": sid, "card_id": card, "tool": tool}).status_code == 200
    g = c.post(f"/sessions/{sid}/verdict", json={"session_id": sid, **verdict})
    return sid, ch, g


GOOD_TOOLS = [(t, card) for card in MAIN for t in ("season", "scales", "elnino")]
DOUBT = {"what": "Fire weather: soil wetness and humidity", "where": "Northern Sarawak",
         "direction": "no_change", "how_much": "The record can't say yet",
         "is_it_real": "cant_tell",
         "why_hypothesis": "The rise could be El Nino years rather than a lasting change.",
         "confidence": 2}


def test_ideal_honest_doubt_run():
    _, ch, g = run(MAIN + ["dry_spell"], GOOD_TOOLS, DOUBT)
    g = g.json()
    assert ch["partner_asks_why"] is False
    assert g["ending"] == "solved_not_enough"
    assert g["score"] == 100
    assert {"honest_doubt", "clean_signal", "elnino_eye", "red_herring"} <= set(g["badges"])


def test_overconfident_verdict_sent_back_then_retry():
    bad = {**DOUBT, "direction": "worsening", "is_it_real": "yes",
           "why_hypothesis": "This proves the peat is drying out."}
    sid, _, g = run(MAIN + ["dry_spell"], [("scales", "soil_dry3")], bad)
    g = g.json()
    assert g["ending"] == "sent_back" and g["can_retry"] is True
    assert g["parts"]["explanation"] < 20 and g["parts"]["method"] < 25
    g2 = c.post(f"/sessions/{sid}/verdict", json={"session_id": sid, **DOUBT}).json()
    assert g2["attempt"] == 2 and g2["ending"] == "solved_not_enough"
    assert c.post(f"/sessions/{sid}/verdict", json={"session_id": sid, **DOUBT}).status_code == 409


def test_red_herring_costs_evidence_marks():
    _, ch, g = run(MAIN + ["wind"], GOOD_TOOLS, DOUBT)
    g = g.json()
    assert ch["partner_asks_why"] is True
    assert g["parts"]["evidence"] < 25 and "red_herring" not in g["badges"]


def test_grade_never_contains_answer_key_fields():
    _, _, g = run(MAIN, GOOD_TOOLS, DOUBT)
    body = g.text
    for secret in ("per_card", "overall", "elnino_stamp", "computed_at"):
        assert secret not in body
