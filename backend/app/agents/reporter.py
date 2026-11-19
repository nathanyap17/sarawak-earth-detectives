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
SECTIONS = ("headline", "issue", "response", "insights", "impact")

INSTRUCTION = """You are the Reporter of Sarawak Earth Detectives. Write the text of a short executive report
on one student's closed case, for a teacher, a parent or a competition judge. The report tells a story:
the issue, how the detective responded, what the evidence showed, and what it means next.
Use ONLY the FACTS. Never add a number, date or name that is not in the FACTS. Never do a calculation.
Write in the third person about "the detective" (use the nickname once). Clear and formal, but vivid.
Charts with their own captions sit under "insights", so interpret them; do not list every figure.
Say which trends are significant and which are not, and why (the 0.05 line, the two tests, El Nino).
Use each chart's stamps exactly as written (for example "Not significant" is not "Needs more years"); never generalise
a result to records it was not stated for.
Return JSON with exactly these keys, each a string:
"headline": one sentence (under 25 words) that sums up the case and its finding;
"issue": two or three sentences on the problem in the region and the question asked;
"response": two or three sentences on what the detective did (evidence chosen, tests, tools);
"insights": three or four sentences interpreting the results across the charts;
"impact": two or three sentences on what this means and sensible next steps (more years, other
regions or records), without promising anything the facts do not support."""


def template(cf: dict, items: list[dict] | None = None) -> dict[str, str]:
    """The code-written report text: used when the model is not."""
    c, g, v = cf["case"], cf["grade"], cf["verdict"] or {}
    items = items or []
    sig = [i["name"] for i in items if i["significant"]]
    not_sig = [i["name"] for i in items if not i["significant"]]
    tools = sorted({t["tool"].split(" (")[0] for t in cf["tests"]})
    if sig:
        head = f"{', '.join(sig)} in {c['region']} show a significant trend; the detective tested it with two independent tests."
    elif items:
        head = f"No tested record in {c['region']} shows a trend strong enough to rule out chance: an honest-doubt finding."
    else:
        head = f"Case {c['id']}, {c['title']}: the detective's investigation of {c['region']}."
    insights = []
    if sig:
        insights.append(f"Significant (both tests below 0.05): {', '.join(sig)}.")
    if not_sig:
        insights.append(f"Not significant: {', '.join(not_sig)}; their tilts are within what year-to-year noise can produce.")
    if not items:
        insights.append("No significance tests were recorded.")
    return {
        "headline": head,
        "issue": f"{c['brief']} The case asked: {c['question']}",
        "response": f"The detective {cf['detective']} chose {len(cf['evidence'])} NASA records "
                    f"({', '.join(e['name'] for e in cf['evidence']) or 'none'}) and ran {len(cf['tests'])} checks in the lab"
                    + (f" ({', '.join(tools)})" if tools else "") + ", weighing each trend with linear regression and the Mann-Kendall test.",
        "insights": " ".join(insights),
        "impact": ((f"The detective concluded \"{v.get('what', '')}\" and judged the change "
                    f"{REAL.get(v.get('is_it_real'), v.get('is_it_real'))}. ") if v else "")
                  + "Next steps: re-test as new satellite years arrive, compare a second region, and check the record against "
                    "the case's limits: " + " ".join(c["limits"][:1]),
    }


async def summarise(cf: dict, facts: str, items: list[dict] | None = None) -> tuple[dict[str, str], str, str]:
    """(sections, source "ai" | "code", note)."""
    text, _, err = await run_once("reporter", INSTRUCTION, f"FACTS\n{facts}\n\nWrite the summary as JSON.",
                                  timeout=25, max_tokens=1200, as_json=True)
    if text is None:
        return template(cf, items), "code", err
    try:
        data = json.loads(text.strip().removeprefix("```json").removesuffix("```"))
        out = {k: str(data[k]).strip() for k in SECTIONS}
    except (ValueError, KeyError, TypeError):
        return template(cf, items), "code", "bad json"
    allowed = facts + " 95 0.05 1991 2020"
    for k, t in out.items():
        chk = guard.check_numbers(t, allowed)
        if not chk.ok or not t:
            return template(cf, items), "code", f"guard ({k}): {chk.reason or 'empty'}"
    return out, "ai", ""
