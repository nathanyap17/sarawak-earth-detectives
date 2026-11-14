# BUILD_LOG.md

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
