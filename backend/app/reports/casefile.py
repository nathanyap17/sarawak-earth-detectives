"""The case file: everything a student did on one case, from the brief to the Chief's stamp, in
order, for the printable case study and for the Reporter's executive summary.

Built only from the session (what the student did and what the code computed for them). It never
reads the answer key. It is only built once the case is closed, so a student who may still retry
cannot use it to see the grader's notes early.
AI-assisted: written with Claude Code."""
from __future__ import annotations

from app.schemas import CasePack
from app.vault.cards import CARDS

TOOL = {"magnifier": "Magnifier", "season": "Season filter", "ruler": "Ruler (trend line, t-test)",
        "scales": "Scales (t-test and Mann-Kendall)", "elnino": "El Niño lamp", "twin": "Twin map"}
STAMP = {"significant": "Significant", "not_significant": "Not significant",
         "needs_more_years": "Needs more years", "record_too_short": "Record too short"}
ENDING = {"solved": "Solved", "solved_not_enough": "Solved: not enough evidence (honest doubt)",
          "sent_back": "Sent back"}


def fmt(x: float | None, p: bool = False) -> str | None:
    """One format for every figure, used by the printout and by the Reporter's number guard."""
    if x is None:
        return None
    if p:
        return "below 0.001" if x < 0.001 else f"{x:.3f}"
    return f"{x:+.3g}" if abs(x) >= 0.001 else f"{x:+.2e}"


def closed(s) -> bool:
    return bool(s.grade) and not s.grade.get("can_retry", False)


def build(s, c: CasePack) -> dict:
    name = lambda i: CARDS[i].name if i in CARDS else i  # noqa: E731
    steps: list[dict] = []
    for e in s.log:
        k = e.get("kind")
        if k == "start":
            steps.append({"at": e["at"], "stage": "The call", "what": f"Opened case {c.id}: {c.title}."})
        elif k == "clue":
            steps.append({"at": e["at"], "stage": "The scene", "what": "Dropped a pin on the map to inspect a spot."})
        elif k == "pins":
            steps.append({"at": e["at"], "stage": "The scene", "what": f"Moved or removed pins ({e.get('n', 0)} left on the map)."})
        elif k == "choose":
            steps.append({"at": e["at"], "stage": "Evidence locker",
                          "what": "Chose the evidence: " + ", ".join(name(i) for i in e.get("cards", [])) + "."})
        elif k == "tool":
            stamp = STAMP.get(e.get("stamp") or "", "")
            steps.append({"at": e["at"], "stage": "The lab",
                          "what": f"Used the {TOOL.get(e['tool'], e['tool'])} on {name(e['card_id'])}" + (f": {stamp}." if stamp else ".")})
        elif k == "workbench":
            what = "laid a trend line by hand" if e.get("what") == "myline" else "shuffled the years to see what chance can do"
            steps.append({"at": e["at"], "stage": "The lab", "what": f"On {name(e.get('card_id', ''))}, {what}."})
        elif k == "partner":
            steps.append({"at": e["at"], "stage": "Partner", "what": "Asked Kenyalang for help."})
        elif k == "verdict":
            steps.append({"at": e["at"], "stage": "The deduction",
                          "what": f"Signed verdict attempt {e.get('attempt')}: {ENDING.get(e.get('ending'), e.get('ending'))}, score {e.get('score'):g}."})

    tests = []
    for a in s.analyses:
        tests.append({
            "card": name(a["card_id"]), "tool": TOOL.get(a["tool"], a["tool"]), "mission": a.get("mission"),
            "data_as_of": a.get("data_as_of"), "n_years": a.get("n_years"),
            "rate": fmt(a.get("rate_per_decade")), "unit": a.get("unit"),
            "range": [fmt(x) for x in a["range"]] if a.get("range") else None,
            "t_test_p": fmt(a.get("t_test_p"), p=True), "mann_kendall_p": fmt(a.get("mann_kendall_p"), p=True),
            "stamp": STAMP.get(a.get("stamp") or "", None), "direction": a.get("direction"),
            "years_needed": ("more than 50" if (a.get("years_needed") or 0) > 50 else a.get("years_needed")),
            "elnino_r": fmt(a.get("elnino_r")),
        })
    v = s.verdicts[-1] if s.verdicts else None
    g = s.grade or {}
    return {
        "case": {"id": c.id, "title": c.title, "question": c.question, "brief": c.brief,
                 "region": c.region.name, "twin_region": c.twin_region.name if c.twin_region else None,
                 "sources": [src.model_dump() for src in c.sources], "limits": c.limits},
        "detective": s.nickname, "started": s.created_at, "finished": s.log[-1]["at"] if s.log else s.created_at,
        "evidence": [{"name": CARDS[i].name, "definition": CARDS[i].definition, "mission": CARDS[i].mission}
                     for i in s.chosen if i in CARDS],
        "pins": len(s.clue_pins),
        "steps": steps, "tests": tests,
        "partner": [{"q": h.get("q") or "(asked for a hint)", "a": h.get("a"), "by": "AI" if h.get("source") == "ai" else "approved hint"}
                    for h in s.partner_chat],
        "verdict": ({k: v[k] for k in ("what", "where", "direction", "how_much", "is_it_real", "why_hypothesis", "confidence")}
                    | {"reasoning": v.get("reasoning", "")}) if v else None,
        "attempts": len(s.verdicts),
        "grade": {"score": g.get("score"), "parts": g.get("parts"), "ending": ENDING.get(g.get("ending"), g.get("ending")),
                  "feedback": g.get("feedback", []), "badges": g.get("badges", []), "chief_note": g.get("chief_note"),
                  "checks": g.get("checks", [])},
    }
