"""The Reporter: a standard, professional executive summary of a closed case, for a teacher, a
parent or a judge.

Why a new agent (not the Chief): the Chief writes two or three warm sentences to the student,
right after grading. The Reporter writes for another reader, in fixed sections, after the case is
closed. Same leash as the others: its only source is the facts sheet built by code
(reports/casefile.facts), every figure must already be in that sheet (number guard), and when the
model is slow, off or blocked, the summary is written by a code template instead.
AI-assisted: written with Claude Code."""
from __future__ import annotations

import json

from app.agents import guard
from app.agents.runtime import run_once

REAL = {"yes": "real", "no": "not real", "cant_tell": "not yet provable from the evidence"}
SECTIONS = ("purpose", "method", "findings", "conclusion", "limitations")

INSTRUCTION = """You are the Reporter of Sarawak Earth Detectives. Write a short, professional
executive summary of one student's closed case, for a teacher or a competition judge.
Use ONLY the FACTS. Never add a number, date or name that is not in the FACTS. Never do a calculation.
Write in the third person about "the detective" (use the nickname once). Formal, clear, no hype.
Report what the student's tests showed and what they concluded; do not judge beyond the grader's notes.
Return JSON with exactly these keys, each a string of one to three sentences:
"purpose", "method", "findings", "conclusion", "limitations"."""


def template(cf: dict) -> dict[str, str]:
    """The code-written summary: used when the model is not."""
    c, g, v = cf["case"], cf["grade"], cf["verdict"] or {}
    tested = [t for t in cf["tests"] if t["stamp"]]
    find = "; ".join(f"{t['card']} ({t['tool'].split(' (')[0]}): {t['stamp'].lower()}"
                     + (f", {t['rate']} {t['unit']}" if t["rate"] else "") for t in tested[:6])
    return {
        "purpose": f"Case {c['id']}, {c['title']}, asked: {c['question']} The study area was {c['region']}.",
        "method": f"The detective {cf['detective']} selected {len(cf['evidence'])} NASA records "
                  f"({', '.join(e['name'] for e in cf['evidence']) or 'none'}) and ran {len(cf['tests'])} statistical "
                  "checks in code, including trend lines with the t-test and the Mann-Kendall rank test.",
        "findings": (f"Results: {find}." if find else "No significance tests were recorded."),
        "conclusion": (f"The detective concluded \"{v.get('what', '')}\" and judged the change "
                       f"{REAL.get(v.get('is_it_real'), v.get('is_it_real'))}. Outcome: {g['ending']}, score {g['score']:g} of 100.")
                      if v else f"Outcome: {g['ending']}.",
        "limitations": " ".join(c["limits"][:2]),
    }


async def summarise(cf: dict, facts: str) -> tuple[dict[str, str], str, str]:
    """(sections, source "ai" | "code", note)."""
    text, _, err = await run_once("reporter", INSTRUCTION, f"FACTS\n{facts}\n\nWrite the summary as JSON.",
                                  timeout=25, max_tokens=900, as_json=True)
    if text is None:
        return template(cf), "code", err
    try:
        data = json.loads(text.strip().removeprefix("```json").removesuffix("```"))
        out = {k: str(data[k]).strip() for k in SECTIONS}
    except (ValueError, KeyError, TypeError):
        return template(cf), "code", "bad json"
    allowed = facts + " 95 0.05 1991 2020"
    for k, t in out.items():
        chk = guard.check_numbers(t, allowed)
        if not chk.ok or not t:
            return template(cf), "code", f"guard ({k}): {chk.reason or 'empty'}"
    return out, "ai", ""
