"""Kenyalang's statistics reference: how the Lab weighs a trend.

Condensed from docs/SED-Statistics-Reference.md (2026-11-23) for the Partner's prompt. Kept as a
.py module because the Cloud Run upload skips every *.md file. Two deliberate differences:
- The doc's running example is a real case result (wet-season rain). Here it is replaced by a
  made-up record, so the Partner can never quote or confirm a real case's figures.
- Internal notes (repo paths, the open design point) are left out.
Numbers here are method facts (0.05, 1.96, 20 years, 1991-2020...) and are approved text for the
number guard. Keep this in step with the doc and with backend/app/analysis/trend.py.
AI-assisted: written with Claude Code."""

TEXT = """\
HOW THE LAB WEIGHS A TREND (method facts; no case's results are in here)

SEASON FILTER (monthly anomaly). Each month minus its own normal for that calendar month, over
1991-2020. The yearly wet-dry wave is so big it hides any slow drift; removing it shows how unusual
each month was. The Scales test one value per year taken from the same months every year, so the
season is removed by design; the filter shows students why, and using it before the Scales earns
method points.

RULER (ordinary least squares). Lays the one straight line that sits closest to all the yearly dots
(it minimises the squared vertical gaps). Its tilt is the rate of change, shown per decade (ten
times the tilt per year). It answers "how much". It needs at least 20 years.

95% RANGE (confidence interval). The tilt is not known exactly because the dots wobble. The range
is every tilt that still fits the data reasonably: the rate plus or minus 1.96 standard errors, and
the rate always sits in the middle. The key check: is a flat line (zero) inside the range? The Lab
uses a Newey-West (HAC) standard error with 2 lags: a wet year is often followed by another wet
year (autocorrelation), and ordinary formulas would be over-confident, so HAC makes the range
honestly wider.

T-TEST (on the Ruler's tilt). Null hypothesis: no trend (tilt zero). t = tilt divided by its
standard error: how many "wobbles" tall the tilt is. The p-value is read off the bell curve, both
tails, because a steep fall would be as surprising as a steep rise. Same calculation as the range:
p is below 0.05 exactly when the 95% range leaves out zero (when t is beyond 1.96).

MANN-KENDALL (Hamed-Rao modified). Compares every pair of years: later year higher counts +1, lower
counts -1, a tie 0; the sum is S. With no trend, ups and downs cancel and S stays near zero. How far
S sits from zero, in wobbles, gives the p-value. It uses only the direction of each difference, not
the size, so one freak year cannot drag it, it does not need bell-shaped noise, and the trend need
not be a straight line (monotonic: consistently up or consistently down). Hamed-Rao corrects for
years resembling the year before. It is the robust check on the Ruler.

SEN'S SLOPE (Theil-Sen). The median of the tilts between every pair of years. A robust size of the
trend; up to about 29% of the values can be wild before it moves. The Lab uses it as a direction
check: its sign must match the Ruler's. If the straight line says rising but the typical pair says
falling, a few extreme years are doing the work. It does not set the range, the band check or the
years estimate; those use the Ruler.

WHAT P AND 0.05 MEAN. Right: p is the chance of a tilt at least this steep IF there were no trend.
Wrong: p is the chance the trend is luck. Right: 0.05 is an agreed convention, 1 in 20, not a law
of nature. Wrong: p above 0.05 means there is no trend; it means luck cannot be ruled out yet.
Wrong: significant means we know the cause; a trend is not a cause, which is the El Nino lamp's and
the student's job. Significant does not mean big or scary either.

"TOO SMALL TO MATTER" BAND AND THE YEARS ESTIMATE. Each evidence card has a band, plus or minus a
size per decade, below which a change is too small to matter for that record (an equivalence
margin). "Significant" only says a trend is not luck; the band asks whether it is big enough to
care about. When the result is not clear, the Lab estimates roughly how many more years of records
would settle it (the uncertainty of a trend shrinks roughly as years to the power 1.5), capped at
"more than 50". The estimate is shown only for "Not clear yet", and only when the tilt so far is at
least the band; otherwise no count is given.

EL NINO LAMP. Strong El Nino years make Borneo drier and hotter and can fake a trend, for example if
several fall late in the record. The lamp fits each year's value against the NOAA Relative Oceanic
Nino Index (RONI) for the card's months, removes the part El Nino explains (keeping the average),
and runs the full Scales again. Time is never an input, so a genuine time trend is not removed. It
also reports r, the correlation with El Nino. If the trend survives the lamp, El Nino did not make
it; if it fades, El Nino may have been doing the work.

TWIN MAP. Runs the full Scales on the same card for a second region. "Opposite trends" is flagged
only when both regions are significant and their directions differ. Same change in both: likely a
wide cause like climate. Only one: look for something local.

WORKBENCH (learning only, never the verdict). My line: the student lays a line by eye and scores
out of 100 for how close it is to the best line, measured against how much the dots wobble. Shuffle
test (a permutation test): shuffle the years 1,000 times and fit the tilt each time; if almost no
shuffled record tilts as steeply as the real one, year order matters, so there is a trend. It is
the most direct picture of a p-value, but it ignores year-to-year memory, so the Scales stay the
official judge.

THE STAMP FOR ONE RECORD (rows checked top to bottom, first match wins).
- Under 20 years: "Record too short".
- Both tests below 0.05 and Sen's sign matches the Ruler's: "Significant". If the whole 95% range
  also sits inside the band: "Significant, but too small to matter".
- Otherwise, the whole 95% range inside the band: "Not significant" (confidently near flat; this is
  stricter than p above 0.05, because even the extreme plausible tilts are negligible).
- Otherwise: "Not clear yet" (the record is long enough, but the wobble hides the answer).

FROM STAMPS TO A CARD'S OUTCOME. Only the case's main cards count; red herrings are skipped.
- Significant, and still significant under the El Nino lamp: worsening if it moves the way the card
  calls worse, improving if the other way.
- Significant, but not significant any more under the lamp: not enough evidence (El Nino can
  explain it).
- Not significant: no change.
- Not clear yet, or record too short: not enough evidence.
FROM CARDS TO THE CASE. If all main cards agree, the case follows them; any disagreement, or no main
cards, means not enough evidence. "Not enough evidence" with "can't tell" is a winning answer when
that is what the records show.

CLOSING A CASE. The student ticks "is it real?" (yes, no, can't tell) and a direction, then writes
their reasoning; if the words do not hold the ticks up, the case is sent back for one more try. The
grade is out of 100: evidence 25, method 25, verdict 30, explanation 20. Method points: season
filter before the Scales 10, Scales on every main card 10, El Nino lamp on a main card 5. A "how
much" figure earns its points only if it lies inside a main card's 95% range.

ORDER OF THE TOOLS. Magnifier (see the dots) -> Season filter (remove the seasons) -> Ruler (measure
the tilt) -> Scales (test it two ways) -> El Nino lamp (rule out El Nino) -> Twin map (check another
place) -> write the verdict.

A WORKED EXAMPLE ON A MADE-UP RECORD (not any case's data). Imagine a made-up record of jungle
frog calls with a band of plus or minus 1 call. Its Ruler tilt is 6 calls each decade and its 95%
range runs from 2 to 10, so a flat line does not fit and the whole range sits above the band. Both
tests come in below 0.05 and Sen's slope points the same way: "Significant", big enough to matter.
If the range had run from minus 3 to 15 instead, zero would fit inside: "Not clear yet".

GLOSSARY. Null hypothesis: the "nothing is happening" assumption a test tries to reject. Standard
error: how uncertain an estimate is. Autocorrelation: each year resembling the year before. Robust:
not easily moved by a few extreme values. Anomaly: a value minus its normal for that time of year.
Monotonic: consistently up or consistently down.
"""
