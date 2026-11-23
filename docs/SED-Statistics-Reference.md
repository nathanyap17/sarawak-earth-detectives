# How the Lab Weighs a Trend

**Sarawak Earth Detectives: statistics reference**  
Team SMILING FACE WITH SUNGLASSES · NASA Space Apps 2026, Sarawak Space Challenge · 23 Nov 2026  
Source of truth: `backend/app/analysis/trend.py`, `casework.py`, `grading.py` (repo at commit 9486c28). No AI does any of these sums; every number below is computed by this code.

---

## The running example

Every method below is shown on one real result from the Lab: **wet-season rain (Nov to Feb), 45 seasons**, NASA POWER (MERRA-2).

| What the Scales reported | Value |
|---|---|
| Rate (Ruler, OLS) | **93.5 mm per decade** (about 9.35 mm more each year) |
| 95% range of the rate | **32.4 to 154.6** mm per decade |
| t-test p | **0.003** |
| Mann-Kendall p | **0.002** |
| Sen's slope | **91.3** mm per decade |
| Card's "too small to matter" band | **±10** mm per decade |
| Stamp | **Significant** (big enough to matter) |

Figures marked *(back-calculated)* below are worked backwards from these printed numbers to show the logic; the app does not print them.

---

## Part 1. The methods

Each method is given four ways: the formal definition, the formula, the plain-words version, and why the Lab uses it.

### 1.1 Season filter (monthly anomaly)

**Formal.** The anomaly of a monthly value is that value minus the long-term mean for the same calendar month, over the 1991–2020 baseline (all years if the baseline is missing).

**Formula.**

```
anomaly(year, month) = value(year, month) − mean of value(1991..2020, same month)
```

**Plain words.** Every year has a wet season and a dry season. That yearly wave is so big it hides any slow drift. Subtract "what this month is normally like", and what is left is how unusual each month was.

**Why.** Students must remove the seasons before judging a trend, or they will see the wave, not the drift.

**Note for Q&A.** The Scales do not test the monthly anomalies. They test one value per year, taken from the same months every year (for this card, the Nov–Feb total). Because each yearly value already compares like with like, the season is removed by design. The filter is the step that shows students why; the grade rewards using it before the Scales.

### 1.2 The Ruler: ordinary least squares (OLS) trend

**Formal.** Fit the straight line `yₜ = a + b·t + eₜ` (t = year) that minimises the sum of squared vertical distances from the dots. The slope b is the trend.

**Formula.**

```
b̂ = Σ (t − t̄)(y − ȳ) / Σ (t − t̄)²          per year
rate shown = 10 · b̂                         per decade
```

**Plain words.** Lay the one straight line that sits closest to all the dots. How steeply it tilts is the rate of change.

**Why.** It answers the challenge's "how much": a rate with units that anyone can read.

**Example.** b̂ = 9.35 mm per year, shown as 93.5 mm per decade. Over 45 years that is roughly 420 mm.

### 1.3 The 95% range of the rate (HAC confidence interval)

**Formal.** A 95% confidence interval for b: the values of the true slope that the data cannot rule out at the 5% level. The Lab uses a heteroskedasticity- and autocorrelation-consistent (HAC, Newey-West) standard error with 2 lags.

**Formula.**

```
SE(b̂)  textbook:  √[ σ̂² / Σ (t − t̄)² ]
        Lab:       Newey-West HAC, maxlags = 2   (wider when years resemble the last)
95% range = b̂ ± 1.96 · SE(b̂)
```

**Plain words.** The data wobbles, so the tilt is not known exactly. The range is every tilt that still fits the data reasonably. The rate always sits exactly in the middle. The key check is whether **0 (a flat line)** is inside the range.

**Why HAC.** A wet year is often followed by another wet year. Ordinary formulas treat years as independent and so are over-confident. HAC makes the range honestly wider.

**Example.** Half-width = (154.6 − 32.4) ÷ 2 ≈ 61, so SE ≈ 61 ÷ 1.96 ≈ **31** *(back-calculated)*. The range 32.4 to 154.6 does not include 0.

### 1.4 The t-test p-value (on the Ruler's slope)

**Formal.** Test of H₀: b = 0 (no linear trend) against H₁: b ≠ 0. The test statistic is the slope divided by its standard error. The p-value is the probability, if H₀ were true, of a statistic at least as far from 0 as the one observed.

**Formula.**

```
t = b̂ / SE(b̂)
p = 2 · [1 − Φ(|t|)]          Φ = standard normal curve (statsmodels' default with HAC)
                               textbook version: Student's t curve, n − 2 degrees of freedom
```

