"""Student-facing routes (MASTER_SHEET §9). No route returns an AnswerKey (rule 3).
AI-assisted: written with Claude Code."""
from __future__ import annotations

import hmac
import logging
import time

from fastapi import APIRouter, Header, HTTPException, Request

from app import casework
from app import docs
from app.agents import activity, chief, listener, partner, reporter, runtime, scout
from app.reports import casefile, insights

SUMMARY_V = 2   # executive report layout; an older stored summary is rewritten in the new layout
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
    listener.keep_warm()   # and the hold-to-talk transcriber
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
    s.analyses.append(res.model_dump(exclude={"series_out", "monthly_out", "enso_out", "twin"}))
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
    if body.kind == "pins" and body.pins is not None:   # the student moved or removed a pin
        s.clue_pins = [list(p) for p in body.pins[:3]]
    s.record(body.kind, **body.model_dump(exclude={"kind", "pins"}, exclude_none=True),
             **({"n": len(body.pins)} if body.pins is not None else {}))  # Firestore has no nested arrays
    sessions.save(s, "clue_pins")
    return {"ok": True}


_heard: dict[str, int] = {}   # transcriptions per session (in memory): a cap, not a record


@router.post("/sessions/{session_id}/transcribe")
async def transcribe(session_id: str, request: Request):
    """Hold-to-talk for browsers without their own speech recognition: a short recording in, the
    words out. The audio is passed to the model and dropped; only the text goes back."""
    _session(session_id)
    mime = (request.headers.get("content-type") or "").split(";")[0].strip().lower()
    if mime not in listener.TYPES:
        raise HTTPException(415, "send a short audio recording")
    audio = await request.body()
    if not audio or len(audio) > listener.MAX_BYTES:
        raise HTTPException(413, "keep it under 20 seconds")
    if _heard.get(session_id, 0) >= 60:
        raise HTTPException(429, "That's a lot of talking! Type your question instead.")
    _heard[session_id] = _heard.get(session_id, 0) + 1
    text, err = await listener.transcribe(audio, mime)
    return {"text": text or "", "error": err}


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
    activity.record("Partner", "ai" if r.source == "ai" else "code", {
        None: f"Gave a level {r.rung} hint in {r.seconds:.1f} s. It passed the number guard and the answer guard.",
        "guarded": "A reply was blocked by the guard, so the approved hint was used instead.",
        "busy": "The model was slow, so the approved hint was used instead.",
        "off": "AI is switched off, so the approved hint was used.",
    }[fallback], "hint")
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
    activity.record("Grader", "code", f"Graded a verdict on case {c.id} in code: "
                    + {"solved": "solved.", "solved_not_enough": "solved, with honest doubt.", "sent_back": "sent back for one more try."}[g.ending], "grade")
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
    activity.record("Chief", "ai" if note else "code", "Wrote a note on a graded case. It passed the guards."
                    if note else "The Chief's note was not used, so the grader's own feedback was shown.", "note")
    sessions.save(fresh, "grade")
    return ChiefNote(attempt=g.attempt, chief_note=note)


def _closed_case(session_id: str):
    s = _session(session_id)
    if not casefile.closed(s):
        raise HTTPException(409, "the case file opens once the case is closed")
    return s, _case(s.case_id)


@router.get("/sessions/{session_id}/casefile")
def case_file(session_id: str):
    """Everything the student did, in order, with the code's numbers: the printable case study.
    Built from the session only (never the answer key), and only after the case is closed."""
    s, c = _closed_case(session_id)
    cf = casefile.build(s, c)
    kept = (s.grade or {}).get("exec_summary")
    cf["summary"] = kept if (kept or {}).get("v") == SUMMARY_V else None
    return cf


@router.post("/sessions/{session_id}/summary")
async def exec_summary(session_id: str):
    """The executive report of a closed case, written once and kept: the Reporter's story text
    (guarded) around the key-insight charts, whose numbers and captions are computed by code."""
    s, c = _closed_case(session_id)
    if (s.grade.get("exec_summary") or {}).get("v") == SUMMARY_V:
        return s.grade["exec_summary"]
    cf = casefile.build(s, c)
    items = insights.build(s, c)
    sections, source, note = await reporter.summarise(cf, casefile.facts(cf) + "\n" + insights.facts(items), items)
    out = {"v": SUMMARY_V, "sections": sections, "source": source, "insights": items}
    s.grade["exec_summary"] = out
    s.record("summary", source=source, note=note)
    sessions.save(s, "grade")
    if note:
        logging.getLogger("agents").info("reporter fell back to the template: %s", note)
    activity.record("Reporter", "ai" if source == "ai" else "code",
                    "Wrote an executive summary of a closed case from the code's facts sheet. It passed the number guard."
                    if source == "ai" else "Wrote an executive summary from the code template (the model's draft was not used).", "summary")
    return out


