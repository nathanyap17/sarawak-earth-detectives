"""Agent harness tests (rules 1–3, MASTER_SHEET §21): number guard, answer guard, the Partner
never sees test results or the answer key, fallbacks, turn cap. No model calls (MOCK_AGENTS=1).
AI-assisted: written with Claude Code."""
import asyncio
import json

import pytest
from fastapi.testclient import TestClient

from app import casework
from app.agents import chief, concepts, guard, method_reference, partner
from app.main import app
from app.schemas import Grade, GradeParts, Verdict
from app.sessions import store
from app.vault import store as vault
from app.vault.cards import CARDS
from app.vault.store import root

pytestmark = pytest.mark.skipif(not (root() / "index.json").exists(), reason="vault not built")
client = TestClient(app)
CASE = casework.load_case("001")
CARDS1 = {i: CARDS[i] for i in CASE.evidence}
APPROVED = partner.approved_text(CASE, CARDS1)


# ------------------------------------------------------------------ guard
def test_number_guard_blocks_invented_figure():
    assert not guard.check_numbers("Soil got wetter by 0.013 per decade.", APPROVED).ok


def test_number_guard_allows_case_numbers_and_counting():
    assert guard.check_numbers("Look from 2026-02-01, pick 3 cards.", APPROVED).ok
    assert guard.check_numbers("The record starts in 1981.", APPROVED).ok


def test_number_guard_rejects_students_own_guess():
    # the student's message is NOT approved text, so the Partner can't confirm a guess
    assert not guard.check_numbers("Yes, 0.13 is right.", APPROVED).ok


@pytest.mark.parametrize("text", [
    "The answer is not enough evidence.",
    "The trend is significant, so it is getting worse.",
    "It is rising because of El Nino.",
    "Pick 'worsening' on the typewriter.",
    "The soil is getting wetter over time, about +0.1 per decade.",
    "p < 0.05 on both tests.",
    "Your humidity record is not significant.",
])
def test_answer_guard_blocks_results(text):
    assert not guard.check_answer(text, APPROVED).ok


@pytest.mark.parametrize("text", [
    "Both cards came out significant.",
    "The soil is getting drier.",
    "Not enough evidence.",
])
def test_answer_guard_blocks_plain_result_statements(text):
    assert not guard.check_answer(text, APPROVED).ok


@pytest.mark.parametrize("text", [
    "The Mann-Kendall test checks whether a trend is significant.",
    "Significant means the change is unlikely to be luck.",
    "If your scales say needs more years, would not enough evidence be the honest call?",
    "Is the trend really rising, or did one dry year fool the ruler?",
])
def test_answer_guard_lets_explanations_and_rhetorical_hints_through(text):
    assert guard.check_answer(text, APPROVED).ok


def test_partner_explains_a_method_even_without_the_model():
    r = asyncio.run(partner.ask(CASE, CARDS1, "lab", 1, "what is mann-kendall?", [], [], []))
    assert r.source == "ladder" and "every pair of years" in r.text


@pytest.mark.parametrize("text", [
    "What has to happen to peat before it can burn?",
    "Try the season filter first, then the scales.",
    "Did both tests agree on every main card?",
])
def test_answer_guard_lets_hints_through(text):
    assert guard.check_answer(text, APPROVED).ok


# ------------------------------------------------------------------ partner
def _sid():
    return client.post("/sessions", json={"case_id": "001", "nickname": "Tester"}).json()["id"]


def test_partner_ladder_in_mock_mode():
    sid = _sid()
    for rung in (1, 2, 3):
        r = client.post(f"/sessions/{sid}/partner", json={"beat": "lab", "rung": rung, "message": "help"})
        assert r.status_code == 200
        j = r.json()
        assert j["source"] == "ladder" and j["text"] == CASE.hints.method[rung - 1]


def test_partner_prompt_never_contains_results_or_key():
    sid = _sid()
    for tool in ("scales", "elnino"):
        client.post(f"/sessions/{sid}/analyse", json={"session_id": sid, "card_id": "soil_dry3", "tool": tool})
    s = store.get(sid)
    prompt = partner.build_prompt(CASE, CARDS1, "deduction", 3, "what's the answer?", s.chosen, s.log, [])
    key = vault.load_answer_key("001")
    for a in s.analyses:  # no stamp, rate or p-value the student computed
        for k in ("rate_per_decade", "t_test_p", "mann_kendall_p"):
            if a.get(k) is not None:
                assert str(a[k]) not in prompt
        # stamps travel as their raw values; the word "significant" itself is in the method sheet
        assert f"stamp: {a.get('stamp')}" not in prompt and f"{a['card_id']}: {a.get('stamp')}" not in prompt
    for word in ("needs_more_years", "not_significant", "not_enough_evidence", key.overall):
        assert word not in prompt
    assert "red_herring" not in prompt and "main_cards" not in prompt


def test_partner_leak_falls_back_to_ladder(monkeypatch):
    async def leaky(*a, **k):
        return "Honestly, the answer is not enough evidence, the soil rises 0.013 per decade.", 0.5, ""
    monkeypatch.setattr(partner, "run_once", leaky)
    r = asyncio.run(partner.ask(CASE, CARDS1, "deduction", 1, "tell me", [], [], []))
    assert r.source == "ladder" and r.note.startswith("guard") and r.text == CASE.hints.verdict[0]