**Plain words.** How many "wobbles" tall is the tilt? Then read off the bell curve how rarely pure luck would give a tilt that tall. Both tails count, because a steep fall would be just as surprising as a steep rise.

**Link to the range.** Same calculation, two views: p < 0.05 exactly when the 95% range excludes 0 (because |t| > 1.96).

**Example.** t ≈ 93.5 ÷ 31 ≈ **3.0** *(back-calculated)*. The area beyond ±3.0 on the bell curve is about 0.003 → **p = 0.003**.

### 1.5 Mann-Kendall test (Hamed-Rao modified)

**Formal.** A non-parametric test of H₀: the values are in random order (no monotonic trend) against H₁: a monotonic upward or downward trend. It uses only the signs of differences between all pairs of years. The Hamed-Rao modification corrects the variance of S for autocorrelation.

**Formula.**

```
S       = Σ over all pairs i < j of sgn(xⱼ − xᵢ)          sgn = +1, 0 (tie), −1
Var(S)  = [ n(n−1)(2n+5) − Σ tₖ(tₖ−1)(2tₖ+5) ] / 18        tₖ = size of each group of tied values
Var*(S) = Var(S) · (n / n*)                                Hamed-Rao correction
   n / n* = 1 + 2 / [n(n−1)(n−2)] · Σₖ (n−k)(n−k−1)(n−k−2) · ρₖ
   ρₖ = significant lag-k autocorrelations of the ranks, after removing the trend
Z = (S − 1)/√Var*  if S > 0;   0 if S = 0;   (S + 1)/√Var*  if S < 0
p = 2 · [1 − Φ(|Z|)]
```

**Plain words.** Compare every pair of years. Later year higher: +1. Lower: −1. Add them up. With no trend, ups and downs cancel and S stays near 0. Measure how far S is from 0 in "wobbles", then read p off the bell curve, as for the t-test.

**Why a second test.** It ignores **how big** each difference is, only its direction. So one freak year cannot drag it, it does not need bell-shaped noise, and it does not need the trend to be a straight line. It is the robust check on the Ruler.

**Example.** 45 years → 45 × 44 ÷ 2 = **990 pairs**. With no trend, S wobbles by about ±102. p = 0.002 means S sits about 3.1 wobbles from 0: roughly S ≈ +310, or about 650 pairs up versus 340 down *(back-calculated; the real S depends on ties and the memory correction)*.

### 1.6 Sen's slope (Theil-Sen estimator)

**Formal.** The median of the slopes between all pairs of observations. A robust estimator of the trend's size, the natural partner of Mann-Kendall.

**Formula.**

```
Q = median { (xⱼ − xᵢ) / (j − i)  for all i < j }        shown as 10 · Q per decade
```

**Plain words.** Draw a little line between every pair of years, read each tilt, and take the middle one. Up to about 29% of the values can be wild before it moves.

**Why.** Mann-Kendall says "is there a consistent direction?" but gives no size. Sen gives the size the robust way. The Lab uses it as a **direction check**: its sign must match the Ruler's. If the straight line says rising but the typical pair says falling, a few extreme years are doing the work.

**What it does not do.** Sen's slope does not set the 95% range, the "too small to matter" check or the years estimate. Those use the Ruler.

**Example.** Sen = 91.3 versus Ruler 93.5: same sign, nearly the same size. The rate does not hinge on a few years.

### 1.7 What p and 0.05 mean (and do not mean)

| Statement | Right? |
|---|---|
| p is the chance of a tilt at least this steep **if there were no trend**. | ✓ |
| p is the chance that the trend is due to luck. | ✗ (common trap; p assumes "no trend" and asks how surprising the data is) |
| p < 0.05 ⇔ the 95% range excludes 0. | ✓ (for the t-test) |
| 0.05 is a law of nature. | ✗ (an agreed convention: 1 in 20) |
| p > 0.05 means there is no trend. | ✗ It means luck **cannot be ruled out**. The Lab says "Not clear yet". |
| Significant means we know the cause. | ✗ A trend is not a cause. That is the El Niño lamp's and the student's job. |

### 1.8 "Too small to matter" band and the years estimate

**Formal.** Each evidence card has a band ±B (per decade) below which a change is too small to matter for that record (for wet-season rain, B = 10 mm per decade). This is an equivalence margin. For an unclear result, the Lab estimates how many more years of data would shrink the uncertainty enough to clear about two standard errors.

**Formula.**

