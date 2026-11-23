"""Output guard for agent text (rules 1 and 2). Plain code, no model.

- Number guard: every figure in agent text must already appear in text the code supplied
  (the case brief, card definitions, the approved hint ladder, the method sheet, the
  code-computed grade). Small counting numbers (0–5) are allowed. Numbers the student typed are
  NOT allowed, so the agent can't confirm a guess like "is it 0.13?".
- Answer guard (Partner only): blocks text that states a direction, rate, significance or
  verdict for the case. A result word inside a question or an if-sentence is a hint, not a
  statement, so it passes; so does "significant" in a sentence that explains a method.
  (Changed 2026-11-15: the old guard blocked the word "significant" anywhere, so the Partner
  could not even explain Mann-Kendall.)
  (Changed 2026-11-23: "rate per decade" with no figure, and "if p < 0.05", are method talk and
  pass; a figure per decade or any other p-value still blocks. A reply that teaches a statistics
  misconception from the reference's right/wrong table is blocked too. Decimal points no longer
  split sentences.)
AI-assisted: written with Claude Code."""
from __future__ import annotations

import re
from dataclasses import dataclass

NUM = re.compile(r"(?<![\w.])[-+−]?\d+(?:[.,]\d+)?%?")

# Phrases that hand over a result outright: always blocked unless the exact phrase is human-approved.
STATEMENT = re.compile(
    r"(?ix)"
    r"\b(the\s+)?(answer|verdict|solution|result)\s+(is|was|would\s+be|should\s+be)\b"
    r"|\b(choose|pick|select|write|tick|answer)\s+[\"'“]?(worsening|improving|no\s+change|yes|no|can'?t\s+tell|not\s+enough)\b"
    r"|[-+−]?\d[\d.,]*\s*(?:[^\s\d]+\s+){0,2}per\s+decade\b"   # a figure per decade; "rate per decade" alone is method talk
)
# A p-value stated for the case. Only the 0.05 line itself may appear, and only in an if/when sentence.
P_VALUE = re.compile(
    r"(?i)\b(?:p[- ]?values?(?:\s+(?!0?\.\d|\d)[\w'-]+){0,3}|p)\s*"
    r"(?:[<=>≤≥]|is|of|was|were|are|below|above|under|over|less\s+than|more\s+than|at)\s*(0?\.\d+|\d+(?:\.\d+)?)")
# Statistics misconceptions (docs/SED-Statistics-Reference.md §1.7): a reply that teaches one is wrong.
MISCONCEPTION = re.compile(
    r"(?ix)"
    r"\bp(?:[- ]?value)?\s+(?:is|=|means|tells\s+you)\s+(?:the\s+)?(?:chance|probability|odds)\s+(?:that\s+)?(?:the\s+)?"
    r"(?:trend|change|result|it)\s+(?:is|was)\s+(?:due\s+to\s+|just\s+)?(?:luck|chance|real|true)"
    r"|\b(?:above|over|bigger\s+than|more\s+than|greater\s+than)\s+0?\.05\s+(?:means|proves|shows)\s+(?:that\s+)?(?:there\s+is\s+)?no\s+(?:trend|change)"
    r"|\bsignificant\s+(?:means|proves)\s+(?:that\s+)?(?:it'?s\s+|it\s+is\s+)?(?:big|large|huge|dangerous|caused)"
    r"|\b(?:trend|tests?|stamp|p[- ]?value)\s+(?:proves?|shows?)\s+(?:the\s+|what\s+)?caus"
    r"|\bproves?\s+(?:that\s+)?(?:the\s+)?(?:trend|change)\s+is\s+real"
)
# Phrases that state a result for the case's data: blocked in a plain statement.
RESULT = re.compile(
    r"(?ix)"
    r"\b(it|this|that|they|these|those|the\s+\w+|your\s+\w+(?:\s+\w+)?)\s+(is|was|are|were|looks|seems|has\s+been|have\s+been)\s+"
    r"(really\s+|clearly\s+|definitely\s+|probably\s+|not\s+)?(rising|falling|increasing|decreasing|worsening|improving|flat|"
    r"getting\s+(worse|better|drier|wetter|hotter)|significant|real|random|just\s+noise|el\s+ni[nñ]o)\b"
    r"|\bnot\s+enough\s+evidence\b"
    r"|\b(statistically\s+)?(not\s+)?significant\b"
)
HYPOTHETICAL = re.compile(r"(?i)\b(if|whether|when|unless|suppose|imagine)\b")
METHOD_TALK = re.compile(r"(?i)\b(means?|called|call\s+it|tells?|checks?|asks?|tests?|bar)\b")
# Sentences about the 0.05 line itself ("a p-value above 0.05 does not prove ..."), not about a case result.
LINE_TALK = re.compile(r"(?i)\b(means?|meaning|proves?|line|bar|cut-?off|convention|rule|counts?\s+as|calls?|called)\b")


