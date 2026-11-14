# BUILD_LOG.md

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
