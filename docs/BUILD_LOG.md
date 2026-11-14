# BUILD_LOG.md

## [2026-11-14 ~23:30 MYT] Review fixes: verdict flow, Chief off the critical path, guide asks, built-vs-planned docs — read this first
### What changed
- **Contract** (`schemas.py`, `types.ts`): `POST /sessions/{id}/verdict` returns the code grade at once with `chief_note: null`. New `POST /sessions/{id}/chief` → `ChiefNote {attempt, chief_note}` writes the Chief's note once per attempt and keeps it (409 before any verdict). `PartnerReply` gains `fallback: "guarded" | "busy" | "off" | null`, saying why an approved hint replaced the AI reply.
- **Typewriter** (`DeductionBeat.tsx`): a real form (Enter submits); says what is missing, with a 15-character counter for "Why"; read-only once the case is filed, so no 409 resubmits.
- **Retry after "sent back"** (`state/session.ts` `frontier()`, `OfficeApp`, `Inbox`, `useGuideState`): the step to do now is the typewriter while a retry is left, so closing a window, the inbox ("Revise your verdict") and finishing an earlier step no longer jump to the case shelf.
- **Case Closed** (`ClosedBeat.tsx`): shows the grade at once and "The Chief is writing you a note…", then the note (one request per attempt, one quiet retry).
- **Kenyalang** (`Guide.tsx`, `beats/partnerNote.ts`): thinking state in the bubble; a note when the reply is the approved hint ("That one is yours to work out…", "I took too long…"); replies survive pins, cards and stamps changing (only moving to another object or step resets the bubble); "Earlier answers" list; a repeated reply types out again; set-state-in-effect warning gone. Lite Partner box gets the same note and a thinking line.
- **Timeouts**: browser calls abort after 15 s (25 s for the Partner and Chief) with a clear message; `MODEL_TIMEOUT_S` 8 → 12 s; Chief 15 s. Starting a case re-warms an agent idle for over 4 min (`runtime.keep_warm`).
- **Recovery** also replays clue pins.
- **Phone width** (≤640 px): the window is a bottom sheet and the guide sits above it; no camera side-shift.
- **Docs**: MASTER_SHEET §5.7 and §5.9 mark built vs planned (Scout, Case Builder, Reporter, embeddings, ML models, Firebase Auth, Cloud Storage vault and scheduled jobs are planned, not built). CLAUDE.md stack and the landing tech chips match the code (xarray → NumPy). DEPLOY.md no longer asks to enable Anonymous sign-in (the app has no Firebase Auth code).
### Verified
- Browser, real backend and model: empty submit lists what's missing; overconfident verdict graded in 0.11 s (was up to 10 s), "Revise my verdict" → Esc returns to the typewriter, the guide and inbox point to it, finishing the lab returns to it; second verdict "solved — not enough evidence", Chief's note arrives and congratulates; the typewriter is then read-only.
- Guide: "Thinking…" while waiting; the reply stays after the store changes; a second hint retypes; "Earlier answers (1)".
- 390×800: guide and bottom sheet don't overlap; no sideways scroll.
- Backend 50 tests pass (new: verdict without Chief, Chief route, fallback reason).
### Still broken / unverified
- Right after a local backend start the first model calls hung (warm-up timed out at 40 s, then two Chief timeouts); a minute later calls took 1–3 s. Cloud Run `--min-instances 1` plus the re-warm should hide this; check on the deployed service.
- `pyproject.toml` still declares unused scikit-learn, ruptures, xarray (and optional xgboost).

