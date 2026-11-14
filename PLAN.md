# PLAN.md — Sarawak Earth Detectives build plan

> **Context:** NASA Space Apps 2026. Build 07:30 MYT Sat 14 Nov → submit by 21:00 MYT Sun 15 Nov (target **20:00**). Submission: project name, summary, ≤30 s demo video with English subtitles (or ≤7 slides), public prototype link (no login), NASA data list, AI disclosure. Idea and full spec: `MASTER_SHEET.md`.
> **Adaptation (2026-11-14):** the master sheet plans two tracks (A frontend, B backend). There is **one developer (Nathan)**, so the tracks run in sequence, backend data first. Malcolm and Zoe work the pitch, video and slides in parallel and need a working lite-mode build by Sun 13:00 to record.

## Decisions already made (don't re-litigate)
| Topic | Decision |
|---|---|
| Product | Detective cases, 7 beats, student writes the verdict; "not enough evidence" is a win (MASTER_SHEET §5) |
| Contracts | MASTER_SHEET §15, implemented in `backend/app/schemas.py`. Additions: `CasePack.main_cards`, stamp `record_too_short` |
| Statistics | MASTER_SHEET §16: deseasonalise, OLS + Hamed-Rao Mann-Kendall, both p < 0.05 → significant |
| Lite first | Lite mode (2D) is built and demoable before any 3D |
| Data | Cached to files by ingest scripts; never fetched at request time |
| Backend runtime | Python 3.12 via `uv` (system Python 3.14 lacks wheels for some science libs) |
| ADK | `google-adk==2.14.1`, source clone at `../adk-python` tag `v2.14.1` |
| Region | Cloud Run + Vertex AI in `asia-southeast1` (confirm model availability, EXP-6) |
| Name | Never use "Climate Detectives" (ESA's) |

## Phases (exit condition = gate)

### Phase 0 — Workspace and repo (Sat 10:30–11:30)
| Task | Exit condition |
|---|---|
| Workspace layout, ADK clones, docs, starter code, git repo, GitHub remote | ✅ `uv run pytest` and `npm run build` pass; first commit pushed |
| Credentials: GCP project, Firebase project, FIRMS map key, Earthdata login | Names in `docs/CREDENTIALS.md` all have a home; `.env` filled locally |

### Phase 1 — Data access (Sat 11:30–13:00) · MASTER_SHEET §22
| Task | Exit condition |
|---|---|
| EXP-1 NASA POWER daily point near Miri, 1981→now | ✅ 2026-11-14 (use inland land cells) |
| EXP-2 FIRMS archive request for Sarawak bbox 2001→now | Request submitted (email pending) — **Nathan** |
| EXP-3 NOAA ONI download | ✅ 2026-11-14 (RONI chosen) |
| EXP-4 One hand trend test on Miri | ✅ 2026-11-14 (BUILD_LOG) |
| EXP-11 IMERG cross-check of POWER rain | Before rain cards enter an answer key |
| **Gate 1** | NASA data for case 001 is on disk. If POWER fails, stop and fix data access |

### Phase 2 — Analysis + vault for case 001 (Sat 13:00–17:00)
| Task | Exit condition |
|---|---|
| `analysis/`: season filter, ruler, scales (OLS + MK Hamed-Rao + Sen), El Niño lamp, years-needed, twin | Known-answer tests pass: rising, falling, flat, noisy, El Niño-only, too-short |
| `vault/`: region averaging from POWER grid points; yearly values per card (§16 table) | Case 001 Series load from files < 1 s |
| Answer key for case 001; `cases/001.json` | **Gate 2:** a real stamp comes back from `POST /sessions/{id}/analyse` |
| **Sat 17:00 check** | Do answer keys give a mix of verdicts? If all "not enough evidence", swap a region/measurement |

### Phase 3 — Lite mode, seven beats (Sat 17:00–22:00)
| Task | Exit condition |
|---|---|
| Routes §9 (cases, sessions, scene, evidence, analyse, verdict) | OpenAPI matches `src/api/types.ts` |
| Lite UI: Call → Scene (2D map) → Locker → Board (ECharts) → Lab → Deduction → Closed | Case 001 solvable end to end at phone width |
| Grading (code) per §16 | Grade + badges returned |

### Phase 4 — Agents + first deploy (Sat 22:00–Sun 01:00)
| Task | Exit condition |
|---|---|
| Partner (ADK) with hint ladder; no answer-key access; number guard | Ten "give me the answer" attempts all refused (EXP-7) |
| Chief feedback (ADK, grade from code) | Feedback quotes the student's steps |
| Deploy backend to Cloud Run, frontend to Firebase Hosting | **Gate 3 (Tier 1 done):** public link solves case 001 in a private window |

### Sleep (Sun 01:00–08:00)

### Phase 5 — Tier 2 (Sun 08:00–13:00)
| Task | Exit condition |
|---|---|
| Cases 002 and 003 (vault + answer keys) | Both solvable |
| 3D office: stations, camera glide, map table with NASADEM terrain | All six stations reachable; lite fallback on weak devices |
| Case report (HTML → PDF) | Report downloads |
| **Gate 4** | Three cases + 3D map table; hand build to Zoe/Malcolm for recording |

### Phase 6 — Tier 3, only if Gate 4 passed (Sun 13:00–16:00)
Scout + Case Builder drafting case 004 with admin approval; polish (stamps, hornbill).

### Phase 7 — Freeze and submit (Sun 16:00–20:00)
16:00 feature freeze · redeploy · private-window link test · README AI disclosure · fill MASTER_SHEET §3/§4 links · 20:00 submit.

## Gates / holds
- No demo or deploy unless known-answer tests pass.
- No case `open` without the admin review route.
- Nathan runs every login, deploy and push.

## Cut order (cut from the top)
1. Sound and animation polish
2. Data-triggered cases (keep news-triggered only)
3. Reopened cases
4. Terrain data layers beyond fires and rain
5. Case 003
6. Full 3D office → lite mode plus one 3D map table

**Never cut:** seven beats for case 001, real statistics in code, student-written verdict, Partner "no answers" rule, lite mode.

## Open items (MASTER_SHEET §13)
1. Current SMAP L4 version link · 2. POWER variable names · 3. Open district + river-basin boundaries with licences · 4. Peat map · 5. Moved NOAA ONI link · 6. Confirm 21:00 deadline and whether a live pitch is needed · 7. Asset licences · 8. One teacher/student conversation · 9. Name free to use · 10. POWER reachability (EXP-1)

## Task allocation
| Owner | Responsibility |
|---|---|
| Nathan (+ Claude Code) | All code, data, agents, deploys |
| Malcolm | Pitch, submission text review, open items 6, 8, 9; technical support |
| Zoe | 30 s demo video (subtitles burned in, AI watermark), slides, visuals |
