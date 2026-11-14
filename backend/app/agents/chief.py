"""The Chief: two or three sentences of feedback that quote the student's own steps (§20).

The score, parts, ending and feedback lines are decided by `grading.py` (code). The Chief only
puts them into words. It gets the grade from code, not the answer key, because a sent-back
student may retry and must not learn the answer from the note. Guarded like the Partner.
AI-assisted: written with Claude Code."""
from __future__ import annotations

import re

from app.agents import guard
from app.agents.runtime import run_once
from app.schemas import Grade, Verdict

INSTRUCTION = """You are the Chief of Sarawak Earth Detectives, writing a short note on a school
student's case file. Write two or three short sentences, warm but honest, plain words, no lists.
Quote at least one thing the student actually did (a card they chose, a tool they used, words from
their verdict). Only use facts from the FILE. Never add a number that isn't in the FILE. Never say
what the correct verdict is. If the case was sent back, encourage one more careful try."""


def build_prompt(g: Grade, v: Verdict, steps: str) -> str:
    p = g.parts
    ending = {
        "solved": "SOLVED. The student's verdict is correct. Congratulate them; do not ask for another try.",
        "solved_not_enough": "SOLVED. The student correctly concluded that the record cannot settle the question yet. "
                             "That honest doubt IS the right answer. Congratulate them; do not ask for another try.",
        "sent_back": "SENT BACK. The verdict does not follow the evidence yet. The student may try once more.",
    }[g.ending]
    return f"""FILE
Ending: {ending} Score {g.score} of 100 (evidence {p.evidence} of 25, method {p.method} of 25,
verdict {p.verdict} of 30, explanation {p.explanation} of 20).
Grader's notes: {" ".join(g.feedback)}
Badges: {", ".join(b.replace("_", " ") for b in g.badges) or "none"}
Student's steps: {steps}
Student's verdict: what "{v.what}", where "{v.where}", direction {v.direction.replace("_", " ")},
how much "{v.how_much}", is it real: {v.is_it_real.replace("_", " ")}, why "{v.why_hypothesis}".

Write the Chief's note."""


async def note(g: Grade, v: Verdict, steps: str) -> tuple[str | None, str]:
    prompt = build_prompt(g, v, steps)
    text, _, err = await run_once("chief", INSTRUCTION, prompt, timeout=10)
    if text is None:
        return None, err
    text = re.sub(r"^\s*(the\s+)?chief'?s\s+note\s*:\s*", "", text, flags=re.I).strip()
    allowed = prompt + " 25 30 20 100"
    for chk in (guard.check_numbers(text, allowed),):
        if not chk.ok:
            return None, f"guard: {chk.reason}"
    if g.ending == "sent_back":
        chk = guard.check_answer(text, prompt)
        if not chk.ok:
            return None, f"guard: {chk.reason}"
    return text, ""