@dataclass
class Check:
    ok: bool
    reason: str = ""


def _norm(n: str) -> str:
    n = n.replace("−", "-").replace(",", ".").lstrip("+").rstrip("%")
    try:
        return f"{float(n):g}"
    except ValueError:
        return n


_ONES = {w: i for i, w in enumerate("zero one two three four five six seven eight nine".split())}
_TEENS = {w: i + 10 for i, w in enumerate("ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split())}
_TENS = {w: (i + 2) * 10 for i, w in enumerate("twenty thirty forty fifty sixty seventy eighty ninety".split())}
SPELLED = re.compile(
    rf"(?i)\b(?:(?P<h>{'|'.join(_ONES)})\s+hundred(?:\s+and)?\s*)?"
    rf"(?:(?P<t>{'|'.join(_TENS)})(?:[- ](?P<o>{'|'.join(_ONES)}))?|(?P<n>{'|'.join(_TEENS)}))\b"
    rf"|\b(?P<h2>{'|'.join(_ONES)})\s+hundred\b")
_DIGIT = r"(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)"
SPELLED_DECIMAL = re.compile(rf"(?i)\b{_DIGIT}\s+point\s+{_DIGIT}\b")


def numbers(text: str) -> set[str]:
    """Figures in text: digits, plus spelled-out numbers from 10 up ("forty-five" -> 45), so a
    model cannot slip a figure past the guard by writing it in words. "ten" alone is left out:
    it is everyday talk ("each ten years")."""
    found = {_norm(m) for m in NUM.findall(text)}
    for m in SPELLED.finditer(text):
        g = {k: (v.lower() if v else None) for k, v in m.groupdict().items()}
        if g["h2"]:
            found.add(str(_ONES[g["h2"]] * 100))
            continue
        n = (_ONES[g["h"]] * 100 if g["h"] else 0) + (_TENS[g["t"]] + (_ONES[g["o"]] if g["o"] else 0) if g["t"]
                                                       else _TEENS[g["n"]])
        if n != 10 or g["h"]:
            found.add(str(n))
    return found


def check_numbers(text: str, allowed_source: str) -> Check:
    m = SPELLED_DECIMAL.search(text)   # "zero point two" would slip past the digit check
    if m:
        return Check(False, f"spelled-out figure: {m.group(0)!r}")
    allowed = {_norm(m) for m in NUM.findall(allowed_source)} | {str(i) for i in range(6)}
    bad = sorted(n for n in numbers(text) if n not in allowed and n.lstrip("-") not in allowed)
    return Check(False, f"figure not produced by code: {', '.join(bad)}") if bad else Check(True)


SENT_END = re.compile(r"[!?\n]|\.(?!\d)")   # a decimal point (0.05) does not end a sentence


def _sentence(text: str, start: int, end: int) -> str:
    before = [m.end() for m in SENT_END.finditer(text, 0, start)]
    after = SENT_END.search(text, end)
    return text[(before[-1] if before else 0):(after.end() if after else len(text))]


def check_answer(text: str, approved: str = "") -> Check:
    """Block result statements unless the exact phrase comes from approved (human-written) text."""
    low = approved.lower()
    m = MISCONCEPTION.search(text)
    if m:
        return Check(False, f"teaches a misconception: {m.group(0)!r}")
    for m in P_VALUE.finditer(text):
        sent = _sentence(text, m.start(), m.end())
        if (_norm(m.group(1)) != "0.05" or not (HYPOTHETICAL.search(sent) or LINE_TALK.search(sent))) \
                and m.group(0).lower() not in low:
            return Check(False, f"states a p-value: {m.group(0)!r}")
    for m in STATEMENT.finditer(text):
        if m.group(0).lower() not in low:
            return Check(False, f"states a result: {m.group(0)!r}")
    for m in RESULT.finditer(text):
        phrase = m.group(0).lower()
        if phrase in low:
            continue
        sent = _sentence(text, m.start(), m.end())
        if sent.rstrip().endswith("?") or HYPOTHETICAL.search(sent):
            continue   # a question or an if-sentence: a hint, not a statement
        if re.sub(r"statistically|not", "", phrase).strip() == "significant" and METHOD_TALK.search(sent):
            continue   # explaining what the word means
        return Check(False, f"states a result: {m.group(0)!r}")
    return Check(True)
