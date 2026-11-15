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
    r"|\bper\s+decade\b"
    r"|\bp\s*[<=>]"
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
ENDS = ".!?\n"


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


def numbers(text: str) -> set[str]:
    return {_norm(m) for m in NUM.findall(text)}


def check_numbers(text: str, allowed_source: str) -> Check:
    allowed = numbers(allowed_source) | {str(i) for i in range(6)}
    bad = sorted(n for n in numbers(text) if n not in allowed and n.lstrip("-") not in allowed)
    return Check(False, f"figure not produced by code: {', '.join(bad)}") if bad else Check(True)


def _sentence(text: str, start: int, end: int) -> str:
    lo = max(text.rfind(c, 0, start) for c in ENDS) + 1
    his = [i for i in (text.find(c, end) for c in ENDS) if i != -1]
    return text[lo:(min(his) + 1 if his else len(text))]


def check_answer(text: str, approved: str = "") -> Check:
    """Block result statements unless the exact phrase comes from approved (human-written) text."""
    low = approved.lower()
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
