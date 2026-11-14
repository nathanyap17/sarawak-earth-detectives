"""Student-facing routes (MASTER_SHEET §9). No route returns an AnswerKey (rule 3).
AI-assisted: written with Claude Code."""
from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException

from app import casework
from app.agents import chief, partner
from app.config import get_settings
from app.grading import Attempt, grade
from app.schemas import (AnalysisRequest, AnalysisResult, CasePublic, ChooseCards, ChooseResult,
                         Grade, LogEvent, PartnerAsk, PartnerReply, Series, SessionCreate,
                         SessionOut, Verdict)
from app.vault.cards import CARDS
from app.sessions import store as sessions
from app.vault import store as vault

router = APIRouter()


def _case(case_id: str):
    try:
        c = casework.load_case(case_id)
    except KeyError:
        raise HTTPException(404, "case not found")
    if c.status != "open":
        raise HTTPException(404, "case not found")
    return c


@router.get("/cases", response_model=list[CasePublic])
def list_cases():
    return [casework.public_case(c) for c in casework.list_cases("open")]


@router.get("/cases/{case_id}", response_model=CasePublic)
def get_case(case_id: str):
    return casework.public_case(_case(case_id))


@router.get("/cases/{case_id}/scene")
def get_scene(case_id: str):
    c = _case(case_id)
    return {"region": c.region, "twin_region": c.twin_region,
            "scene": c.scene.model_dump(by_alias=True)}


@router.get("/cases/{case_id}/evidence")
def get_evidence(case_id: str):
    return casework.public_case(_case(case_id)).evidence


@router.get("/cases/{case_id}/series/{card_id}", response_model=Series)
def get_series(case_id: str, card_id: str, region_id: str | None = None):
    c = _case(case_id)
    if card_id not in c.evidence:
        raise HTTPException(404, "card not in this case")
    allowed = {c.region.id} | ({c.twin_region.id} if c.twin_region else set())
    rid = region_id or c.region.id
    if rid not in allowed:
        raise HTTPException(400, "region not part of this case")
    return vault.load_series(rid, card_id)


@router.post("/sessions", response_model=SessionOut)
def create_session(body: SessionCreate):
    _case(body.case_id)
    s = sessions.create(body.case_id, body.nickname.strip(), body.class_code)
    s.record("start")
    sessions.save(s)
    return SessionOut(id=s.id, case_id=s.case_id, nickname=s.nickname, created_at=s.created_at)


@router.post("/sessions/{session_id}/analyse", response_model=AnalysisResult)
def analyse(session_id: str, body: AnalysisRequest):
    s = sessions.get(session_id)
    if s is None or body.session_id != session_id:
        raise HTTPException(404, "session not found")
    c = _case(s.case_id)
    if body.card_id not in c.evidence:
        raise HTTPException(400, "card not in this case")
    opts = dict(body.options)
    if body.tool == "twin":
        if not c.twin_region:
            raise HTTPException(400, "this case has no twin region")
        opts["region_b"] = c.twin_region.id  # never trust a client-chosen region
    t0 = time.perf_counter()
    try:
        res = casework.run_tool(body.card_id, c.region.id, body.tool, opts)
    except FileNotFoundError:
        raise HTTPException(503, "record not in the vault yet")
    s.analyses.append(res.model_dump(exclude={"series_out", "monthly_out", "twin"}))
    s.record("tool", tool=body.tool, card_id=body.card_id, stamp=res.stamp,
             ms=round((time.perf_counter() - t0) * 1000))
    sessions.save(s, "analyses")
    return res


def _session(session_id: str):
    s = sessions.get(session_id)
    if s is None:
        raise HTTPException(404, "session not found")
    return s


@router.post("/sessions/{session_id}/choose", response_model=ChooseResult)
def choose(session_id: str, body: ChooseCards):
    s = _session(session_id)
    c = _case(s.case_id)
    cards = list(dict.fromkeys(body.cards))
    if any(x not in c.evidence for x in cards):
        raise HTTPException(400, "card not in this case")
    s.chosen = cards
    s.record("choose", cards=cards)
    sessions.save(s, "chosen")
    return ChooseResult(chosen=cards, partner_asks_why=bool(set(cards) & set(c.red_herrings)))


