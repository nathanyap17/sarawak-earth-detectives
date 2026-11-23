"""Plain explanations of the detective's tools and statistics, written by people, in code.

The Partner may explain these freely (they are about methods, not about this case's data), and
when the model is slow or blocked, a question about one of them is answered from here instead of
with a stock hint. Numbers here (0.05, 95, 1991-2020) are method facts, so they are approved text
for the number guard.
AI-assisted: written with Claude Code."""
from __future__ import annotations

import re

CONCEPTS: dict[str, tuple[str, str]] = {
    # key: (pattern that spots the question, explanation). Checked in this order.
    # Added 2026-11-23 from docs/SED-Statistics-Reference.md; the specific ones come first.
    "sen": (r"\bsen\b|sen'?s|theil",
        "Sen's slope draws a little line between every pair of years and takes the middle tilt. "
        "A few wild years cannot move it much, so the scales use it as a direction check: it must point the same way as the ruler. "
        "If it doesn't, a few extreme years are doing the work."),
    "hac": (r"\bhac\b|newey|autocorrel|hamed|rao|memory",
        "A wet year is often followed by another wet year, so the years are not independent. "
        "Ordinary formulas would then be too sure of themselves, so the scales use corrections (HAC for the ruler, Hamed-Rao for Mann-Kendall) "
        "that make the range honestly wider."),
    "band": (r"too small|small to matter|\bband\b|equivalen",
        "Each card has a 'too small to matter' band. Significant only says a change is not luck; the band asks whether it is big enough to care about. "
        "If even the whole 95% range sits inside the band, the change is real but too small to matter, or, without both tests, confidently near flat."),
    "shuffle": (r"shuffl|permutation",
        "The shuffle test mixes up the years 1,000 times and fits a line each time. "
        "If almost no shuffled record tilts as steeply as the real one, the order of the years matters, so there is a trend. "
        "It is a picture of what a p-value means, but the scales stay the official judge."),
    "my_line": (r"my line|by hand|by eye|lay.*line|score",
        "My line lets you lay the line by eye, then scores how close it is to the best line, measured against how much the dots wobble. "
        "It is for practice and never changes your verdict."),
    "null": (r"null|hypothes",
        "The null hypothesis is the 'nothing is happening' idea a test tries to knock down. "
        "Each test asks how surprising your record would be if nothing were really changing."),
    "stamp": (r"stamp|not clear yet|record too short",
        "The scales give one of four stamps. Under 20 years: record too short. Both tests below 0.05 with Sen's slope agreeing: significant. "
        "The whole 95% range inside the 'too small to matter' band: not significant. Anything else: not clear yet."),
    "grade": (r"grade|marks?\b|points?\b|how.*scor",
        "The grade is out of 100: evidence 25, method 25, verdict 30 and explanation 20. "
        "Method points come from using the season filter before the scales, the scales on every main card and the El Nino lamp."),
    "disagree": (r"disagree|don'?t agree|differ|both tests|two tests",
        "The ruler's t-test trusts the size of every year, so one extreme year can swing it. "
        "Mann-Kendall only counts ups and downs, so it shrugs off wild years. "
        "When they disagree, the record is telling you the evidence is shaky; a careful detective says so in the verdict."),
    "mann_kendall": (r"mann|kendall|\bmk\b|rank test",
        "The Mann-Kendall test looks at every pair of years and asks: is the later year higher or lower? "
        "If far more pairs go one way than chance would give, the trend is probably real. "
        "It ignores how big the jumps are, so one wild year cannot fool it."),
    "t_test": (r"t[- ]?test|regression|least squares|straight line|slope|ruler",
        "The ruler fits the straight line that runs closest to every yearly dot, and its slope is the rate of change. "
        "The t-test then asks how likely that slope is if nothing were really changing. "
        "One strange year can tip the ruler, which is why the scales also run Mann-Kendall."),
    "p_value": (r"p[- ]?value|\bp\b|probab|chance",
        "A p-value is how surprising your line would be if nothing were really changing. "
        "Below 0.05 means: less than 1 chance in 20 of seeing this by luck, so detectives call it significant. "
        "Above 0.05 does not prove nothing is happening; it means the record has not convinced us yet."),
    "range": (r"range|confidence|interval|fan|uncertain|error bar",
        "The shaded fan is the 95% range: the slopes that still fit the dots almost as well. "
        "If the fan includes a flat line, the record cannot rule out 'no change'. "
        "A narrow fan away from flat is strong evidence."),
    "significant": (r"significan",
        "Significant means the change is unlikely to be just luck: both tests on the scales clear the 0.05 bar. "
        "It does not mean big or scary; a small change can be significant over a long record. "
        "When the tests disagree, a careful detective says so."),
    "years": (r"more years|years needed|too short|long enough|needs more",
        "'Not clear yet' (the needs-more-years stamp) means the record is long enough to test, but the year-to-year wobble "
        "is too big to separate a real change from natural ups and downs. It is not about a short record: that stamp is "
        "'Record too short', under 20 years. It is an honest result, not a failure. "
        "Detectives write it down and, when the stamp gives one, say about how many more years would settle it."),
    "season": (r"season|monsoon|month|normal",
        "Some months are always wetter or hotter than others. "
        "The season filter compares each month with its own 1991-2020 normal, so the ruler measures real change, not the calendar."),
    "elnino": (r"el ?ni[nñ]o|enso|oni|lamp",
        "El Nino is a warming of the Pacific that makes Borneo drier and hotter in some years. "
        "The El Nino lamp takes that effect out and runs the scales again. "
        "If a trend fades when the lamp is on, El Nino may have been doing the work."),
    "twin": (r"twin|other region|compare region",
        "The twin map runs the same test on a second region. "
        "If both regions change the same way, the cause is probably wide, like climate. "
        "If only one changes, look for something local."),
    "red_herring": (r"red herring|distract|wrong card|which card",
        "A red herring is a card that looks related but cannot answer the question. "
        "Ask of each card: could this record actually explain what happened, in this place, at this time of year?"),
    "verdict": (r"verdict|not enough evidence|can'?t tell|which answer|what do i (write|pick|choose)",
        "Your verdict should follow your stamps. "
        "If the main cards are significant and agree, the record supports a change. "
        "If the scales keep saying 'not clear yet', not enough evidence is the honest answer, and it can win the case."),
}


def match(question: str) -> str | None:
    q = question.lower()
    for _, (pat, text) in CONCEPTS.items():
        if re.search(pat, q):
            return text
    return None


def sheet() -> str:
    """All explanations, for the Partner's prompt and for the number guard's approved text."""
    return "\n".join(f"- {k.replace('_', ' ')}: {t}" for k, (_, t) in CONCEPTS.items())
