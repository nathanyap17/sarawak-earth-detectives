# LANDING.md: the front page

The first thing a judge, teacher or student sees at the public link. It must explain the project in under a minute and lead straight into the office with one button. Facts and wording come from `MASTER_SHEET.md`; if the two disagree, the master sheet wins.

**Where:** `/` shows the landing page; `/#/play` opens the office (no login). The office's title links back.
**Code:** `frontend/src/landing/Landing.tsx`, `landing.css`. Animation: anime.js v4 (`animate`, `createTimeline`, `stagger`).
**Images:** `frontend/public/landing/earth.jpg` (NASA GIBS Blue Marble, saved at build time) and the case 001 scene files. Nothing is fetched from NASA when the page loads.

## Rules for this page
- No NASA logos or insignia. Credit the data in words.
- Every number is one the master sheet marks as checked ✅, with its source named in the footer.
- State the honest limits (not yet tested with students).
- AI use is disclosed on the page.
- `prefers-reduced-motion`: no intro film; the page shows its final state at once. A "Skip intro" button is always there.
- Works at 375 px with no sideways scrolling. All text has contrast of at least 4.5:1.

## 1. Opening film (about 7 seconds, plays once)
| Time | What the viewer sees | Text on screen |
|---|---|---|
| 0.0–1.5 s | Black space, stars drift, a satellite crosses | "Every day, satellites watch the Earth." |
| 1.5–3.5 s | Earth rises and turns until Borneo faces us | "For forty-five years they have kept the record." |
| 3.5–5.5 s | The camera dives through the globe to Sarawak; the real satellite image fills the screen, fire detections pulse over the north | "Sarawak, Borneo · 2.5° N, 113° E" |
| 5.5–7.0 s | Title and buttons settle in | **Sarawak Earth Detectives** · "Real events. Real NASA data. You're the detective." |

Buttons: **Enter the office** (primary, goes to `/#/play`) and **How it works** (scrolls down).

## 2. POS: Problem, Opportunity, Solution
Three cards that slide in one after another.
- **Problem.** Students in Sarawak live through floods, haze and peat fires, yet mostly learn about them from social media. In 2026, haze closed 710 Sarawak schools with 238,303 students. Asking a chatbot gives an answer, not understanding.
- **Opportunity.** NASA keeps decades of free Earth data, and the challenge asks for a tool where a user selects variables, sees change over time, and decides what is changing, where, how much, and whether it is significant. Students are the audience the challenge names.
- **Solution.** A detective agency. Each real event becomes a case with one question: *is this getting worse, or was it one bad year?* The student does the science; the AI only gives hints; code does every number; "not enough evidence" can be the winning verdict.

## 3. How it works
A row of seven steps that light up in order, grouped under the four things the challenge asks:
| The challenge asks | In the office |
|---|---|
| Select variables | **The Call** (case folder) → **The Scene** (3D map of Sarawak) → **Evidence Locker** (choose records, reject the red herring) |
| See change over time | **The Board** (each record as a time series) |
| What, where, how much | **The Lab** (season filter, ruler, twin region) |
| Is it significant? | **The Lab** (two tests on the scales, El Niño lamp) → **The Deduction** (write the verdict) → **Case Closed** (the Chief's stamp and report) |

Beside it: Kenyalang the hornbill, with the line "I give hints. I never give the answer."

## 4. Tech stack
Four groups of chips that pop in with a stagger.
- **Earth data:** NASA POWER (MERRA-2), NASA GIBS (VIIRS fire detections, Blue Marble), NOAA RONI (El Niño index), SRTM-derived terrain.
- **Statistics in code:** Python, statsmodels (trend test), pymannkendall (Mann-Kendall), pandas, NumPy.
- **AI with guard rails:** Gemini on Vertex AI through Google ADK; a number guard and an answer guard in plain code.
- **App:** React, TypeScript, three.js (React Three Fiber), Apache ECharts, anime.js, FastAPI on Cloud Run, Firebase Hosting, Cloud Firestore.

## 5. Impact
- Four "before → after" rows: students, teachers, schools and clubs, the public (master sheet §5.8).
- Three figures that count up: 710 schools closed by haze; 238,303 students affected; 83.2% of young Malaysians surveyed had lived through a climate-related disaster in the past year.
- SDG tags: 4.7, 13.3, 11.5, 16.10.
- **Honest limits**, in plain view: no teacher or student has tested this yet.

## 6. Call to action
Full-width band over the Sarawak image: "A case is waiting on your desk." → **Enter the office**. Second link: the source code on GitHub (added when the repository is public).

## 7. Footer
Data credits in words; the sources for each figure; "Built for NASA Space Apps 2026. Not endorsed by NASA."; AI disclosure: "Built with AI assistance (Claude Code). In the app, Gemini writes hints and feedback; every number comes from statistics code."

## Done when
- The film plays once, can be skipped, and is absent under reduced motion.
- All six sections render at 375 px and 1280 px without sideways scrolling.
- "Enter the office" opens the office with no login.


## Added 2026-11-15
- **Under the hood** (between How it works and Tech stack): three animated SVG diagrams. System architecture; the two AI agents with the number guard, the answer guard and the locked answer key; the statistics engine (season filter, regression line and range, t-test plus Mann-Kendall, El Nino lamp, stamp). Only what is built is drawn.
- **The detective path**: the seven steps on one drawn path, plus four hands-on cards (pin the map, lay your own line, shuffle the years, write the verdict).
- **Type**: Fraunces (headings), Atkinson Hyperlegible (reading text), Special Elite (typewriter accents), self-hosted with @fontsource.
- We say regression and rank tests, not machine learning: no ML model is built.

## Added 2026-11-15 (afternoon)
- The agent diagram has a third row, the case desk: news and NASA data, checklist (code), Scout and Case Builder (Gemini), both guards, answer key (code), human editor. Heading is now "Four AI agents on a short leash".
- A link to the wire desk: `/#/play?at=agency` opens the office at the agents' activity log.
- Solution card and stack chips mention the Scout, the Case Builder and human approval.
