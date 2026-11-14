# PROJECT_SPEC.md — Sarawak Earth Detectives

> System design. To keep two copies from drifting apart, behaviour is specified in `../MASTER_SHEET.md`. This file indexes it and adds only engineering detail and dated corrections.

## 1 · Identity
Sarawak Earth Detectives — MASTER_SHEET §1–2.

## 2 · Problem (with sources)
MASTER_SHEET §5.8 and "Sources for facts".

## 3 · Components
| Component | Spec | Code |
|---|---|---|
| Seven beats, desk tools, endings, grading | §5.2 | `frontend/src/beats`, `backend/app/api` |
| Case playbooks per type | §5.5 | `backend/app/agents/playbooks.py` (planned) |
| Data Vault | §5.6, §17 (hackathon path) | `backend/app/vault` |
| Statistics | §5.9 "statistics in plain terms", §16 | `backend/app/analysis` (pure functions, no I/O) |
| 3D office | §5.4, §19 | `frontend/src/office` |
| Lite mode | §5.4, §19 | `frontend/src/lite` |

## 4 · Flows
- Student session: §5.2 beats 1–7.
- Case creation (Client loop): §5.7 SCOUT → QUALIFY → BUILD → REVIEW → OPEN → FOLLOW UP.

## 5 · Agent topology (ADK 2.14.1)
§5.9 "Agents in ADK" and §20 rules. Engineering notes:
- **Partner:** `LlmAgent` with session state. Tools: glossary search, session-log lookup, hint ladder. Its instruction gets the case brief, the cards and the student's actions, **never** the AnswerKey.
- **Chief:** the grade is computed in code first; the agent only writes 2–3 sentences of feedback from (grade, rubric, session log).
- **Number guard:** an `after_model_callback` extracts numbers from agent text and blocks any that are not in the session's AnalysisResults or the case's public data.
- Every model call is wrapped in a timeout with deterministic fallback text. `MOCK_AGENTS=1` returns canned replies for offline development.

## 6 · Non-negotiables
`../CLAUDE.md` and `../.claude/skills/sed-rules/SKILL.md`.

## 7 · Deployment
Frontend on Firebase Hosting, backend on Cloud Run `asia-southeast1`, data in Cloud Storage, cases and sessions in Firestore. Steps: `../../WORKSPACE_SETUP.md`.

## 8 · UI screens
One per beat (§5.2). Fill in a data dictionary as each beat is built.

## 9 · API contract
Routes: MASTER_SHEET §9. Models: `backend/app/schemas.py` (source of truth), mirrored in `frontend/src/api/types.ts`.

## Corrections
- 2026-11-14: added `CasePack.main_cards` (§16 derives the overall verdict from "the case's main evidence card", so the card has to be named). Added stamp `record_too_short` (§16 minimum-record rule).
