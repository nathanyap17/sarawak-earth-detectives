"""Grading in plain code (MASTER_SHEET §5.2 "What is graded", §16 "How the verdict is graded").

Reasoning, not speed: evidence 25, method 25, verdict 30, explanation 20.
The right ticks alone never close a case: the written reasoning must back them (reasoning.py).
Feedback here is deterministic; the Chief agent may later reword it but never changes a score.
AI-assisted: written with Claude Code."""
from __future__ import annotations

import re
from dataclasses import dataclass

from app import reasoning
from app.schemas import AnswerKey, CasePack, Grade, GradeParts, Verdict
from app.vault.cards import CARDS

HEDGES = re.compile(r"\b(might|may|could|possibly|perhaps|likely|probably|suggests?|maybe|"
                    r"one reason|a possible)\b", re.I)
OVERCLAIM = re.compile(r"\b(proves?|proven|definitely|certainly|for sure|without doubt|"
                       r"100%|is caused by|the cause is)\b", re.I)
NUMBER = re.compile(r"[-+]?\d+(?:\.\d+)?")


@dataclass
class Attempt:
    chosen: list[str]
    tools: list[dict]  # {"tool", "card_id"} in order


def _expected(key: AnswerKey) -> tuple[set[str], str]:
    """Accepted directions and the correct "is it real" for the overall verdict."""
    o = key.overall
    if o == "worsening":
        return {"worsening"}, "yes"
    if o == "improving":
        return {"improving"}, "yes"
    if o == "no_change":
        return {"no_change"}, "no"
    return {"worsening", "improving", "no_change"}, "cant_tell"  # any lean, if they doubt it


def _lean(case: CasePack, key: AnswerKey) -> set[str]:
    """For not-enough-evidence cases: the raw lean of the main cards, plus no_change."""
    out = {"no_change"}
    for cid in case.main_cards:
        k, card = key.per_card[cid], CARDS[cid]
        if k.direction in ("rising", "falling") and card.worse_when:
            out.add("worsening" if k.direction == card.worse_when else "improving")
    return out


def grade(case: CasePack, key: AnswerKey, attempt: Attempt, v: Verdict, final: bool) -> Grade:
    fb: list[str] = []
    relevant = [c for c in case.evidence if c not in case.red_herrings]

    # --- evidence (25)
    chosen = set(attempt.chosen)
    main_frac = len(chosen & set(case.main_cards)) / len(case.main_cards)
    rel_frac = min(1.0, len(chosen & set(relevant)) / min(3, len(relevant)))
    herring = bool(chosen & set(case.red_herrings))
    evidence = 25 * (0.4 * main_frac + 0.2 * rel_frac + (0 if herring else 0.4))
    if herring:
        fb.append("One of your cards doesn't bear on this question. Ask what it has to do with "
                  "the event before you pin it.")
    if main_frac < 1:
        fb.append("You left out a record that goes to the heart of the question.")

    # --- method (25)
    order = [(t["tool"], t["card_id"]) for t in attempt.tools]
    seen_season, season_first, scales_on = set(), False, set()
    for tool, cid in order:
        if tool == "season":
            seen_season.add(cid)
        if tool == "scales":
            scales_on.add(cid)
            season_first = season_first or cid in seen_season
    lamp_on = {cid for tool, cid in order if tool == "elnino"}
    main = set(case.main_cards)
    method = (10 * (1 if season_first else 0)
              + 10 * len(scales_on & main) / len(main)
              + 5 * (1 if lamp_on & main else 0))
    if not season_first:
        fb.append("Remove the seasons with the tinted lens before you weigh a trend.")
    if (scales_on & main) != main:
        fb.append("Weigh every main record on the scales, so both tests have their say.")
    if not lamp_on & main:
        fb.append("Strong El Nino years can fake a trend. The lamp would have told you.")

    # --- the student's own words (reasoning.py): read before any marks are given for the ticks
    r = reasoning.read(case, attempt.chosen, v)

    # --- verdict (30): the stand itself, then whether the words back it
    dirs, real = _expected(key)
    if key.overall == "not_enough_evidence":
        dirs = _lean(case, key)
    dir_ok = v.direction in dirs
    real_ok = v.is_it_real == real
    nums = [float(x) for x in NUMBER.findall(v.how_much)]
    ranges = [key.per_card[c].range for c in case.main_cards]
    if nums:
        much_ok = any(lo <= n <= hi for n in nums for lo, hi in ranges)
    else:   # no figure is right only where there is no change to measure, and only if it says so in words
        much_ok = key.overall in ("not_enough_evidence", "no_change") and r.how_much.ok
    backed = next(c.ok for c in r.checks if c.id == "stance")
    # a stand earns its full marks only when the student's words back it
    verdict = (real_ok * (10 if backed else 3) + (dir_ok and not r.contradictions) * (5 if backed else 2)
               + 5 * much_ok + 6 * backed + 4 * bool(r.cites))
    if not real_ok:
        fb.append("Your answer to 'is it real?' doesn't match the stamps on your own evidence. "
                  "Look again at what the scales and the lamp said.")
    if not much_ok:
        fb.append("Your 'how much' figure sits outside the range your ruler gave." if nums else
                  "Answer 'how much' properly: give the rate from your ruler, or say in words why the record can't measure one.")

    # --- explanation (20): a cause offered as a possibility, in the student's own words
    hedged = bool(HEDGES.search(v.why_hypothesis))
    over = bool(OVERCLAIM.search(v.why_hypothesis))
    if not r.why.ok or not r.cause_named:
        explanation = 0.0
    else:
        explanation = 6 * r.cause_named + 6 * hedged + 4 * (not over) + 4 * (len(r.why.content) >= 7)
    if over:
        fb.append("A trend can't prove a cause. Word your 'why' as a possibility.")
    elif r.why.ok and r.cause_named and not hedged:   # praise a cause only when one was named
        fb.append("Good idea for a cause. Say 'might' or 'could': it's a hypothesis.")

    # what the reading found wrong goes out as Grade.checks (shown on its own), not repeated here

    # --- ending: the right ticks only close a case when the student's words hold them up
    if not r.sound:
        ending = "sent_back"
        fb.insert(0, "A verdict has to be argued, not just ticked. Your written reasoning doesn't hold it up yet.")
    elif key.overall == "not_enough_evidence" and real_ok:
        ending = "solved_not_enough"
    elif real_ok and dir_ok:
        ending = "solved"
    else:
        ending = "sent_back"
    if ending == "sent_back" and not final:
        fb.insert(0, "Case sent back. You have one more try.")

    # --- badges
    badges = []
    if season_first:
        badges.append("clean_signal")
    if not herring and len(chosen) >= 3:
        badges.append("red_herring")
    if ending == "solved_not_enough":
        badges.append("honest_doubt")
    if len(scales_on) >= 2:
        badges.append("second_opinion")
    if any(t == "twin" for t, _ in order):
        badges.append("twin_trail")
    if lamp_on:
        badges.append("elnino_eye")

    if ending != "sent_back":
        fb.insert(0, "Case closed. Good detective work." if not fb else
                  "Case closed. A few things to sharpen next time:")
    parts = GradeParts(evidence=round(evidence, 1), method=round(method, 1),
                       verdict=round(verdict, 1), explanation=round(explanation, 1))
    score = round(parts.evidence + parts.method + parts.verdict + parts.explanation, 1)
    return Grade(score=score, parts=parts, ending=ending, feedback=fb, badges=badges, checks=r.checks)
