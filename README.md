# Sarawak Earth Detectives

*Real events. Real NASA data. You're the detective.*

A detective agency for students. An AI "client" brings real cases about Sarawak's floods, haze, peat fires and dry spells; the student picks evidence from decades of NASA Earth data, removes the seasons, tests whether the change is real, and writes the verdict. "Not enough evidence" is a winning answer.

Built for the NASA Space Apps Challenge 2026, challenge "Be An Earth System Trend Detective!".

## Live links (no login needed)
- **Landing page:** https://ssc-workspace-2026.web.app/
- **Web app (the detective office):** https://ssc-workspace-2026.web.app/#/play
  - Opens the 3D office; small screens and devices without WebGL get the 2D lite mode, and a **2D** button switches any time.
- **Backend API (Cloud Run, for reference):** https://sed-api-f7fsjojvgq-as.a.run.app/health
- **Demo (30 s):** _link to be added_

## How it works
1. **The Call** — a case arrives. 2. **The Scene** — visit it on a map of Sarawak. 3. **The Evidence Locker** — choose measurements, reject red herrings. 4. **The Board** — see each as a time series. 5. **The Lab** — season filter, trend ruler, significance scales, El Niño lamp. 6. **The Deduction** — write the verdict. 7. **Case Closed** — the Chief's stamp, feedback and badges; solved cases are filed under Learnt cases in the inbox.

Every number comes from statistics code (OLS trend + Mann-Kendall, both must agree), never from the AI.

## Data
Used in the build: NASA POWER (MERRA-2: soil wetness, humidity, rain, wind), NASA GIBS (VIIRS fire detections, Blue Marble imagery), NOAA's Relative Oceanic Niño Index (RONI), and SRTM-derived terrain (AWS Terrain Tiles). Planned sources and full links: `MASTER_SHEET.md` §6–7.

## Run locally
```bash
cd backend && uv sync && uv run uvicorn app.main:app --reload --port 8000
cd frontend && npm install && npm run dev
```

## Use of AI
- **In the product:** Gemini on Vertex AI through Google's Agent Development Kit, for the Partner (hints only, guarded so it never gives the answer) and the Chief (wording the code's grade). Statistics and grading are plain code. Case 001 was written by the team from news sources; the AI Client that drafts cases is planned, not built.
- **In development:** Claude Code (Anthropic) helped with planning, scaffolding and code. AI-assisted source files carry a header note.
- AI-generated images or video carry a visible watermark. No NASA logos are used.

## Team
Nathan (CEO & CTO) · Malcolm (CMO & CTO) · Zoe (CMO & Media)
