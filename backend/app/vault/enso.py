"""NOAA Relative Oceanic Nino Index (RONI), the El Nino lamp's index (EXP-3).
AI-assisted: written with Claude Code."""
from pathlib import Path

import httpx
import pandas as pd

URL = "https://www.cpc.ncep.noaa.gov/data/indices/RONI.ascii.txt"
# 3-month season label -> its centre month
CENTRE = {"DJF": 1, "JFM": 2, "FMA": 3, "MAM": 4, "AMJ": 5, "MJJ": 6,
          "JJA": 7, "JAS": 8, "ASO": 9, "SON": 10, "OND": 11, "NDJ": 12}


def download(dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    r = httpx.get(URL, timeout=60)
    r.raise_for_status()
    dest.write_text(r.text, encoding="utf-8")
    return dest


def monthly(path: Path) -> pd.Series:
    """RONI anomaly indexed by the centre month of each 3-month season."""
    t = pd.read_csv(path, sep=r"\s+")
    idx = pd.to_datetime({"year": t.YR, "month": t.SEAS.map(CENTRE), "day": 1})
    return pd.Series(t.ANOM.to_numpy(), index=idx).sort_index()


def for_months(roni_monthly: pd.Series, months: list[int]) -> pd.Series:
    """Per-year mean of RONI over the card's months."""
    m = roni_monthly[roni_monthly.index.month.isin(months)]
    g = m.groupby(m.index.year)
    return g.mean()[g.size() == len(months)]