```
inside band:  −B ≤ range_low  and  range_high ≤ B
SE ≈ (range_high − range_low) / (2 · 1.96)
N  = n · (2 · SE / |rate|)^(2/3)          (SE of a trend shrinks roughly as n^−1.5)
more years = ceil(N − n), at least 1, capped at "more than 50"
shown only when the stamp is "Not clear yet" and |rate| ≥ B
```

**Plain words.** "Significant" only says the trend is not luck. The band asks whether it is big enough to care about. And when the answer is unclear, the estimate says roughly how long we would have to keep watching.

**Example.** The whole range (32.4 to 154.6) lies above +10, so it is not inside the band: a real trend that is big enough to matter. The estimate is not needed (already significant).

### 1.9 El Niño lamp (regression on the El Niño index)

**Formal.** Regress the yearly values on the NOAA Relative Oceanic Niño Index (RONI) averaged over the card's months, then remove the fitted El Niño part, keeping the mean. Time is never an input, so a genuine time trend is not removed by construction. The Scales are then re-run on the adjusted record. A Pearson correlation r is also reported.

**Formula.**

```
fit:      yₜ = c + β · eₜ + uₜ                (OLS, eₜ = El Niño index for that year)
adjusted: yₜ' = yₜ − β̂ · (eₜ − ē)
then:     Scales(y')                           full stamp again
r = corr(y, e)
```

**Plain words.** Strong El Niño years can fake a trend, for example if several happen to fall late in the record. Switch off the part of each year that El Niño explains, and weigh the trend again. If it survives, El Niño did not make it.

**Why.** It is the Lab's built-in test of an alternative explanation, and it decides the case: a trend that disappears under the lamp gives "not enough evidence".

### 1.10 Twin map

**Formal.** Run the full Scales on the same card for a second region. The flag "opposite trends" is true only when both regions are significant and their directions differ.

**Plain words.** Is this a Sarawak-wide pattern or a local one? Compare a twin place with the same test.

### 1.11 Workbench (learning tools, not used for the verdict)

**My line.**
```
student line = level + (rate / 10) · (year − middle year)
best line    = plain OLS (no HAC)
gap          = average |student line − best line|
score        = max(0, 100 · (1 − gap / (0.5 · standard deviation of the dots)))
```
Plain words: draw your own line by eye. The closer it is to the best line, measured against how much the dots wobble, the higher the score.

**Shuffle test (a permutation test).**
```
repeat 1,000 times: shuffle the years, fit the OLS tilt
as_steep = how many shuffled tilts have |tilt| ≥ |real tilt|
as_steep / 1,000 ≈ a p-value, with no bell curve
```
Plain words: if year order did not matter, a shuffled record would tilt as much as the real one quite often. If almost none do, order matters: there is a trend. This is the most direct picture of what a p-value means. It ignores year-to-year memory, so the Scales stay the official judge.

---

## Part 2. How the verdict is decided

Four steps, each a matrix. In every table, rows are checked **top to bottom and the first match wins**.

### Step A. The stamp for one record (`scales()`)

| Years ≥ 20 | t-test p < 0.05 | MK p < 0.05 | Sen sign = Ruler sign | 95% range inside ±band | Stamp | Shown to the student |
|---|---|---|---|---|---|---|
| ✗ | – | – | – | – | `record_too_short` | Record too short |
| ✓ *(no variation at all)* | – | – | – | – | `not_significant` | Not significant (flat) |
| ✓ | ✓ | ✓ | ✓ | ✗ | `significant` | **Significant** |
| ✓ | ✓ | ✓ | ✓ | ✓ | `significant` + `small` | Significant · but too small to matter |
| ✓ | at least one ✗ | | | ✓ | `not_significant` | Not significant (confidently near flat) |
| ✓ | at least one ✗ | | | ✗ | `needs_more_years` | **Not clear yet** · about N more years (N only if \|rate\| ≥ band) |

"Not significant" here is stricter than p > 0.05: it needs the whole range inside the band, so even the extreme plausible tilts are negligible. p > 0.05 alone gives "Not clear yet".

### Step B. The card's outcome, with the El Niño lamp (`card_outcome()`)

Only the case's **main cards** count. Red herrings are skipped, and a card whose data is provisional for that region cannot be a main card.

| Stamp on raw record | Stamp after the El Niño lamp | Direction vs the card's "worse when" | Card outcome |
|---|---|---|---|
| significant | significant | same | `worsening` |
| significant | significant | opposite | `improving` |
| significant | anything else | – | `not_enough_evidence` (El Niño can explain it) |
| not_significant | – | – | `no_change` |
| needs_more_years or record_too_short | – | – | `not_enough_evidence` |

