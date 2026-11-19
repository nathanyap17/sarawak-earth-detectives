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
         "reasoning": "Both tests said significant for soil wetness and humidity, but with the El Nino lamp "
                      "on the stamps changed, so the record can't settle it.",
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
           "why_hypothesis": "This proves the peat is drying out.",
           "reasoning": "Both tests said significant on soil wetness."}
    sid, _, g = run(MAIN + ["dry_spell"], [("scales", "soil_dry3")], bad)
    g = g.json()
    assert g["ending"] == "sent_back" and g["can_retry"] is True
    assert g["parts"]["explanation"] < 20 and g["parts"]["method"] < 25
    g2 = c.post(f"/sessions/{sid}/verdict", json={"session_id": sid, **DOUBT}).json()
    assert g2["attempt"] == 2 and g2["ending"] == "solved_not_enough"
    assert c.post(f"/sessions/{sid}/verdict", json={"session_id": sid, **DOUBT}).status_code == 409


def test_verdict_returns_without_chief_then_chief_route():
    sid, _, g = run(MAIN, GOOD_TOOLS, DOUBT)
    assert g.json()["chief_note"] is None            # grading never waits on the model
    n = c.post(f"/sessions/{sid}/chief")
    assert n.status_code == 200 and n.json() == {"attempt": 1, "chief_note": None}  # mock agents → feedback only


def test_chief_route_needs_a_verdict():
    sid = c.post("/sessions", json={"case_id": "001", "nickname": "T"}).json()["id"]
    assert c.post(f"/sessions/{sid}/chief").status_code == 409


def test_partner_reply_says_why_it_fell_back():
    sid = c.post("/sessions", json={"case_id": "001", "nickname": "T"}).json()["id"]
    r = c.post(f"/sessions/{sid}/partner", json={"beat": "locker", "rung": 1, "message": "what is the answer?"}).json()
    assert r["source"] == "ladder" and r["fallback"] == "off"


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


def test_workbench_my_line_and_shuffle():
    sid = c.post("/sessions", json={"case_id": "001", "nickname": "T"}).json()["id"]
    bad = c.post(f"/sessions/{sid}/myline", json={"card_id": "soil_dry3", "rate_per_decade": 5.0, "level": 0.0}).json()
    best = c.post(f"/sessions/{sid}/myline", json={"card_id": "soil_dry3", "rate_per_decade": bad["best_rate_per_decade"],
                                                    "level": bad["best_level"]}).json()
    assert bad["score"] < 20 and best["score"] == 100 and best["your_miss"] <= bad["your_miss"]
    sh = c.post(f"/sessions/{sid}/shuffle", json={"card_id": "soil_dry3"}).json()
    assert sum(sh["counts"]) == sh["n"] == 1000 and 0 <= sh["as_steep"] <= 1000 and len(sh["edges"]) == len(sh["counts"]) + 1
    assert sh == c.post(f"/sessions/{sid}/shuffle", json={"card_id": "soil_dry3"}).json()   # same every time
    assert c.post(f"/sessions/{sid}/shuffle", json={"card_id": "nope"}).status_code == 400


# --- the right ticks are not enough: the written reasoning has to hold them up (reasoning.py)
JUNK = [
    {"what": "Idk", "how_much": "", "why_hypothesis": "idk idk idk idk idk", "reasoning": ""},
    {"what": "asdf jkl", "how_much": "?", "why_hypothesis": "sdkfj sdlkfj sdflkj qwe", "reasoning": "random answer lol"},
    {"what": "something", "how_much": "idk", "why_hypothesis": "I don't know why it happened", "reasoning": "I don't know."},
    {"what": "soil and humidity", "how_much": "The record can't say yet",   # copied from the case's hints
     "why_hypothesis": "Northern Sarawak is wetter in some months than others. Could that fool your ruler?",
     "reasoning": "If the lamp changes the stamp, think about what 'Can't tell' means."},
    {"what": "fire fire fire", "how_much": "a lot a lot", "why_hypothesis": "fire fire fire fire fire fire",
     "reasoning": "fire fire fire fire fire fire"},
]


@pytest.mark.parametrize("words", JUNK)
def test_correct_ticks_with_junk_words_are_sent_back(words):
    _, _, g = run(MAIN + ["dry_spell"], GOOD_TOOLS, {**DOUBT, **words})
    g = g.json()
    assert g["ending"] == "sent_back"
    assert g["parts"]["verdict"] <= 15 and "honest_doubt" not in g["badges"]
    assert any(not c["ok"] for c in g["checks"])


def test_right_ticks_without_a_reason_for_the_stand_are_sent_back():
    v = {**DOUBT, "reasoning": "I just picked this one because it felt right to me."}
    _, _, g = run(MAIN, GOOD_TOOLS, v)
    g = g.json()
    stance = next(c for c in g["checks"] if c["id"] == "stance")
    assert g["ending"] == "sent_back" and stance["ok"] is False
    assert "Can't tell yet" in stance["detail"]


@pytest.mark.parametrize("reason", [
    "Too few years of data to be sure.",
    "When I turned on the El Nino lamp the stamps were not significant any more, so I cannot be sure.",
    "The scales and the ruler disagree for humidity, so the record is inconclusive for now.",
])
def test_honest_doubt_in_a_students_own_words_closes_the_case(reason):
    _, _, g = run(MAIN, GOOD_TOOLS, {**DOUBT, "reasoning": reason})
    g = g.json()
    assert g["ending"] == "solved_not_enough", g["feedback"]
    assert all(c["ok"] for c in g["checks"])


def test_contradicting_ticks_are_named():
    v = {**DOUBT, "direction": "no_change", "is_it_real": "yes", "how_much": "about 0.013 per decade",
         "reasoning": "Both tests said significant on soil wetness."}
    _, _, g = run(MAIN, GOOD_TOOLS, v)
    g = g.json()
    c = next(c for c in g["checks"] if c["id"] == "consistent")
    assert c["ok"] is False and "No change" in c["detail"] and g["ending"] == "sent_back"


def test_checks_never_mention_the_answer_key():
    _, _, g = run(MAIN, GOOD_TOOLS, {**DOUBT, **JUNK[0]})
    body = g.text.lower()
    for secret in ("per_card", "overall", "not_enough_evidence", "elnino_stamp"):
        assert secret not in body


@pytest.mark.parametrize("reason", ["Can't tell yet: not enough evidence",
                                    "I can't tell because there is not enough evidence",
                                    "pizza is nice and cats are cute and I like football"])
def test_a_reason_that_restates_the_tick_or_is_off_topic_is_sent_back(reason):
    _, _, g = run(MAIN, GOOD_TOOLS, {**DOUBT, "reasoning": reason})
    assert g.json()["ending"] == "sent_back"


def test_no_wrong_closes_in_the_wide_stress_test():
    from tests.fuzz_verdicts import run as fuzz
    n, wrong, missed = fuzz(step=4)    # every 4th junk phrase; `python -m tests.fuzz_verdicts` runs them all
    assert n > 5000 and wrong == [] and missed == []
