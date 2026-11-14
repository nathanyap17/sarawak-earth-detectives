---
name: sed-rules
description: Non-negotiable rules for Sarawak Earth Detectives. Use whenever writing code that touches agents (Partner, Chief, Scout, Case Builder), the answer key, statistics or numbers shown to students, case status/approval, student data, NASA data fetching, or the public link.
---

# Sarawak Earth Detectives rules

## 1 · The AI never does the maths
**Why:** Validity criterion; judges will ask "how do you stop the AI giving wrong numbers?" (MASTER_SHEET §11).
**Right:**
```python
result = analysis.scales(series)              # code computes
text = await partner.reply(ctx)               # agent words only
text = number_guard(text, allowed=session.numbers())   # blocks unknown figures
```
**Wrong:**
```python
prompt = f"Here is the data {series}. What is the trend per decade?"
```

## 2 · The Partner never sees the answer key
**Why:** It must not leak the verdict; it gives hints, never answers (§20).
**Right:** `PartnerContext(brief=..., cards=public_cards, actions=session.log)`
**Wrong:** `PartnerContext(..., answer_key=load_key(case_id))`

## 3 · The AnswerKey never leaves the backend
**Why:** Students could read it from the network tab.
**Right:** routes return `AnalysisResult` and `Grade`; `AnswerKey` has no route.
**Wrong:** `return {"case": pack, "key": key}`

## 4 · No case opens without human approval
**Why:** Cases are about disasters students lived through (§5.7, §12).
**Right:** `status` changes `draft → open` only in `POST /admin/cases/{id}/review`.
**Wrong:** Scout writes `status="open"`.

## 5 · Students stay anonymous
**Why:** Minors; Space Apps rules; no personal data needed.
**Right:** Firebase anonymous auth + nickname. **Wrong:** asking for email, school name or full name.

## 6 · Every number carries its mission and date
**Why:** Honesty (§21). **Right:** `{"v": 0.31, "mission": "MERRA-2", "data_as_of": "2026-11-10"}`. **Wrong:** a bare number in the UI.

## 7 · Never fetch NASA data at request time
**Why:** Cases must open instantly; the demo must not depend on NASA uptime.
**Right:** ingest scripts write `data/vault/`; routes read files. **Wrong:** `httpx.get(POWER_URL)` inside a route.

## 8 · Known-answer tests before any demo or deploy
**Why:** A wrong stamp destroys the Validity score. `uv run pytest -q` must pass.

## 9 · The public link needs no login
**Why:** Submission rule; a login wall disqualifies. Sign-in is silent and anonymous.

## 10 · No NASA logos; AI media watermarked
**Why:** Space Apps rules. Mission badges are plain text labels.