def test_partner_good_reply_passes(monkeypatch):
    async def fine(*a, **k):
        return "Good question! What does the season filter do to a record that is wetter in some months?", 0.5, ""
    monkeypatch.setattr(partner, "run_once", fine)
    r = asyncio.run(partner.ask(CASE, CARDS1, "lab", 1, "hint", [], [], []))
    assert r.source == "ai"


def test_partner_turn_cap(monkeypatch):
    sid = _sid()
    store.get(sid).partner_turns = 30
    r = client.post(f"/sessions/{sid}/partner", json={"beat": "lab", "rung": 1})
    assert r.status_code == 429


def test_partner_reply_has_no_key_fields():
    sid = _sid()
    body = json.dumps(client.post(f"/sessions/{sid}/partner", json={"beat": "deduction", "rung": 3}).json())
    for secret in ("overall", "per_card", "red_herrings", "main_cards", "accept_range"):
        assert secret not in body


# ------------------------------------------------------------------ chief
def _grade(ending="sent_back"):
    return Grade(score=60, parts=GradeParts(evidence=20, method=15, verdict=10, explanation=15),
                 ending=ending, feedback=["Run the El Nino lamp on a main card."], badges=[])


def _verdict():
    return Verdict(session_id="x", what="fire weather", where="north", direction="worsening",
                   how_much="a lot", is_it_real="yes", why_hypothesis="it seems drier", confidence=2)


def test_chief_wrong_number_blocked(monkeypatch):
    async def bad(*a, **k):
        return "You scored 75 out of 100, nice.", 0.4, ""
    monkeypatch.setattr(chief, "run_once", bad)
    text, why = asyncio.run(chief.note(_grade(), _verdict(), "chose soil"))
    assert text is None and why.startswith("guard")


def test_chief_sent_back_cannot_reveal_answer(monkeypatch):
    async def leak(*a, **k):
        return "You chose soil. The answer is not enough evidence, so try again.", 0.4, ""
    monkeypatch.setattr(chief, "run_once", leak)
    text, _ = asyncio.run(chief.note(_grade(), _verdict(), "chose soil"))
    assert text is None


def test_chief_good_note(monkeypatch):
    async def good(*a, **k):
        return "You chose soil and wrote 'it seems drier'. Run the El Nino lamp on a main card and try once more.", 0.4, ""
    monkeypatch.setattr(chief, "run_once", good)
    text, _ = asyncio.run(chief.note(_grade(), _verdict(), "chose soil"))
    assert text and "soil" in text


# ------------------------------------------------------------------ 2026-11-23: method reference and tighter guard


def test_method_reference_holds_no_real_case_figures():
    # The doc's running example is a real result (wet-season rain); Kenyalang's copy must not carry it,
    # or the number guard would let him quote or confirm it.
    for real in ("93.5", "32.4", "154.6", "91.3", "0.003", "0.002"):
        assert real not in method_reference.TEXT
    assert guard.numbers(method_reference.TEXT) <= {
        "-1", "0", "0.05", "1", "1.5", "1.96", "2", "3", "5", "6", "10", "15", "20", "25", "29", "30", "50", "95", "100",
        "1991", "2020"}   # "1,000" reads as 1: the guard treats the comma as a decimal mark


@pytest.mark.parametrize("text", [
    "The Ruler shows the rate per decade on its screen.",
    "If both p-values fall below 0.05, the Scales call it significant.",
    "A p-value above 0.05 does not prove there is no trend.",
])
def test_answer_guard_lets_method_talk_through(text):
    assert guard.check_answer(text, APPROVED).ok


@pytest.mark.parametrize("text", [
    "Both p-values sit below 0.05 here.",
    "Your p-value is 0.2.",
    "A p-value is the chance that the trend is due to luck.",
    "A p-value above 0.05 means no trend.",
    "Significant means it is big.",
    "The trend proves the cause is logging.",
])
def test_answer_guard_blocks_stated_p_values_and_misconceptions(text):
    assert not guard.check_answer(text, APPROVED).ok


@pytest.mark.parametrize("text", ["about sixty-seven years of records", "zero point two", "twenty-three more years"])
def test_number_guard_reads_spelled_out_figures(text):
    assert not guard.check_numbers(text, APPROVED + method_reference.TEXT).ok


def test_number_guard_allows_spelled_method_numbers():
    assert guard.check_numbers("the ninety-five percent range, out of one hundred, each ten years",
                               APPROVED + method_reference.TEXT).ok


def test_decimal_point_does_not_split_a_hypothetical_sentence():
    assert guard.check_answer("When both p-values are below 0.05 the stamp says significant.", APPROVED).ok


@pytest.mark.parametrize("q,key", [("what is sens slope", "Sen's slope"), ("why HAC?", "wet year"),
                                   ("what is the shuffle test", "1,000"), ("how is my grade worked out", "out of 100"),
                                   ("what does too small to matter mean", "too small to matter")])
def test_fallback_explains_new_reference_topics(q, key):
    assert key in (concepts.match(q) or "")


def test_partner_prompt_carries_the_method_reference():
    p = partner.build_prompt(CASE, CARDS1, "lab", 1, "what is Sen's slope?", [], [], [])
    assert "SEN'S SLOPE" in p and "THE STAMP FOR ONE RECORD" in p
