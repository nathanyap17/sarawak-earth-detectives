"""NASA POWER ingest (daily point API). Run by the vault build script only, never by a route.

Verified 2026-11-14 (EXP-1): no login, ~3 s per point, record 1981-01-01 to ~3 days ago.
AI-assisted: written with Claude Code."""
from __future__ import annotations

import json
import time
from datetime import date, timedelta
from pathlib import Path

import httpx
import pandas as pd

URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMS = ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "GWETROOT", "GWETTOP", "RH2M", "WS2M"]
FILL = -999.0
LAND_MIN_DIURNAL_C = 3.0  # sea-dominated cells have Tmax - Tmin below ~1 C


def fetch_point(lon: float, lat: float, cache_dir: Path, end: date | None = None,
                refresh: bool = False) -> dict:
    cache_dir.mkdir(parents=True, exist_ok=True)
    f = cache_dir / f"pt_{lon:.3f}_{lat:.3f}.json"
    if f.exists() and not refresh:
        return json.loads(f.read_text(encoding="utf-8"))
    end = end or (date.today() - timedelta(days=1))
    q = {"parameters": ",".join(PARAMS), "community": "AG", "longitude": lon, "latitude": lat,
         "start": "19810101", "end": end.strftime("%Y%m%d"), "format": "JSON"}
    for attempt in range(3):
        try:
            r = httpx.get(URL, params=q, timeout=180)
            r.raise_for_status()
            f.write_text(r.text, encoding="utf-8")
            return r.json()
        except httpx.HTTPError:
            if attempt == 2:
                raise
            time.sleep(5 * (attempt + 1))
    raise RuntimeError("unreachable")


def to_frame(payload: dict) -> pd.DataFrame:
    df = pd.DataFrame(payload["properties"]["parameter"]).replace(FILL, float("nan"))
    df.index = pd.to_datetime(df.index, format="%Y%m%d")
    return df.dropna(how="all")


def is_land(df: pd.DataFrame) -> bool:
    return float((df.T2M_MAX - df.T2M_MIN).mean()) > LAND_MIN_DIURNAL_C


def region_daily(points: list[tuple[float, float]], cache_dir: Path) -> tuple[pd.DataFrame, dict]:
    """Average the land cells' daily records. Returns (frame, provenance)."""
    kept, dropped = [], []
    frames = []
    for lon, lat in points:
        df = to_frame(fetch_point(lon, lat, cache_dir))
        if is_land(df):
            kept.append([lon, lat])
            frames.append(df)
        else:
            dropped.append([lon, lat])
    if not frames:
        raise ValueError("no land cells in region")
    daily = pd.concat(frames).groupby(level=0).mean()
    return daily, {"source": "NASA POWER daily (MERRA-2 / GEOS-IT)", "land_points": kept,
                   "sea_points_dropped": dropped}
