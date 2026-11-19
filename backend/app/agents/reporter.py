"""The Reporter: the executive summary of a case, written as the agency's exemplar report, for a
teacher, a parent, a judge or the student who just closed the case.

Changed 2026-11-19: the summary is an exemplar, not the student's report card. It covers every record
that bears on the question (insights.py), tells the story of what is significant and what is not and
why, and says nothing about the student's marks, badges or verdict (the case study has those).
Why a separate agent (not the Chief): the Chief writes two or three warm sentences to the student,
right after grading. The Reporter writes for another reader, in fixed sections. Same leash as the
others: its only source is the facts sheet built by code (insights.facts), every figure must already
be in that sheet (number guard), and when the model is slow, off or blocked, a code template writes it.
AI-assisted: written with Claude Code."""
from __future__ import annotations

import json
import re

from app.agents import guard
from app.agents.runtime import run_once
from app.schemas import CasePack

SECTIONS = ("headline", "issue", "response", "insights", "impact")

INSTRUCTION = """You are the Reporter of Sarawak Earth Detectives. Write the text of the agency's exemplar
executive report on one case: a model answer showing how the evidence should be read, for a teacher, a
parent, a competition judge or a student. It tells a story: the issue, how the analysis responded, what
the evidence showed, and what it means next.
Use ONLY the FACTS. Never add a number, date or name that is not in the FACTS. Never do a calculation.
Write in the third person about "the analysis" or "the agency". Never mention any student, score, mark or badge.
Clear and formal, but vivid. Charts with their own captions sit under "insights", so interpret them.
In "insights", cover BOTH kinds of result: which records are significant and what the line and the tests say
(rate, Sen's slope, R²), and which are not significant or stop being significant once El Nino is removed, and
by which measures that is shown (linear regression t-test, Mann-Kendall, the 0.05 line, the 95% range, the El
Nino re-test). Use each chart's stamps and groups exactly as written; never generalise a result to records it
was not stated for. A significant line drawn forward is an illustration, never a forecast.
Never claim a cause: a trend that stops being significant once El Nino is removed means El Nino years MAY be
doing much of the work, not that El Nino "drives" or "causes" it. Say what the evidence supports and what it
cannot yet show.
A result that is not significant, or stops being significant once El Nino is removed, never shows that nothing
changed: when no record survives every check, the answer is that the record cannot yet tell. Never conclude that
a year "was one bad year", that a trend is ruled out, or that conditions are not worsening.
Return JSON with exactly these keys, each a string:
"headline": one sentence (under 25 words) that sums up the case and what the evidence supports;
"issue": two or three sentences on the problem in the region and the question asked;
"response": two or three sentences on the records analysed and the tests run on each;
"insights": four to six sentences interpreting the results across the charts, significant and not;
"impact": two or three sentences on what the evidence supports, what it does not, and sensible next steps
(more years, a second region, other records), without promising anything the facts do not support."""


# Conclusions the evidence can never support: absence of significance is not evidence of no change, and a
# trend is never proof of a cause. Seen live on 2026-11-20 ("meaning 2026 was one bad year").
NO_CHANGE_CLAIM = re.compile(
    r"\b(was|is|were) (just |simply |only |merely )?(one|a single|an?) (bad|unusual|freak|isolated|one-off) year"
    r"|\bone-off\b|\bno (real |long-term |lasting )?(change|trend) (exists|existed|occurred)"
    r"|\b(is|are|was|were) not (getting )?worse(ning)?\b|\bnot (a )?worsening\b", re.I)
CAUSE_CLAIM = re.compile(r"\b(driven|caused) by\b|\bel ni[nñ]o (drives|drove|causes|caused)\b|\bprov(e|es|ed|en)\b", re.I)
NEGATED = re.compile(r"\b(not|cannot|can't|nor|never|no|without)\b[^.]{0,25}$", re.I)
ASKED = re.compile(r"\b(whether|if)\b[^.,;]{0,40}$", re.I)


