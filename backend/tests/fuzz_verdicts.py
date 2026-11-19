"""Stress test for the grader: thousands of made-up verdicts (junk, half-hearted, argued, wrong stands),
against case 001's real answer key and against made-up keys for the other three outcomes.
Run: cd backend && uv run python -m tests.fuzz_verdicts   (prints wrong closes and missed good answers)
The asserted subset lives in test_grading.py; this script is the wide net.
AI-assisted: written with Claude Code."""
from __future__ import annotations

import json
from pathlib import Path

from app.grading import Attempt, grade
from app.schemas import AnswerKey, CasePack, Verdict
from app.vault.store import root

CASE = CasePack(**json.loads((Path(__file__).resolve().parents[2] / "cases" / "001.json").read_text("utf-8")))
MAIN = ["soil_dry3", "humidity_feb_apr"]
GOOD = Attempt(chosen=MAIN + ["dry_spell"],
               tools=[{"tool": t, "card_id": c} for c in MAIN for t in ("season", "scales", "elnino")])
LAZY = Attempt(chosen=MAIN, tools=[])

# Nobody should close a case with these in a written field, whatever they tick.
JUNK = ["I don't know", "idk", "Idk.", "no idea lol", "dunno", "?", "asdfgh", "qwerty uiop", "whatever",
        "random answer", "I don't know what to write here sorry", "nothing", "aaaaaaa", "lorem ipsum dolor sit amet",
        "hello hello hello hello", "ok ok ok ok ok ok", "i guess so", "because i said so", "yes", "no",
        "the the the the the the", "I am not sure about this at all", "just guessing", "maybe maybe maybe",
        "pizza is nice and cats are cute", "My favourite colour is blue and I like football",
        "skibidi toilet rizz", "123 456 789", "...", "I don't know, it might be something",
        "test test test test", "can't tell", "not enough", "el nino", "significant", "trust me bro",
        "idk the soil maybe", "I really do not know what is happening here", "I just picked the answer",
        "this is my answer because it is the answer", "no comment", "can't tell can't tell can't tell",
        "The answer is can't tell", "it is real", "not real", "I think so", "same as the question"]

# Reasons that only restate the ticked box, or are keyword salad: never enough on their own.
EMPTY_REASONS = ["not enough evidence because not enough evidence", "Can't tell yet: not enough evidence",
                 "I can't tell because there is not enough evidence", "It is not enough evidence so I can't tell",
                 "I chose can't tell because I think we can't tell", "Because the answer is can't tell yet",
                 "Yes, it is significant because it is significant", "It is real because it is real and significant",
                 "No, there is no real change because nothing changed", "soil humidity rain fire peat",
                 "I picked yes because the answer is yes", "there is no real change, no"]

WHAT = ["Soil wetness in the driest months and air humidity Feb-Apr", "How dry the peat soil and the air get before fire season",
        "fire weather: soil moisture and humidity", "The wetness of soil in dry months"]
REASON = {
    "cant_tell": [
        "The tests said significant at first but after the El Nino lamp the stamp went to needs more years.",
        "Too few years of data to be sure.",
        "When I turned on the El Nino lamp the trends were not significant any more, so I cannot be sure.",
        "The scales and the ruler disagree for humidity, so the record is inconclusive for now.",
        "The rise only shows up in El Nino years, take those out and there is no clear trend.",
        "Soil wetness rose but humidity was not significant once El Nino was removed, the evidence is mixed.",
        "45 years is not long enough to separate the trend from natural ups and downs",
        "The stamp says needs more years on soil wetness after I checked El Nino",
        "After removing the El Nino effect the soil trend could just be chance",
    ],
    "yes": [
        "Both tests stamped soil wetness significant and it stayed significant with the El Nino lamp on.",
        "The Mann-Kendall p-value is below 0.05 for both cards and the trend line rises steadily.",
        "My ruler gave 0.013 per decade and both tests agreed it is significant.",
    ],
    "no": [
        "The trend line is flat and the scales said not significant for both records.",
        "The rate is too small to matter, inside the band, and the tests found no significant change.",
        "Soil wetness stayed about the same over 45 years, no real trend on the scales.",
    ],
}
WHY = ["It might be El Nino years making some dry seasons worse, not a lasting change.",
       "Drainage of peat for plantations could be drying the ground.",
       "Maybe La Nina years made it wetter, which could hide a real change.",
       "Possibly climate change, but logging and land clearing may also matter."]
