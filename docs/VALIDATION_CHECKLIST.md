# VALIDATION_CHECKLIST.md

## Status board
| Item | Status | Evidence |
|---|---|---|
| Backend env (uv, Python 3.12.12, google-adk 2.14.1) | ✅ | `uv run pytest -q`: 2 passed, 2026-11-14 |
| Frontend builds (Vite 8, React 19, TypeScript 7) | ✅ | `npm run build`, 2026-11-14 |
| NASA POWER reachable (EXP-1) | ✅ | 5 points, 1981 → 2026-11-10, 2026-11-14 |
| NOAA RONI downloaded (EXP-3) | ✅ | DJF 1950 → ASO 2026 |
| Hand trend test sane (EXP-4) | ✅ | BUILD_LOG 2026-11-14 11:30 |
| POWER rain agrees with IMERG (EXP-11) | 🟠 untested | blocks rain cards in answer keys |
| FIRMS archive requested (EXP-2) | 🔴 not requested | |
| Known-answer tests (§21) | ✅ | 21 tests pass; 200-seed check, 2026-11-14 |
| Vault loads case 001 < 1 s (§21) | ✅ | 69 ms cold |
| Gate 2: real stamp from API | ✅ | `test_gate2_real_stamp` |
| AnswerKey never served | ✅ | `test_no_route_serves_answer_keys`, `test_cases_list_hides_answer_material` |
| Mix of verdicts (EXP-5) | ✅ | 001 not_enough_evidence; heat worsening |
| Partner refuses the answer ×10 | ⬜ | |
| Number guard blocks a wrong figure | ⬜ | |
| Lite mode at phone width | ✅ | 375 px, no sideways scroll on 6 views, 2026-11-14 |
| Case 001 solvable end to end (Gate 3 local) | ✅ | browser run 100/100, honest doubt |
| Scene imagery saved, not live (EXP-10) | ✅ | GIBS, 508 KB, one missing day noted |
| 3D stations reachable | ⬜ | |
| Public link, private window, no login | ⬜ | |

## Blocking items
- GCP and Firebase projects, Earthdata login, FIRMS key (Nathan).
- EXP-1: POWER access.

## Environment readiness
See the tool table in `../../WORKSPACE_SETUP.md`.

## Decisions still open
- Firebase / GCP project id.
- Gemini model name and region availability (EXP-6).
- Boundary datasets for districts and river basins.

## Log
- 2026-11-14: workspace and repo initialised.
- 2026-11-14 13:30: Phase 2 done, Gate 2 passed.
- 2026-11-14 15:00: Phase 3 done; case 001 solvable in lite mode.
