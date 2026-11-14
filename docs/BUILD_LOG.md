# BUILD_LOG.md

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
