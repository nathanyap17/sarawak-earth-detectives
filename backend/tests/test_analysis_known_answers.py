"""Known-answer tests (MASTER_SHEET §21, harness rule 4). Must pass before any demo or deploy.
Synthetic records with known trends must return the right stamps.
AI-assisted: written with Claude Code."""
import numpy as np
import pandas as pd
import pytest

from app.analysis import trend

YEARS = np.arange(1981, 2026)  # 45 years
RNG = np.random.default_rng(20261114)


def yearly(values, years=YEARS):
    return pd.Series(values, index=years)


def test_rising():
    s = yearly(10 + 0.05 * (YEARS - 1981) + RNG.normal(0, 0.2, len(YEARS)))
    r = trend.scales(s, band=0.1)
    assert r.stamp == "significant" and r.direction == "rising"
    assert r.range[0] < 0.5 < r.range[1]  # true rate 0.5 per decade inside the range
    assert 0.3 < r.rate_per_decade < 0.7


def test_falling():
    s = yearly(10 - 0.05 * (YEARS - 1981) + RNG.normal(0, 0.2, len(YEARS)))
    r = trend.scales(s, band=0.1)
    assert r.stamp == "significant" and r.direction == "falling"


def test_flat():
    s = yearly(10 + RNG.normal(0, 0.05, len(YEARS)))
    r = trend.scales(s, band=0.1)
    assert r.stamp == "not_significant" and r.direction == "flat"
    assert r.years_needed is None


def test_noisy_small_trend_needs_more_years():
    s = yearly(10 + 0.01 * (YEARS - 1981) + RNG.normal(0, 1.5, len(YEARS)))
    r = trend.scales(s, band=0.01)
    assert r.stamp == "needs_more_years"
    assert 1 <= r.years_needed <= trend.YEARS_NEEDED_CAP


def test_no_tilt_but_too_wobbly_gives_no_years_count():
    # About zero tilt, big wobble: the range spills past the band, but projecting years is meaningless.
    noise = np.random.default_rng(11).normal(0, 1.5, len(YEARS))
    x = YEARS - YEARS.mean()
    noise -= x * (x @ noise) / (x @ x)          # remove its own tilt exactly: the slope is zero
    r = trend.scales(yearly(10 + noise), band=0.2)
    assert r.stamp == "needs_more_years" and abs(r.rate_per_decade) < 1e-9
    assert r.years_needed is None


def test_real_but_tiny_trend_is_flagged_small():
    s = yearly(10 + 0.002 * (YEARS - 1981) + RNG.normal(0, 0.002, len(YEARS)))
    r = trend.scales(s, band=0.1)
    assert r.stamp == "significant" and r.small
    big = trend.scales(yearly(10 + 0.05 * (YEARS - 1981) + RNG.normal(0, 0.2, len(YEARS))), band=0.1)
    assert big.stamp == "significant" and not big.small


def test_elnino_only_trend_is_removed_by_lamp():
    # The index itself trends (strong late El Ninos); the record only follows the index.
    enso = yearly(np.linspace(-1, 1, len(YEARS)) + RNG.normal(0, 0.3, len(YEARS)))
    s = yearly(10 + 2.0 * enso.to_numpy() + RNG.normal(0, 0.05, len(YEARS)))
    raw = trend.scales(s, band=0.05)
    assert raw.stamp == "significant"
    lamp = trend.scales(trend.elnino_lamp(s, enso), band=0.05)
    assert lamp.stamp != "significant"
    assert trend.card_outcome(raw, "rising", lamp) == "not_enough_evidence"


def test_real_trend_survives_lamp():
    enso = yearly(RNG.normal(0, 1, len(YEARS)))
    s = yearly(10 + 0.05 * (YEARS - 1981) + 0.5 * enso.to_numpy() + RNG.normal(0, 0.1, len(YEARS)))
    lamp = trend.scales(trend.elnino_lamp(s, enso), band=0.1)
    assert lamp.stamp == "significant" and lamp.direction == "rising"


def test_too_short():
    yrs = np.arange(2010, 2025)
    r = trend.scales(yearly(np.arange(len(yrs), dtype=float), yrs), band=0.1)
    assert r.stamp == "record_too_short" and r.rate_per_decade is None


def test_season_filter_removes_cycle():
    idx = pd.date_range("1991-01-01", "2020-12-01", freq="MS")
    monthly = pd.Series(100 + 50 * np.sin(2 * np.pi * idx.month / 12), index=idx)
    anom = trend.season_filter(monthly)
    assert anom.abs().max() < 1e-9


def test_twin_opposite_only_if_both_significant():
    up = trend.scales(yearly(0.05 * (YEARS - 1981) + RNG.normal(0, 0.1, len(YEARS))), 0.1)
    down = trend.scales(yearly(-0.05 * (YEARS - 1981) + RNG.normal(0, 0.1, len(YEARS))), 0.1)
    flat = trend.scales(yearly(RNG.normal(0, 0.01, len(YEARS))), 0.1)
    assert trend.twin(up, down) is True
    assert trend.twin(up, flat) is False


@pytest.mark.parametrize("outcomes,expected", [
    (["worsening"], "worsening"),
    (["worsening", "worsening"], "worsening"),
    (["worsening", "improving"], "not_enough_evidence"),
    ([], "not_enough_evidence"),
])
def test_overall_verdict(outcomes, expected):
    assert trend.overall_verdict(outcomes) == expected
