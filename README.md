# Sarawak Earth Detectives

*Real events. Real NASA data. You're the detective.*

A detective agency for students. An AI "client" brings real cases about Sarawak's floods, haze, peat fires and dry spells; the student picks evidence from decades of NASA Earth data, removes the seasons, tests whether the change is real, and writes the verdict. "Not enough evidence" is a winning answer.

Built for the NASA Space Apps Challenge 2026, challenge "Be An Earth System Trend Detective!".

- **Prototype:** _link to be added_
- **Demo (30 s):** _link to be added_

## How it works
1. **The Call** — a case arrives. 2. **The Scene** — visit it on a map of Sarawak. 3. **The Evidence Locker** — choose measurements, reject red herrings. 4. **The Board** — see each as a time series. 5. **The Lab** — season filter, trend ruler, significance scales, El Niño lamp. 6. **The Deduction** — write the verdict. 7. **Case Closed** — feedback, badges and a case report.

Every number comes from statistics code (OLS trend + Mann-Kendall, both must agree), never from the AI.

## Data
NASA POWER (MERRA-2, GPM IMERG), FIRMS (MODIS/VIIRS), MERRA-2 aerosols, NASADEM, GIBS, plus NOAA's Oceanic Niño Index. Full list with links: `MASTER_SHEET.md` §6–7.

## Run locally
```bash
cd backend && uv sync && uv run uvicorn app.main:app --reload --port 8000
cd frontend && npm install && npm run dev
```

## Use of AI
- **In the product:** Gemini on Vertex AI through Google's Agent Development Kit, for the Client, Partner (hints only) and Chief (feedback wording). Statistics and grading are plain code.
- **In development:** Claude Code (Anthropic) helped with planning, scaffolding and code. AI-assisted source files carry a header note.
- AI-generated images or video carry a visible watermark. No NASA logos are used.

## Team
Nathan (CEO & CTO) · Malcolm (CMO & CTO) · Zoe (CMO & Media)
