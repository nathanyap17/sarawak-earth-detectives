"""Trend statistics for the desk tools (MASTER_SHEET §5.9, §16). Pure functions, no I/O.

Every number a student sees comes from here, never from an agent.
AI-assisted: written with Claude Code; reviewed against §16 and the known-answer tests.
"""
from __future__ import annotations

import math
import warnings
from dataclasses import dataclass

import numpy as np
import pandas as pd
import pymannkendall as mk
import statsmodels.api as sm

ALPHA = 0.05
MIN_YEARS = 20
YEARS_NEEDED_CAP = 51  # reported as "more than 50"
HAC_LAGS = 2  # widens the range when each year resembles the last


@dataclass(frozen=True)
class TrendTest:
    n: int
    rate_per_decade: float | None
    range: tuple[float, float] | None
    t_test_p: float | None
    mann_kendall_p: float | None
    sen_per_decade: float | None
    stamp: str  # significant | not_significant | needs_more_years | record_too_short
    direction: str | None  # rising | falling | flat
    years_needed: int | None


def _clean(yearly: pd.Series) -> pd.Series:
    s = pd.Series(yearly, dtype=float).dropna()
    s.index = s.index.astype(int)
    return s.sort_index()


# ---------------------------------------------------------------- season filter
def monthly_normal(monthly: pd.Series, base: tuple[int, int] = (1991, 2020)) -> pd.Series:
    """Each calendar month's mean over the baseline years. Index: month 1..12."""
    m = monthly.dropna()
    b = m[(m.index.year >= base[0]) & (m.index.year <= base[1])]
    if b.empty:
        b = m
    return b.groupby(b.index.month).mean()


def season_filter(monthly: pd.Series, base: tuple[int, int] = (1991, 2020)) -> pd.Series:
    """Monthly value minus that month's normal (the tinted lens)."""
    normal = monthly_normal(monthly, base)
    return monthly - monthly.index.month.map(normal).to_numpy()


# ---------------------------------------------------------------- ruler and scales
def ruler(yearly: pd.Series) -> tuple[float, tuple[float, float], float]:
    """OLS slope per decade, its 95% range (HAC) and the t-test p-value."""
    s = _clean(yearly)
    X = sm.add_constant(s.index.to_numpy(dtype=float))
    fit = sm.OLS(s.to_numpy(), X).fit(cov_type="HAC", cov_kwds={"maxlags": HAC_LAGS})
    lo, hi = fit.conf_int(alpha=ALPHA)[1]
    return float(fit.params[1] * 10), (float(lo * 10), float(hi * 10)), float(fit.pvalues[1])


def mann_kendall(yearly: pd.Series) -> tuple[float, float]:
    """Hamed-Rao modified Mann-Kendall p-value and Sen's slope per decade."""
    s = _clean(yearly)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        r = mk.hamed_rao_modification_test(s.to_numpy(), alpha=ALPHA)
    p = float(r.p) if np.isfinite(r.p) else 1.0
    return p, float(r.slope * 10)


def years_needed(rate: float, rng: tuple[float, float], n: int) -> int:
    """Extra years until the slope would clear about two standard errors.

    The standard error of a trend shrinks roughly as n^-1.5, so
    N = n * (2*SE / |b|)^(2/3). Capped at YEARS_NEEDED_CAP ("more than 50").
    """
    se = (rng[1] - rng[0]) / (2 * 1.96)
    if rate == 0 or se <= 0:
        return YEARS_NEEDED_CAP
    total = n * (2 * se / abs(rate)) ** (2 / 3)
    return int(min(YEARS_NEEDED_CAP, max(1, math.ceil(total - n))))


def scales(yearly: pd.Series, band: float) -> TrendTest:
    """Weigh the trend against the noise with two tests. A trend counts only if both agree.

    band: per-card "too small to matter" rate per decade. A non-significant result whose
    whole range sits inside +-band is "not significant"; otherwise "needs more years".
    """
    s = _clean(yearly)
    n = len(s)
    if n < MIN_YEARS:
        return TrendTest(n, None, None, None, None, None, "record_too_short", None, None)
    if s.std() == 0:
        return TrendTest(n, 0.0, (0.0, 0.0), 1.0, 1.0, 0.0, "not_significant", "flat", None)
    rate, rng, p_t = ruler(s)
    p_mk, sen = mann_kendall(s)
    if p_t < ALPHA and p_mk < ALPHA and np.sign(rate) == np.sign(sen):
        return TrendTest(n, rate, rng, p_t, p_mk, sen, "significant",
                         "rising" if rate > 0 else "falling", None)
    if -band <= rng[0] and rng[1] <= band:
        return TrendTest(n, rate, rng, p_t, p_mk, sen, "not_significant", "flat", None)
    return TrendTest(n, rate, rng, p_t, p_mk, sen, "needs_more_years",
                     "rising" if rate > 0 else "falling", years_needed(rate, rng, n))