### Step C. The case verdict, the answer key (`overall_verdict()`)

| Main-card outcomes | Case verdict |
|---|---|
| All the same | that outcome |
| Any disagreement, or no main cards | `not_enough_evidence` |

The answer key is computed by code, stored on the server and never sent to the browser or the Partner.

### Step D. What the student must answer to close the case (`grading.py`)

| Case verdict | "Is it real?" must be | Direction accepted | Ending if words back the ticks |
|---|---|---|---|
| worsening | yes | worsening | solved |
| improving | yes | improving | solved |
| no_change | no | no change | solved |
| not_enough_evidence | can't tell | no change, or the main cards' raw lean | **solved: not enough evidence** (a winning answer) |

In every row, if the student's written reasoning does not hold the ticks up, the case is **sent back** (one more try).

**Grade out of 100:** evidence 25 · method 25 · verdict 30 · explanation 20. Method points: season filter used before the Scales (10), Scales on every main card (10), El Niño lamp on a main card (5). "How much" earns its points only if the student's figure lies inside a main card's 95% range.

### The running example through the matrices

| Step | Check | Result |
|---|---|---|
| A | 45 years; t p 0.003; MK p 0.002; Ruler + and Sen +; range 32 to 155 not inside ±10 | **Significant**, big enough to matter |
| B | Depends on the El Niño lamp's stamp; rain card is "worse when rising" | worsening if it survives the lamp, otherwise not enough evidence |
| C | Depends on the case's other main cards | — |

**Open point (a design choice, not a bug).** `card_outcome()` does not read the `small` flag, so a significant but too-small trend still counts as worsening or improving. Mapping it to `no_change` is a one-line change, but it changes grading.

---

## Part 3. The Lab tools: which method each one uses

| Tool | OLS rate + 95% range (HAC) | t-test p | Mann-Kendall p | Sen's slope | Other method | What the student gets | Affects the verdict? |
|---|---|---|---|---|---|---|---|
| 🔍 Magnifier | – | – | – | – | – | Yearly dots, zoomable | No |
| 🟠 Season filter | – | – | – | – | Monthly anomaly (minus the 1991–2020 monthly normal) | The seasonal wave removed | No (method marks only) |
| 📏 Ruler | ✓ | computed, not shown | – | – | Needs ≥ 20 years | Rate per decade, 95% range, rising or falling | No (its range marks "how much") |
| ⚖️ Scales | ✓ | ✓ | ✓ (Hamed-Rao) | ✓ (sign must match) | Band check; years-needed estimate | **The stamp**, the "too small" flag, N more years | **Yes** |
| 💡 El Niño lamp | ✓ re-run | ✓ re-run | ✓ re-run | ✓ re-run | OLS on the El Niño index (not time); correlation r | Stamp on the El Niño-free record, r | **Yes** |
| 🗺️ Twin map | ✓ ×2 | ✓ ×2 | ✓ ×2 | ✓ ×2 | "Opposite trends" flag | Stamps for two regions side by side | No (comparison) |
| ✏️ My line | plain OLS, no range | – | – | – | Score vs wobble | Score out of 100 | No (learning) |
| 🔀 Shuffle test | plain OLS tilt ×1,000 | – | – | – | Permutation test | Histogram, "X of 1,000 as steep" | No (learning) |

**How the tools fit together, in order:** see the data (Magnifier) → remove the seasons (Season filter) → measure the tilt (Ruler) → test it two ways (Scales) → rule out El Niño (Lamp) → check another place (Twin) → write the verdict. The answer key runs exactly the Scales and the Lamp on every main card.

---

## Quick glossary

| Term | One line |
|---|---|
| Null hypothesis (H₀) | The "nothing is happening" assumption a test tries to reject. |
| p-value | Chance of data at least this extreme if H₀ were true. |
| α = 0.05 | The agreed cut-off: reject H₀ when p < 0.05. |
| Standard error | How uncertain an estimate is. |
| 95% confidence interval | Values of the true slope the data cannot rule out at α = 0.05. |
| Autocorrelation | Each year resembling the year before. HAC and Hamed-Rao allow for it. |
| Monotonic trend | Consistently up or consistently down, not necessarily a straight line. |
| Robust | Not easily moved by a few extreme values (Mann-Kendall, Sen). |
| Anomaly | A value minus its normal for that time of year. |
| Equivalence band | The size below which a change is too small to matter. |
