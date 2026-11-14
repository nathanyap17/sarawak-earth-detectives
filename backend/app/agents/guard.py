"""Output guard for agent text (rules 1 and 2). Plain code, no model.

- Number guard: every figure in agent text must already appear in text the code supplied
  (the case brief, card definitions, the approved hint ladder, the code-computed grade).
  Small counting numbers (0–5) are allowed. Numbers the student typed are NOT allowed, so the
  agent can't confirm a guess like "is it 0.13?".
- Answer guard (Partner only): blocks text that states a direction, rate, significance or
  verdict for the case.
AI-assisted: written with Claude Code."""
from __future__ import annotations

import re
from dataclasses import dataclass

NUM = re.compile(r"(?<![\w.])[-+−]?\d+(?:[.,]\d+)?%?")

# Phrases that state a result. Kept broad: a false block only costs a fallback hint.
ANSWER = re.compile(
    r"(?ix)"
    r"\b(the\s+)?(answer|verdict|solution|result)\s+(is|was|would\s+be|should\s+be)\b"
    r"|\b(it|this|that|the\s+(trend|record|data|soil|humidity|rain|fire|change))\s+(is|was|are|were|has\s+been)\s+"
    r"(really\s+|clearly\s+|definitely\s+|not\s+)?(rising|falling|increasing|decreasing|worsening|improving|flat|"
    r"getting\s+(worse|better|drier|wetter)|significant|real|random|just\s+noise|el\s+ni[nñ]o)\b"
    r"|\b(statistically\s+)?(not\s+)?significant\b"
    r"|\bnot\s+enough\s+evidence\b"
    r"|\b(choose|pick|select|write|tick|answer)\s+[\"'“]?(worsening|improving|no\s+change|yes|no|can'?t\s+tell)\b"
    r"|\bper\s+decade\b"
    r"|\bp\s*[<=>]"
)


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


def check_answer(text: str, approved: str = "") -> Check:
    """Block result statements unless the exact phrase comes from approved (human-written) text."""
    for m in ANSWER.finditer(text):
        if m.group(0).lower() not in approved.lower():
            return Check(False, f"states a result: {m.group(0)!r}")
    return Check(True)
