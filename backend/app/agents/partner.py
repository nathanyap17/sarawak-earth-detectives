"""The Partner (the hornbill): hints, never answers (MASTER_SHEET §20, rules 1–3).

Knows: the public case, the evidence cards, which tools the student used on which cards, and the
human-approved hint ladder up to the rung the student has unlocked.
Doesn't know: the answer key, any stamp, rate or p-value. It is never given them.
Every reply passes the guard; anything that fails, times out or errors becomes the ladder hint.
AI-assisted: written with Claude Code."""
from __future__ import annotations

from dataclasses import dataclass

from app.agents import guard
from app.agents.runtime import run_once
from app.schemas import CasePack

LADDER_FOR_BEAT = {"call": "evidence", "scene": "evidence", "locker": "evidence", "board": "method",
                   "lab": "method", "deduction": "verdict", "closed": "verdict"}
RUNG_NAME = {1: "a nudge, asked as a question", 2: "a pointer to a tool or a card",
             3: "a worked example on a different, made-up record"}

INSTRUCTION = """You are the Partner in Sarawak Earth Detectives: a rhinoceros hornbill who helps a
school student investigate a case with NASA data. You give hints. You never give answers.

Hard rules:
1. Never say whether the case's data is rising, falling, flat, worsening, improving, significant,
   real, random, or caused by El Nino. Never say what the verdict is or which option to pick.
2. Never write a number unless it appears in the CASE text below. Never repeat or confirm a number
   the student wrote. Never do any calculation.
3. Only if the student asks for the answer, say kindly (once) that detectives find it themselves, then give the hint.
   Otherwise go straight to the hint.
4. Stay on this case and on how to investigate it. Anything else: decline in one short line.
5. At most three short sentences, plain words for a 13-year-old. No lists, no markdown.
6. Base the hint on the APPROVED HINTS for the current level. You may rephrase them to fit the
   student's question, but do not go beyond the highest level given.
"""


@dataclass
class Reply:
    text: str
    rung: int
    source: str  # "ai" | "ladder"
    note: str = ""  # why the ladder was used (mock, timeout, guard: …)
    seconds: float = 0.0


def _ladder(case: CasePack, beat: str) -> list[str]:
    return list(getattr(case.hints, LADDER_FOR_BEAT.get(beat, "method")))


def approved_text(case: CasePack, cards: dict) -> str:
    """Everything the Partner may quote numbers or phrases from."""
    parts = [case.title, case.question, case.brief, case.scene.from_, case.scene.to,
             *case.hints.evidence, *case.hints.method, *case.hints.verdict, *case.limits]
    parts += [f"{c.name}: {c.definition} ({c.mission}, from {c.from_year})" for c in cards.values()]
    return "\n".join(str(p) for p in parts)


def _steps(chosen: list[str], log: list[dict], cards: dict) -> str:
    used: dict[str, list[str]] = {}
    for e in log:
        if e.get("kind") == "tool":
            used.setdefault(e["card_id"], []).append(e["tool"])
    names = lambda ids: ", ".join(cards[i].name for i in ids if i in cards) or "none yet"  # noqa: E731
    lines = [f"Cards chosen: {names(chosen)}."]
    for cid, tools in used.items():
        if cid in cards:
            lines.append(f"Tools used on {cards[cid].name}: {', '.join(dict.fromkeys(tools))}.")
    return " ".join(lines)


def build_prompt(case: CasePack, cards: dict, beat: str, rung: int, message: str,
                 chosen: list[str], log: list[dict], history: list[dict]) -> str:
    ladder = _ladder(case, beat)[:rung]
    hist = "\n".join(f"Student: {h['q']}\nPartner: {h['a']}" for h in history[-3:])
    return f"""CASE
Title: {case.title}
Question: {case.question}
Brief: {case.brief}
Evidence cards in the locker: {"; ".join(f"{c.name} ({c.definition})" for c in cards.values())}

WHERE THE STUDENT IS
Beat: {beat}. {_steps(chosen, log, cards)}

APPROVED HINTS (current level {rung}: {RUNG_NAME[rung]})
{chr(10).join(f"Level {i + 1}: {h}" for i, h in enumerate(ladder))}

RECENT CHAT
{hist or "(none)"}

STUDENT SAYS
{message or "Can I have a hint?"}

Reply as the Partner, following every hard rule."""


async def ask(case: CasePack, cards: dict, beat: str, rung: int, message: str,
              chosen: list[str], log: list[dict], history: list[dict]) -> Reply:
    rung = max(1, min(3, rung))
    ladder = _ladder(case, beat)
    fallback = ladder[rung - 1] if len(ladder) >= rung else "Look again at the question, then pick one record to test."
    text, dt, err = await run_once("partner", INSTRUCTION,
                                   build_prompt(case, cards, beat, rung, message, chosen, log, history))
    if text is None:
        return Reply(fallback, rung, "ladder", err, dt)
    approved = approved_text(case, cards)
    for chk in (guard.check_numbers(text, approved), guard.check_answer(text, approved)):
        if not chk.ok:
            return Reply(fallback, rung, "ladder", f"guard: {chk.reason}", dt)
    sentences = [s for s in text.replace("\n", " ").split(". ") if s.strip()]
    if len(sentences) > 3:
        text = ". ".join(sentences[:3]).rstrip(".") + "."
    return Reply(text, rung, "ai", "", dt)
