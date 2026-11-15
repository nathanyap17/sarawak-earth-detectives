"""Student-facing routes (MASTER_SHEET §9). No route returns an AnswerKey (rule 3).
AI-assisted: written with Claude Code."""
from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException

from app import casework
from app.agents import chief, partner, runtime
from app.config import get_settings
from app.grading import Attempt, grade
from app.schemas import (AnalysisRequest, AnalysisResult, CasePublic, ChiefNote, ChooseCards, ChooseResult,
                         Grade, LogEvent, MyLineRequest, MyLineResult, PartnerAsk, PartnerReply, Series, SessionCreate,
                         SessionOut, ShuffleRequest, ShuffleResult, Verdict)
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
async def create_session(body: SessionCreate):
    _case(body.case_id)
    runtime.keep_warm("partner", partner.INSTRUCTION)  # their first question shouldn't hit a cold model
    runtime.keep_warm("chief", chief.INSTRUCTION)
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
    fallback = None
    if r.source == "ladder":
        fallback = "guarded" if r.note.startswith("guard") else "busy" if r.note in ("timeout", "empty") or r.note.endswith("Error") else "off"
    return PartnerReply(text=r.text, rung=r.rung, source=r.source, turns_left=cap - s.partner_turns,
                        fallback=fallback)


def _workbench(session_id: str, card_id: str):
    s = _session(session_id)
    c = _case(s.case_id)
    if card_id not in c.evidence:
        raise HTTPException(400, "card not in this case")
    return s, c


@router.post("/sessions/{session_id}/myline", response_model=MyLineResult)
def my_line(session_id: str, body: MyLineRequest):
    """Score the trend line a student laid by hand. A learning tool: logged, never graded."""
    s, c = _workbench(session_id, body.card_id)
    res = casework.run_my_line(body.card_id, c.region.id, body.rate_per_decade, body.level)
    s.record("workbench", what="myline", card_id=body.card_id, score=res["score"])
    sessions.save(s)
    return res


@router.post("/sessions/{session_id}/shuffle", response_model=ShuffleResult)
def shuffle(session_id: str, body: ShuffleRequest):
    """Shuffle the years to picture what chance alone can do. A learning tool: logged, never graded."""
    s, c = _workbench(session_id, body.card_id)
    res = casework.run_shuffle(body.card_id, c.region.id)
    s.record("workbench", what="shuffle", card_id=body.card_id)
    sessions.save(s)
    return res


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
    s.record("verdict", attempt=attempt_no, ending=g.ending, score=g.score)
    sessions.save(s, "verdicts", "grade")
    return g  # the grade is code; the Chief's wording comes separately (POST …/chief), so nobody waits on the model


@router.post("/sessions/{session_id}/chief", response_model=ChiefNote)
async def chief_note(session_id: str):
    """The Chief's note on the latest grade, written once and kept. None → the page shows the code's feedback only."""
    s = _session(session_id)
    if not s.grade or not s.verdicts:
        raise HTTPException(409, "no verdict yet")
    if s.grade.get("chief_note"):
        return ChiefNote(attempt=s.grade["attempt"], chief_note=s.grade["chief_note"])
    c = _case(s.case_id)
    g, v = Grade(**s.grade), Verdict(**s.verdicts[-1])
    note, why = await chief.note(g, v, _steps_summary(s, c))
    fresh = sessions.get(session_id) or s   # a retry may have landed while the model was writing
    if fresh.grade and fresh.grade.get("attempt") == g.attempt and note:
        fresh.grade["chief_note"] = note
    fresh.record("chief", attempt=g.attempt, source="ai" if note else f"code ({why})")
    sessions.save(fresh, "grade")
    return ChiefNote(attempt=g.attempt, chief_note=note)