def overclaims(text: str) -> str:
    """The first claim in the text that the evidence cannot support, or "". Restating the question
    ("whether 2026 was one bad year") is fine, and so is denying a cause ("cannot yet prove what causes
    fires"); concluding no change, or asserting a cause, is not."""
    for m in NO_CHANGE_CLAIM.finditer(text):
        if not ASKED.search(text[:m.start()]):
            return m.group(0)
    for m in CAUSE_CLAIM.finditer(text):
        if not NEGATED.search(text[:m.start()]):
            return m.group(0)
    return ""


def _names(items: list[dict], group: str) -> list[str]:
    return [i["name"] for i in items if i["group"] == group]


def template(c: CasePack, items: list[dict]) -> dict[str, str]:
    """The code-written exemplar text: used when the model is not."""
    robust, elnino, nots = _names(items, "robust"), _names(items, "elnino"), _names(items, "not")
    region = c.region.name
    if robust:
        head = (f"{', '.join(robust)} in {region} show a trend that passes both tests and survives the El Niño check.")
    elif elnino:
        head = (f"Trends in {region} pass both tests at first but not once El Niño years are accounted for: "
                "the record cannot yet settle the question.")
    elif items:
        head = f"No record in {region} shows a trend strong enough to rule out chance."
    else:
        head = f"Case {c.id}, {c.title}."
    ins = []
    if robust:
        ins.append(f"Significant and robust: {', '.join(robust)}. Linear regression and the Mann-Kendall test both fall "
                   "below the 0.05 line, agree on direction, and still pass with the El Niño effect removed.")
    if elnino:
        ins.append(f"Significant at first, but not once El Niño is removed: {', '.join(elnino)}. Both tests pass on the raw "
                   "record, yet after the El Niño years are accounted for the re-test no longer clears the 0.05 line, so "
                   "El Niño years may be doing much of the work.")
    if nots:
        ins.append(f"Not significant: {', '.join(nots)}. The tests stay above the 0.05 line or the 95% range of the slope "
                   "includes zero, so the tilt could be year-to-year noise.")
    if not items:
        ins.append("No record could be tested.")
    supports = (f"The evidence supports a real change in {', '.join(robust)}." if robust else
                "No change survives every check yet, so the record cannot tell whether conditions are worsening.")
    return {
        "headline": head,
        "issue": f"{c.brief} The case asked: {c.question}",
        "response": (f"The analysis took {len(items)} NASA records ({', '.join(i['name'] for i in items) or 'none'}) and ran "
                     "the same checks on each: a linear regression with a t-test, the Mann-Kendall rank test with Sen's "
                     "slope, R² of the line, and the same tests again with the El Niño effect removed."),
        "insights": " ".join(ins),
        "impact": (f"{supports} Next steps: re-test as new satellite years arrive, compare a second "
                   "region, and keep the case's limits in view: " + " ".join(c.limits[:1])),
    }


async def summarise(c: CasePack, facts: str, items: list[dict]) -> tuple[dict[str, str], str, str]:
    """(sections, source "ai" | "code", note)."""
    text, _, err = await run_once("reporter", INSTRUCTION, f"FACTS\n{facts}\n\nWrite the summary as JSON.",
                                  timeout=25, max_tokens=1200, as_json=True)
    if text is None:
        return template(c, items), "code", err
    try:
        data = json.loads(text.strip().removeprefix("```json").removesuffix("```"))
        out = {k: str(data[k]).strip() for k in SECTIONS}
    except (ValueError, KeyError, TypeError):
        return template(c, items), "code", "bad json"
    allowed = facts + " 95 0.05 1991 2020"
    for k, t in out.items():
        chk = guard.check_numbers(t, allowed)
        if not chk.ok or not t:
            return template(c, items), "code", f"guard ({k}): {chk.reason or 'empty'}"
        if claim := overclaims(t):
            return template(c, items), "code", f"guard ({k}): over-claims ({claim})"
    return out, "ai", ""