@router.post("/sessions/{session_id}/log")
def log(session_id: str, body: LogEvent):
    s = _session(session_id)
    if body.kind == "clue" and body.lonlat and len(s.clue_pins) < 3:
        s.clue_pins.append(list(body.lonlat))
    s.record(body.kind, **body.model_dump(exclude={"kind"}, exclude_none=True))
    sessions.save(s, "clue_pins")
    return {"ok": True}


@router.post("/sessions/{session_id}/partner", response_model=PartnerReply)
async def ask_partner(session_id: str, body: PartnerAsk):
    """A hint from the hornbill. The Partner never receives the answer key or any test result."""
    s = _session(session_id)
    c = _case(s.case_id)
    cap = get_settings().partner_max_turns_per_session
    if s.partner_turns >= cap:
        raise HTTPException(429, "The Partner needs a rest. Use the hints you already have.")
    cards = {i: CARDS[i] for i in c.evidence}
    r = await partner.ask(c, cards, body.beat, body.rung, body.message.strip(), s.chosen, s.log,
                          s.partner_chat)
    s.partner_turns += 1
    s.partner_chat.append({"q": body.message.strip()[:300], "a": r.text, "beat": body.beat,
                           "rung": r.rung, "source": r.source})
    s.record("partner", beat=body.beat, rung=r.rung, source=r.source, note=r.note,
             ms=round(r.seconds * 1000))
    sessions.save(s, "partner_turns", "partner_chat")
    return PartnerReply(text=r.text, rung=r.rung, source=r.source, turns_left=cap - s.partner_turns)


def _steps_summary(s, c) -> str:
    used: dict[str, list[str]] = {}
    for e in s.log:
        if e["kind"] == "tool":
            used.setdefault(e["card_id"], []).append(e["tool"])
    name = lambda i: CARDS[i].name if i in CARDS else i  # noqa: E731
    parts = [f"chose {', '.join(name(i) for i in s.chosen) or 'no cards'}"]
    label = {"magnifier": "the magnifier", "season": "the season filter", "ruler": "the ruler",
             "scales": "the scales", "elnino": "the El Nino lamp", "twin": "the twin map"}
    parts += [f"used {', '.join(label.get(x, x) for x in dict.fromkeys(t))} on {name(cid)}" for cid, t in used.items()]
    hints = sum(1 for e in s.log if e["kind"] == "partner")
    parts.append(f"asked the Partner {hints} time(s)")
    return "; ".join(parts) + "."


@router.post("/sessions/{session_id}/verdict", response_model=Grade)
async def submit_verdict(session_id: str, body: Verdict):
    s = _session(session_id)
    if body.session_id != session_id:
        raise HTTPException(400, "session mismatch")
    if s.grade and (s.grade["ending"] != "sent_back" or not s.grade["can_retry"]):
        raise HTTPException(409, "case already closed")
    c = _case(s.case_id)
    key = vault.load_answer_key(c.id)  # server-side only; never returned
    attempt_no = len(s.verdicts) + 1
    tools = [{"tool": e["tool"], "card_id": e["card_id"]} for e in s.log if e["kind"] == "tool"]
    g = grade(c, key, Attempt(chosen=s.chosen, tools=tools), body, final=attempt_no >= 2)
    g.attempt = attempt_no
    g.can_retry = g.ending == "sent_back" and attempt_no < 2
    s.verdicts.append(body.model_dump())
    s.grade = g.model_dump()
    note, why = await chief.note(g, body, _steps_summary(s, c))
    g.chief_note = note
    s.grade = g.model_dump()
    s.record("verdict", attempt=attempt_no, ending=g.ending, score=g.score,
             chief="ai" if note else f"code ({why})")
    sessions.save(s, "verdicts", "grade")
    return g