HOW = {"cant_tell": ["The record can't measure it yet", "Can't say how much, too uncertain", "about 0.01 per decade but not certain"],
       "yes": ["about 0.013 per decade", "0.2 per decade for humidity"],
       "no": ["Too small to matter, close to zero", "no measurable change"]}
DIRS = ["worsening", "improving", "no_change"]
RIGHT = {"worsening": "yes", "improving": "yes", "no_change": "no", "not_enough_evidence": "cant_tell"}


def verdict(**kw) -> Verdict:
    base = dict(session_id="x", what=WHAT[0], where="Northern Sarawak", direction="no_change",
                how_much=HOW["cant_tell"][0], is_it_real="cant_tell", why_hypothesis=WHY[0], confidence=2,
                reasoning=REASON["cant_tell"][0])
    base.update(kw)
    return Verdict(**base)


def keys() -> dict[str, AnswerKey]:
    real = AnswerKey(**json.loads((root() / "answer_keys" / "001.json").read_text("utf-8")))
    out = {"not_enough_evidence": real}
    for o in ("worsening", "improving", "no_change"):
        k = real.model_copy(deep=True)
        k.overall = o
        out[o] = k
    return out


def run(step: int = 1) -> tuple[int, list, list]:
    """step > 1 takes every step-th junk phrase (a quicker pass for pytest)."""
    wrong, missed, n = [], [], 0
    for overall, key in keys().items():
        right = RIGHT[overall]
        for j in JUNK[::step]:
            for d in DIRS:
                for real in ("yes", "no", "cant_tell"):
                    for att in (GOOD, LAZY):
                        for field in ("all", "reasoning", "what", "why_hypothesis"):
                            if field == "all":
                                kw = dict(what=j, reasoning=j, why_hypothesis=j, how_much=j)
                            else:
                                kw = dict(what=WHAT[0], reasoning=REASON[real][0], why_hypothesis=WHY[0], how_much=HOW[real][0])
                                kw[field] = j
                            g = grade(CASE, key, att, verdict(direction=d, is_it_real=real, **kw), final=True)
                            n += 1
                            if g.ending != "sent_back":
                                wrong.append((overall, f"junk in {field}", j, d, real, g.ending))
        for r in EMPTY_REASONS:
            for d in DIRS:
                for real in ("yes", "no", "cant_tell"):
                    g = grade(CASE, key, GOOD, verdict(direction=d, is_it_real=real, reasoning=r,
                                                       how_much=HOW[real][0]), final=True)
                    n += 1
                    if g.ending != "sent_back":
                        wrong.append((overall, "empty reason", r, d, real, g.ending))
        for real, reasons in REASON.items():
            for r in reasons:
                for w in WHAT:
                    for why in WHY:
                        for h in HOW[real]:
                            for d in DIRS:
                                g = grade(CASE, key, GOOD, verdict(what=w, reasoning=r, why_hypothesis=why, how_much=h,
                                                                   is_it_real=real, direction=d), final=True)
                                n += 1
                                closed = g.ending != "sent_back"
                                if closed and real != right:
                                    wrong.append((overall, "wrong stand", r[:60], d, real, g.ending))
                                consistent = not ((d == "no_change" and real == "yes") or (d != "no_change" and real == "no"))
                                dir_ok = (d in ("no_change", "improving") if overall == "not_enough_evidence"
                                          else d == "no_change" if overall == "no_change" else d == overall)
                                if real == right and consistent and dir_ok and not closed:
                                    missed.append((overall, r, h, d, [c.id for c in g.checks if not c.ok]))
    return n, wrong, missed


if __name__ == "__main__":
    n, wrong, missed = run()
    print(f"{n} verdicts graded")
    print(f"CLOSED WRONGLY: {len(wrong)}")
    for x in dict.fromkeys(wrong):
        print("  ", x)
    print(f"ARGUED, RIGHT ANSWERS SENT BACK: {len(missed)}")
    for x in list(dict.fromkeys((m[1], m[2], tuple(m[4])) for m in missed))[:40]:
        print("  ", x)
