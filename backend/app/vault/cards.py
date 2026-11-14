"""Evidence card catalogue: what each card measures and how its yearly value is made (§16).

`worse_when` and `band` are server-side only: they feed the answer key and stamps.
AI-assisted: written with Claude Code."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import numpy as np
import pandas as pd

ALL_MONTHS = list(range(1, 13))
POWER_MISSION = "MERRA-2 via NASA POWER"


def _longest_run(mask: pd.Series) -> int:
    best = cur = 0
    for m in mask.to_numpy():
        cur = cur + 1 if m else 0
        best = max(best, cur)
    return best


def _complete_years(daily: pd.DataFrame, months: list[int]) -> set[int]:
    """Years whose card months are fully covered (allowing 3 missing days)."""
    sub = daily[daily.index.month.isin(months)]
    have = sub.groupby(sub.index.year).size()
    out = set()
    for y, n in have.items():
        days = pd.date_range(f"{y}-01-01", f"{y}-12-31")
        expected = int(days.month.isin(months).sum())
        if n >= expected - 3:
            out.add(int(y))
    return out


@dataclass(frozen=True)
class CardDef:
    id: str
    name: str
    definition: str
    unit: str
    yearly_label: str  # what one yearly value is, in plain words
    mission: str
    from_year: int
    grid_km: float
    worse_when: str | None  # rising | falling | None (no "worse" direction)
    band: float  # "too small to matter" per decade, in card units
    months: list[int] = field(default_factory=lambda: ALL_MONTHS)
    yearly_fn: Callable[[pd.DataFrame, list[int]], pd.Series] | None = None
    monthly_fn: Callable[[pd.DataFrame], pd.Series] | None = None
    provisional: str | None = None  # why this card can't yet enter an answer key

    def yearly(self, daily: pd.DataFrame) -> pd.Series:
        s = self.yearly_fn(daily, self.months)
        keep = _complete_years(daily, self.months)
        s = s[s.index.isin(keep)]
        s.index = s.index.astype(int)
        return s.astype(float)

    def monthly(self, daily: pd.DataFrame) -> pd.Series:
        return self.monthly_fn(daily).astype(float)


def _season_sum(var):
    def f(d, months):
        x = d[d.index.month.isin(months)][var]
        return x.groupby(x.index.year).sum(min_count=1)
    return f


def _season_mean(var):
    def f(d, months):
        x = d[d.index.month.isin(months)][var]
        return x.groupby(x.index.year).mean()
    return f


def _driest3_mean(var):
    def f(d, months):
        m = d[var].resample("MS").mean()
        return m.groupby(m.index.year).apply(lambda s: s.nsmallest(3).mean())
    return f


def _dry_spell(d, months):
    return d.PRECTOTCORR.groupby(d.index.year).apply(lambda s: _longest_run(s < 1.0))


def _hot_count(var):
    def f(d, months):
        base = d.loc["1991":"2020", var]
        p90 = base.groupby(base.index.month).quantile(0.9)
        hot = d[var] > d.index.month.map(p90).to_numpy()
        return hot.groupby(d.index.year).sum()
    return f


def _hot_monthly(var):
    def f(d):
        base = d.loc["1991":"2020", var]
        p90 = base.groupby(base.index.month).quantile(0.9)
        return (d[var] > d.index.month.map(p90).to_numpy()).resample("MS").sum()
    return f


def _m_sum(var):
    return lambda d: d[var].resample("MS").sum(min_count=1)


def _m_mean(var):
    return lambda d: d[var].resample("MS").mean()


def _m_dry_spell(d):
    return d.PRECTOTCORR.resample("MS").apply(lambda s: _longest_run(s < 1.0))


RAIN_PROVISIONAL = ("POWER rain is MERRA-2 bias-corrected; trend not yet cross-checked "
                    "against GPM IMERG (EXP-11)")

CARDS: dict[str, CardDef] = {c.id: c for c in [
    CardDef("soil_dry3", "Soil wetness (driest months)",
            "How wet the ground is where roots reach, in the three driest months of each year. "
            "0 is bone dry, 1 is soaked.",
            "0-1", "mean of the 3 driest months", POWER_MISSION, 1981, 50,
            worse_when="falling", band=0.005,
            yearly_fn=_driest3_mean("GWETROOT"), monthly_fn=_m_mean("GWETROOT")),
    CardDef("rain_feb_apr", "Early-year rain (Feb-Apr)",
            "Total rain from February to April, the driest stretch of the year in northern Sarawak.",
            "mm", "Feb-Apr total", POWER_MISSION, 1981, 50,
            worse_when="falling", band=10.0, months=[2, 3, 4],
            yearly_fn=_season_sum("PRECTOTCORR"), monthly_fn=_m_sum("PRECTOTCORR"),
            provisional=RAIN_PROVISIONAL),
    CardDef("rain_jun_sep", "Mid-year rain (Jun-Sep)",
            "Total rain from June to September, the drier season in southern Sarawak.",
            "mm", "Jun-Sep total", POWER_MISSION, 1981, 50,
            worse_when="falling", band=10.0, months=[6, 7, 8, 9],
            yearly_fn=_season_sum("PRECTOTCORR"), monthly_fn=_m_sum("PRECTOTCORR"),
            provisional=RAIN_PROVISIONAL),
    CardDef("dry_spell", "Longest dry spell",
            "The longest run of days in a year with less than 1 mm of rain.",
            "days", "longest run in the year", POWER_MISSION, 1981, 50,
            worse_when="rising", band=0.5,
            yearly_fn=_dry_spell, monthly_fn=_m_dry_spell, provisional=RAIN_PROVISIONAL),
    CardDef("hot_days", "Hot days",
            "Days hotter than 9 in 10 days of the same month in 1991-2020.",
            "days", "count in the year", POWER_MISSION, 1981, 50,
            worse_when="rising", band=2.0,
            yearly_fn=_hot_count("T2M_MAX"), monthly_fn=_hot_monthly("T2M_MAX")),
    CardDef("hot_nights", "Hot nights",
            "Nights warmer than 9 in 10 nights of the same month in 1991-2020.",
            "days", "count in the year", POWER_MISSION, 1981, 50,
            worse_when="rising", band=2.0,
            yearly_fn=_hot_count("T2M_MIN"), monthly_fn=_hot_monthly("T2M_MIN")),
    CardDef("temp_mean", "Air temperature",
            "The average air temperature 2 m above the ground.",
            "deg C", "yearly mean", POWER_MISSION, 1981, 50,
            worse_when="rising", band=0.05,
            yearly_fn=_season_mean("T2M"), monthly_fn=_m_mean("T2M")),
    CardDef("humidity_feb_apr", "Air humidity (Feb-Apr)",
            "How much water vapour the air holds compared with the most it could, Feb to Apr.",
            "%", "Feb-Apr mean", POWER_MISSION, 1981, 50,
            worse_when="falling", band=0.5, months=[2, 3, 4],
            yearly_fn=_season_mean("RH2M"), monthly_fn=_m_mean("RH2M")),
    CardDef("wind", "Wind speed",
            "How fast the wind blows 2 m above the ground, averaged over the year.",
            "m/s", "yearly mean", POWER_MISSION, 1981, 50,
            worse_when=None, band=0.05,
            yearly_fn=_season_mean("WS2M"), monthly_fn=_m_mean("WS2M")),
]}

# Fire detections (FIRMS) join the catalogue once the archive arrives (EXP-2).