## [2026-11-14 ~21:30 MYT] Guided full-screen office, inbox, landing page, session recovery — read this first
### What changed
- **Session recovery** (`state/recover.ts`, `api/client.ts`): on `404 session not found` the client opens a new session for the same case, replays the chosen cards and the tools already run, then retries the call once. Cause of Nathan's report: sessions were in memory and the backend had been restarted under an open tab.
- **Office redesign** (Nathan's feedback: split screen felt dull): the 3D office fills the screen, seen through the missing fourth wall. Objects are clickable (`office/Spot.tsx`): hover shows a label, the next object has a pulsing label and a bouncing marker, and after 7 s idle every label appears. Clicking opens that object's window and glides the camera in; closing returns to the whole room. Finishing a step closes the window and lights the next object.
- **Kenyalang the guide** (`office/Guide.tsx`, `office/script.ts`): a hornbill bubble that types out what to do now (scripted per state), explains 18 vetted glossary words, and passes hints and questions to the backend Partner. Replaces the Partner box in the office (lite keeps it).
- **Inbox** (`office/Inbox.tsx`, `office/learnt.ts`, an inbox stand in the room): Happenings (open cases with the news source and the challenge's four verbs as a checklist) and Learnt cases (solved cases with variables, tools and verdict, kept in localStorage only).
- **Landing page** (`LANDING.md`, `landing/Landing.tsx`, `landing.css`, anime.js 4.5): opening film from space to Sarawak, then Problem / Opportunity / Solution, How it works, Tech stack, Impact, CTA, footer. `/` is the landing page; `/#/play` is the app. `public/landing/earth.jpg` is a saved GIBS Blue Marble image.
- Layout: shelf moved to the back wall, cabinet and lab bench moved back, so the overview shows everything.
### Decisions
- Progress (`reached`) is separate from what is being viewed, so revisiting an earlier object never moves the student back.
- Labels are plain DOM buttons projected each frame (drei `Html` dropped a label and threw unmount errors).
- "POS" on the landing page means Problem, Opportunity, Solution (confirmed by Nathan).
- Landing figures are only those the master sheet marks checked; honest limits and AI disclosure are on the page.
### Verified
- Browser, real backend: inbox → folder → sign → map (pin by clicking terrain) → cabinet → corkboard → lab (9 tool runs) → typewriter is the next target; labels and guide text correct at each step.
- Session recovery: with a fake session id in the store, a hint request recovered silently and answered.
- Landing: film plays to the final state; all sections render; 375 px has no sideways scroll; "Enter the office" opens `/#/play` (lite at phone width).
- `tsc` clean; build: landing 19 kB gzip, app 269 kB, office 256 kB; backend 47 tests pass.
### Still broken / unverified
- Verdict and Case Closed weren't re-run in the new office (their components are unchanged).
- At about 800 px wide the guide bubble covers part of the scene; it can be minimised.
- Not checked on a mid laptop or with reduced motion emulated.

## [2026-11-14 ~18:30 MYT] Phase 4: Partner, Chief, Firestore sessions, deploy files — read this first
### What changed
- `app/agents/`: `runtime.py` (one-shot ADK `LlmAgent` + `InMemoryRunner`, hard timeout, warm-up at startup), `guard.py` (number guard + answer guard), `partner.py` (hint ladder per stage, the student's steps without any result, last 3 exchanges), `chief.py` (2–3 sentences wording the code grade).
- Routes: `POST /sessions/{id}/partner` (30 turns per session, then 429). `/verdict` is async and adds `chief_note`. Every mutating route calls `sessions.save(s, fields…)`.
- `app/sessions.py`: `FirestoreStore` (collection `sessions`; reads per request; writes only the changed fields and appends the log with ArrayUnion so concurrent requests don't overwrite; clue pins stored as {lon, lat}). `SESSION_BACKEND=memory|firestore`.
- Frontend: `beats/Partner.tsx` in both modes (nudge → pointer → example buttons, a question box, AI tag), Chief's note on Case Closed, store gains `chat` and `hintRung`.
- Deploy: root `Dockerfile` (vault and cases baked in), `.gcloudignore`, `.dockerignore`, `infra/DEPLOY.md` with the exact commands. Removed `backend/Dockerfile`.
### Contract changes
`Grade.chief_note: str | None`; new `PartnerAsk {beat, rung 1–3, message ≤ 300}` and `PartnerReply {text, rung, source ai|ladder, turns_left}`. Mirrored in `types.ts`.
### Decisions
- The Partner never receives stamps, rates, p-values or the key; it only sees which tools were used on which cards.
- Number guard: every figure must appear in code-supplied text; numbers the student typed don't count, so a guess can't be confirmed. Answer guard: result phrasing is blocked unless it is copied from the approved ladder. On any failure the student gets the approved ladder hint.
- The Chief gets the code grade, not the answer key, because a sent-back student can retry.
- Backend is the only Firestore client (Admin credentials); the rules deny all browser access.
### Verified
- `uv run pytest -q`: **47 passed** (22 new: guard, prompt contains no results/key, leak → ladder, turn cap, Chief guard).
- EXP-7 live: 0/10 leaks. Firestore session round trip through `FirestoreStore` OK (0.65 s).
- Browser: Partner nudge and a "just tell me the answer" question answered in ~1.1 s, no leak. API run: sent back, then solved 100/100 with a Chief note quoting the student's verdict.
### Still broken / unverified
- **Not deployed**: Nathan runs `infra/DEPLOY.md`. The Docker image hasn't been built locally (Docker daemon off); Cloud Build will build it.
- Firebase Anonymous Auth still off; the frontend doesn't sign in yet (no backend check depends on it).
- Chief takes 3–6 s, so the verdict submit takes that long (10 s timeout, then the code feedback alone).

## [2026-11-14 ~17:00 MYT] Phase 3.5 first pass: case 001 solvable inside the 3D office — read this first
### What changed
- `frontend/src/office/`: `OfficeApp` (R3F canvas, camera rig, station buttons, beat panel), `Room` (office from primitives: desk, folder, phone, typewriter, lamp, cabinet, corkboard, lab bench with six tools, shelf, window to rainforest, Sarawak flag, rattan rug), `MapTable` (relief + GIBS drape, VIIRS embers, region box, clue pins by clicking the terrain), `Hornbill` (tilts head on a red herring), `stations.ts`, `paint.ts` (canvas textures, no downloads), `capability.ts` (fallback rules).
- `App.tsx` picks 3D or lite; the office is code-split (lite never loads three). 2D/3D switch both ways, remembered per browser. Store gains `reached`, `sceneDay`.
- `backend/app/vault/terrain.py` (build-time only): 256×256 heights from AWS Terrain Tiles (SRTM-derived, public, no login) and 2,976 fire points from the saved VIIRS frames (one per 0.03° blob). Pillow added to the dev group.
### Decisions
- Beat controls live on a paper panel to the right; the projection is shifted (`setViewOffset`) so each station's object sits in the free area. Camera steps back on narrow screens.
- Keys 1–7 jump to any beat already reached. Revisiting the Locker re-posts `/choose`, which the backend accepts.
- Terrain uses SRTM-derived tiles until NASADEM via Earthdata is available (needs Nathan's login). Labelled on the page.
- FPS probe offers 2D after 8 s under 20 fps, ignoring hidden/throttled tabs and the first 6 s.
### Verified
- Browser (in-app, real backend): sign → 3 pins on the 3D terrain → choose 3 incl. red herring → board notes appear on the corkboard → season/scales/lamp → verdict → "SOLVED — NOT ENOUGH EVIDENCE" 88.3/100, shelf shows the SOLVED stamp. Key "2" returns to the map table.
- 375 px: starts in lite with a note, no sideways scroll, OfficeApp chunk not loaded. 2D ↔ 3D switch works.
- ~139 fps in the dev pane. Build: lite 268 kB gzip + office 250 kB gzip; dist 2.4 MB total (< 5 MB).
### Still broken / unverified
- Hornbill only sits at the desk, so its head tilt isn't on screen during the Locker beat.
- Not yet checked on a mid laptop or with `prefers-reduced-motion` emulated.
- No ECharts-on-corkboard textures; charts stay in the panel.

## [2026-11-14 ~16:00 MYT] Cloud connections verified; 3D added to scope — read this first
### What changed
- `.firebaserc` → `ssc-workspace-2026`. `.env`/`.env.example`: `GOOGLE_CLOUD_LOCATION=global`, `MODEL_NAME=gemini-3.5-flash-lite`. `config.py` gains `model_timeout_s=8`.
- `frontend/.env.local` holds the Firebase web config (untracked, no measurementId: Analytics stays off).
- PLAN.md: new Phase 3.5, the 3D office in three.js (R3F + drei), with the lite mode as automatic fallback.
### Verified
- gcloud config `sed`: account, project, region asia-southeast1; ADC quota project set; billing on.
- 10 APIs enabled (aiplatform, run, cloudbuild, artifactregistry, storage, firestore, secretmanager, firebase, identitytoolkit, cloudscheduler).
- Firestore native DB in asia-southeast1; write/read/delete 0.54 s.
- Gemini via ADK 2.14.1 works; see EXP-6 for model access and latency. `gemini-2.5-flash` is not available to this project.
### Still broken / unverified
- **Firebase Authentication not initialised** (CONFIGURATION_NOT_FOUND). Nathan: console → Authentication → Get started → enable Anonymous.

## [2026-11-14 ~15:00 MYT] Phase 3 done: case 001 solvable end to end in lite mode — read this first
### What changed
- Backend: `app/grading.py` (rubric 25/25/30/20, endings, badges, deterministic feedback); routes `POST /sessions/{id}/choose`, `/log`, `/verdict` (one retry after "sent back", then 409). `app/vault/gibs.py` saves scene imagery.
- Frontend: seven beats in `src/beats/` (Call, Scene, Locker, Board, Lab, Deduction, Closed), `src/lite/LiteApp.tsx` with a progress rail, `src/beats/shared.tsx` (mission badge, stamp, ECharts host), Zustand store with the verdict draft, all API calls in `src/api/client.ts`.
- Scene imagery: `frontend/public/scenes/001/` = GIBS Blue Marble relief base + 88 daily VIIRS SNPP thermal-anomaly frames (Feb 1–Apr 30 2026), 508 KB. GIBS has no frame for 2026-04-29; the manifest records it and the page says so.
- `.claude/launch.json` in the repo (backend :8000, frontend :5173).
### Decisions
- **Grading rules** (code, §16): evidence = 0.4 main cards + 0.2 relevant + 0.4 no red herring. Method = 10 season-before-scales + 10 scales on every main card + 5 lamp on a main card. Verdict = 10 direction + 10 is-it-real + 10 how-much (a number inside a main card's range; or no number when the key is no_change / not_enough). Explanation = 12 hedged + 8 no overclaim (min 15 chars). For not_enough_evidence, any direction that matches the raw lean, or "no change", earns direction marks.
- The Partner's red-herring prompt is a canned line for now; the ADK Partner arrives in Phase 4.
- Dropped `echarts-for-react` (its CJS core entry breaks in Vite dev); replaced by a 15-line `EChart` host.
- The trend line on charts is drawn from the backend's rate through the means (OLS passes through the means), so no new number is invented.
### Verified
- `uv run pytest -q`: **25 passed** (grading: ideal honest-doubt run = 100 with 4+ badges; overclaim sent back then solved on retry, third submit 409; red herring costs evidence marks; grade carries no answer-key fields).
- Browser, end to end (in-app preview, real backend): sign → pin → choose 3 → flip 3 charts → season/scales/lamp on main cards → wrong verdict "SENT BACK" 60/100 → draft kept → honest doubt "SOLVED — NOT ENOUGH EVIDENCE" **100/100**, badges Clean Signal, Red Herring, Honest Doubt, Second Opinion, El Niño Eye. About 14 s scripted.
- All six tools render a stamped result with "MERRA-2 via NASA POWER · data to 2026-11-10".
- **Phone width 375 px: no sideways scroll** on Call, Scene, Locker, Board, Lab, Lab twin.
- Frontend build 843 kB JS / 277 kB gzip.
### Still broken / unverified
- Bug fixed during the run: a retry wiped the verdict form; the draft now lives in the store.
- Deduction and Closed weren't checked at 375 px by script (forms are single-column; low risk).
- No hint ladder in the UI yet (Phase 4 Partner). No case report PDF (Phase 5).
- Sessions are in memory; a backend restart mid-case loses the session.

## [2026-11-14 ~13:30 MYT] Phase 2 done: Gate 2 passed — read this first
### What changed
- `app/analysis/trend.py`: season filter, ruler (OLS + HAC, 2 lags), scales (OLS t-test + Hamed-Rao MK + Sen; both p < 0.05 and same sign → significant), El Niño lamp (RONI, time never an input), years-needed (SE ∝ n^-1.5, capped 51), twin, card outcome, overall verdict.
- `app/vault/`: regions on MERRA-2 cell centres, POWER ingest with land-cell filter, RONI, card catalogue (9 cards), file store, build script. `app/casework.py`: public views, desk tools, answer-key builder. `app/sessions.py`: in-memory sessions with an action log. `app/api/routes.py`: §9 student routes plus `/cases/{id}/series/{card}` and `/vault/health`.
- `cases/001.json` "The Burning Ground": main cards soil_dry3 and humidity_feb_apr, red herring wind, twin region south-west.
### Decisions
- **Contract changes** (schemas.py and types.ts): `EvidenceCard` drops `relevant` and gains `yearly_label` and `provisional`; new `CasePublic`, `SessionCreate`, `SessionOut`; `AnalysisResult` gains `region_id`, `mission`, `data_as_of` (rule 6), `n_years`, `elnino_r`, `opposite_trends`, `twin`, `monthly_out`; `CasePack.twin_region`; `CardKey.direction` is nullable.
- Vault series are stored as JSON in the Series contract (69 ms cold for 5 cards), not parquet. Region daily is parquet.
- Card metadata `worse_when` and `band` ("too small to matter" per decade) live server-side in `vault/cards.py`.
- **Provisional cards** (all rain-derived, until EXP-11) may be shown and tested but **can't be main cards**; the answer-key builder refuses.
- The twin region is fixed by the case pack, never chosen by the client.
- Session ids are uuid4 hex for now (DATA_MODEL said ULID).
### Verified
- `uv run pytest -q`: **21 passed** (known-answer tests, routes, leak guard: no answer material in `/cases`, no answer-key route).
- 200-seed robustness: false-alarm rate on white noise 5.5% (≈ α); rising detected 199/200; El Niño-only trends removed 200/200.
- Vault: north-peat 11 land / 4 sea cells, south-west 6 land; data to 2026-11-10; build 57 s.
- **Case 001 answer key: `not_enough_evidence`.** soil_dry3 significant rising (+0.013 per decade, wetter) but the lamp → needs_more_years (r = −0.66 with RONI); humidity significant rising, lamp → not_significant. A real "Honest Doubt" case.
- Mix of verdicts (EXP-5, 17:00 check): heat cards (temp_mean +0.18 °C/decade, hot days +12.5, hot nights +23 per decade) are **worsening** in both regions and survive the lamp. South-west Feb–Apr rain and soil are **improving**. So a heat case would give "worsening".
### Still broken / unverified
- FIRMS fire detections still missing (EXP-2, Nathan). When they arrive, `fires_year` becomes case 001's main card and the key is rebuilt.
- 2026 is absent from full-year cards until the year is complete; it shows in monthly views and in Feb–Apr cards.
- Multiple-testing control (§5.9) is not implemented; each card is stamped alone.
- Sessions are in memory (lost on restart). Firestore in Phase 4.
### Lesson
Fire-weather records in Sarawak are dominated by El Niño. The lamp is what turns "it's getting worse" into an honest answer.

## [2026-11-14 ~11:30 MYT] Phase 1 data checks — read this first
### What changed
- Downloaded (gitignored, `data/raw/`): POWER daily for 5 points (Miri coast, Miri inland, Tatau, Sibu, Kuching), 1981-01-01 → 2026-11-10; NOAA `RONI.ascii.txt` and `oni.ascii.txt` (DJF 1950 → ASO 2026).
- `../sandbox/exp4_trend_by_hand.py`: first hand trend test per §16.
- MASTER_SHEET v1.2 corrections (§5.6 rain row and El Niño row, §6 IMERG row, §7 NOAA row, change log).
### Decisions
- **El Niño lamp uses RONI**, not ONI: it's NOAA's official index now, and it doesn't carry the warming trend that the lamp would otherwise remove.
- **Region averages use land cells only** (Tmax−Tmin > 3 °C). The coastal Miri cell behaves like the sea.
- Rain cards stay on POWER for now but are **blocked from the answer key until EXP-11** (IMERG cross-check). A post-2001 step of +8–15% in Jun–Sep rain may be a product change.
- Case 002 must use the reported region and season (Jan–Aug 2026, southern Sarawak). Jun–Sep 2026 was ordinary at the test points.
### Verified
- POWER: HTTP 200, ~3 s/point, 8 parameters per call, no login. Names/units in EXPERIMENTS EXP-1.
- Hand test: mean temperature +0.18 °C/decade and hot days +12–14/decade, significant everywhere, robust to the lamp. Dry spells are shortening but not significant after the lamp. A mix of verdicts is likely (EXP-5).
### Still broken / unverified
- FIRMS archive not requested (needs Nathan's Earthdata login): **case 001's main evidence is still missing**.
- EXP-11 not run.
### Lesson
Check each product's real source and grid cell before trusting a trend: both "IMERG via POWER" and "Miri point" were wrong on first contact.

## [2026-11-14 ~11:00 MYT] Project initialised — read this first
### What changed
- Workspace `ssc-workspace-26/` laid out: repo, `adk-docs`, `adk-python`, `sandbox`, `pitch-and-design`, `archive`.
- Repo `sarawak-earth-detectives/` created on `main`: CLAUDE.md, PLAN.md, MASTER_SHEET.md (copy of the workspace MASTERSHEET.md v1.1, now the living version), docs/, project skills, backend (FastAPI skeleton and contracts), frontend (Vite React TS with three / R3F / drei / ECharts / Zustand / Firebase), Firebase and Docker config.
### Why
MASTER_SHEET §22 step 5 (repository) and §15 (contracts) come before any data work.
### Decisions
- One developer, so tracks A and B run in sequence, backend data first (PLAN.md).
- Backend runs on Python 3.12 via uv; the system Python 3.14 stays out of it.
- Pinned `google-adk==2.14.1` (latest release, tagged 2026-11-12) rather than the globally installed 2.6.1. `../adk-python` is checked out at `v2.14.1`; `../adk-docs` is at main `9c7037a5` (2026-11-13).
- Contract additions: `CasePack.main_cards`, stamp `record_too_short`.
### Verified
- `uv run pytest -q`: 2 passed. `npm run build`: ok (220 kB JS).
### Still broken / unverified
- No credentials yet, no NASA data downloaded, nothing deployed.