# ---------------------------------------------------------------- workbench (learning tools)
def my_line(yearly: pd.Series, rate_per_decade: float, level: float) -> dict:
    """Score a line the student laid by hand against the best-fit line.

    The student's line is  level + rate/10 * (year - middle year).  "Miss" is the average
    distance between a line and the yearly dots. Score 100 means it lies on the best line.
    """
    s = _clean(yearly)
    x = s.index.to_numpy(dtype=float)
    mid = float(x.mean())
    mine = level + rate_per_decade / 10 * (x - mid)
    fit = sm.OLS(s.to_numpy(), sm.add_constant(x - mid)).fit()
    best = fit.params[0] + fit.params[1] * (x - mid)
    your_miss = float(np.abs(s.to_numpy() - mine).mean())
    best_miss = float(np.abs(s.to_numpy() - best).mean())
    # Score by how far the student's line sits from the best line, measured against the wobble
    # of the dots (half a standard deviation away on average scores 0). Comparing misses alone is
    # too kind: when the wobble is large, even a flat line misses the dots about as little.
    gap = float(np.abs(mine - best).mean())
    wobble = float(s.std()) or 1.0
    score = max(0.0, 100.0 * (1 - gap / (0.5 * wobble)))
    return {"your_miss": your_miss, "best_miss": best_miss, "score": round(score),
            "best_rate_per_decade": float(fit.params[1] * 10), "best_level": float(fit.params[0]),
            "mid_year": mid, "same_direction": bool(np.sign(rate_per_decade) == np.sign(fit.params[1]))}


def shuffle_test(yearly: pd.Series, n: int = 1000, bins: int = 21, seed: int = 7) -> dict:
    """Shuffle the years many times and measure the tilt each time.

    If the order of the years doesn't matter (no real trend), a shuffled record tilts as much as
    the real one quite often. Returns the real tilt, a histogram of shuffled tilts and how many
    were at least as steep. A simple picture of "chance"; the Scales are stricter because they
    also allow for each year resembling the last.
    """
    s = _clean(yearly)
    x = s.index.to_numpy(dtype=float)
    xc = x - x.mean()
    denom = float((xc ** 2).sum())
    y = s.to_numpy()
    real = float((xc * (y - y.mean())).sum() / denom * 10)
    rng = np.random.default_rng(seed)
    tilts = np.array([float((xc * rng.permutation(y)).sum() / denom * 10) for _ in range(n)])
    lim = max(float(np.abs(tilts).max()), abs(real)) * 1.05 or 1.0
    counts, edges = np.histogram(tilts, bins=bins, range=(-lim, lim))
    return {"real_rate_per_decade": real, "n": n, "as_steep": int((np.abs(tilts) >= abs(real)).sum()),
            "edges": [float(e) for e in edges], "counts": [int(c) for c in counts]}


# ---------------------------------------------------------------- El Nino lamp
def elnino_lamp(yearly: pd.Series, enso: pd.Series) -> pd.Series:
    """Remove the part of each year explained by the El Nino index, keep the mean.

    Time is never an input to this fit, so a real trend is not removed by construction.
    """
    s = _clean(yearly)
    e = pd.Series(enso, dtype=float)
    e.index = e.index.astype(int)
    e = e.reindex(s.index)
    ok = e.notna()
    if ok.sum() < 3:
        return s
    fit = sm.OLS(s[ok].to_numpy(), sm.add_constant(e[ok].to_numpy())).fit()
    out = s.copy()
    out[ok] = s[ok] - fit.params[1] * (e[ok] - e[ok].mean())
    return out[ok]


def elnino_correlation(yearly: pd.Series, enso: pd.Series) -> float | None:
    s = _clean(yearly)
    e = pd.Series(enso, dtype=float)
    e.index = e.index.astype(int)
    j = pd.concat([s, e.reindex(s.index)], axis=1).dropna()
    if len(j) < 3:
        return None
    return float(np.corrcoef(j.iloc[:, 0], j.iloc[:, 1])[0, 1])


# ---------------------------------------------------------------- twin map
def twin(a: TrendTest, b: TrendTest) -> bool:
    """True only if both regions are significant with opposite signs."""
    return (a.stamp == b.stamp == "significant" and a.direction != b.direction)


# ---------------------------------------------------------------- overall verdict
def card_outcome(test: TrendTest, worse_when: str, lamp: TrendTest | None) -> str:
    """worsening | improving | no_change | not_enough_evidence for one main card."""
    if test.stamp == "significant":
        if lamp is not None and lamp.stamp != "significant":
            return "not_enough_evidence"  # the El Nino lamp removes the trend
        return "worsening" if test.direction == worse_when else "improving"
    if test.stamp == "not_significant":
        return "no_change"
    return "not_enough_evidence"


def overall_verdict(outcomes: list[str]) -> str:
    """Main cards must agree; otherwise there is not enough evidence."""
    if not outcomes or len(set(outcomes)) > 1:
        return "not_enough_evidence"
    return outcomes[0]