# ---------------------------------------------------------------- the agency at work (public)
STEPS = [
    {"name": "Scout", "by": "code + AI", "does": "Reads the news feeds and watches the NASA records for unusual readings."},
    {"name": "Checklist", "by": "code", "does": "Keeps only real weather and land events in a region we hold checked records for."},
    {"name": "Case Builder", "by": "AI + code", "does": "AI writes the brief from the headline. Code guards it, picks the evidence cards and computes the answer key."},
    {"name": "Editor", "by": "human", "does": "A person reads every draft. Nothing reaches students without approval."},
    {"name": "Partner, Chief and Reporter", "by": "AI + code", "does": "Hints, feedback and case summaries, checked by the number guard (and the answer guard for hints)."},
]


@router.get("/agency/activity")
def agency_activity():
    """What the agents, the code and the human editor have been doing. Wording and counts only:
    no student text, no answer key, nothing from a case that is not approved."""
    cases = casework.list_cases(status=None)
    return {"steps": STEPS, "schedule": get_settings().scout_schedule,
            "counts": {"open": sum(c.status == "open" for c in cases), "waiting": sum(c.status == "draft" for c in cases)},
            "events": activity.recent(40)}


# ---------------------------------------------------------------- admin: the editor's desk
def _admin(token: str | None) -> None:
    """Every admin route needs the editor's key, locally too. With no ADMIN_TOKEN configured the
    desk stays locked: cases, configurations and answer keys are never open by default."""
    st = get_settings()
    if not st.admin_token:
        raise HTTPException(503, "The teacher's desk is locked: no editor's key is set up on the server (ADMIN_TOKEN).")
    if not token or not hmac.compare_digest(token.encode(), st.admin_token.encode()):
        raise HTTPException(401, "That editor's key is not right.")


@router.post("/admin/scout/run")
async def scout_run(x_admin_token: str | None = Header(default=None)):
    """The weekly pass (Cloud Scheduler calls this). Drafts only: students see nothing until approval."""
    _admin(x_admin_token)
    return await scout.run()


@router.get("/admin/cases")
def admin_cases(x_admin_token: str | None = Header(default=None)):
    """The teacher's desk: every case, open or waiting, with its full configuration (region,
    scene, datasets and their roles, hints, limits, sources) and the code's answer key.
    Behind the editor's key only; students never reach this route (rule 3)."""
    _admin(x_admin_token)
    out = []
    for c in casework.list_cases(status=None):
        desk = docs.store().get("cases", c.id) is not None
        key = (docs.store().get("answer_keys", c.id) if desk else casework.stored_key(c.id)) or {}
        out.append({"case": c.model_dump(by_alias=True), "origin": "desk" if desk else "repository",
                    "key_overall": key.get("overall"), "key_computed_at": key.get("computed_at"),
                    "key_stamps": {k: [v["stamp"], v["elnino_stamp"]] for k, v in key.get("per_card", {}).items()},
                    "key_cards": key.get("per_card", {}),
                    "datasets": casework.dataset_config(c)})
    return out


@router.post("/admin/cases/{case_id}/{decision}")
def admin_decide(case_id: str, decision: str, x_admin_token: str | None = Header(default=None)):
    """Rule 4: a draft becomes open only here, by a person."""
    _admin(x_admin_token)
    if decision not in ("approve", "reject"):
        raise HTTPException(400, "approve or reject")
    d = docs.store().get("cases", case_id)
    if d is None:
        raise HTTPException(404, "not a desk case")
    if d.get("status") != "draft":
        raise HTTPException(409, "already decided")
    d["status"] = "open" if decision == "approve" else "closed"
    docs.store().put("cases", case_id, d)
    casework.forget(case_id)
    activity.record("Editor", "human", f"A human editor approved case {case_id}. It is now in the inbox."
                    if decision == "approve" else f"A human editor rejected the draft of case {case_id}. It was not published.", "review")
    return {"id": case_id, "status": d["status"]}
