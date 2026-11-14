"""Build the vault for the starter regions.

    uv run python -m app.vault.build                 # all regions, cached downloads
    uv run python -m app.vault.build --refresh       # re-download from POWER and NOAA

AI-assisted: written with Claude Code."""
from __future__ import annotations

import argparse
import json
import time
from datetime import datetime, timezone

from app.analysis.trend import monthly_normal
from app.config import get_settings
from app.schemas import MonthlyPoint, NormalPoint, Series, YearlyPoint
from app.vault import enso, power
from app.vault.cards import CARDS
from app.vault.regions import REGIONS
from app.vault.store import root


def _r(v: float | None, nd: int = 4) -> float | None:
    return None if v is None or v != v else round(float(v), nd)


def build_region(region_id: str, refresh: bool = False) -> dict:
    s = get_settings()
    reg = REGIONS[region_id]
    cache = s.data_dir / "raw" / "power"
    if refresh:
        for lon, lat in reg.grid_points():
            power.fetch_point(lon, lat, cache, refresh=True)
    daily, prov = power.region_daily(reg.grid_points(), cache)
    (root() / "daily").mkdir(parents=True, exist_ok=True)
    daily.to_parquet(root() / "daily" / f"{region_id}.parquet")
    as_of = daily.dropna().index.max().strftime("%Y-%m-%d")
    out = root() / "series" / region_id
    out.mkdir(parents=True, exist_ok=True)
    cards = {}
    for card in CARDS.values():
        monthly = card.monthly(daily)
        yearly = card.yearly(daily)
        base = (2001, 2020) if card.from_year >= 2000 else (1991, 2020)
        normal = monthly_normal(monthly, base)
        ser = Series(
            card_id=card.id, region_id=region_id, data_as_of=as_of,
            monthly=[MonthlyPoint(t=t.strftime("%Y-%m"), v=_r(v)) for t, v in monthly.items()],
            yearly=[YearlyPoint(y=int(y), v=_r(v)) for y, v in yearly.items()],
            normal=[NormalPoint(m=int(m), v=round(float(v), 4)) for m, v in normal.items()],
        )
        (out / f"{card.id}.json").write_text(ser.model_dump_json(), encoding="utf-8")
        cards[card.id] = {"years": [int(yearly.index.min()), int(yearly.index.max())],
                          "n_years": int(len(yearly)), "data_as_of": as_of}
    return {"name": reg.name, "bbox": reg.bbox, **prov, "cards": cards}


def build_enso(refresh: bool = False) -> str:
    raw = get_settings().data_dir / "raw" / "noaa" / "RONI.ascii.txt"
    if refresh or not raw.exists():
        enso.download(raw)
    m = enso.monthly(raw)
    (root() / "enso").mkdir(parents=True, exist_ok=True)
    (root() / "enso" / "roni_monthly.json").write_text(
        json.dumps({t.strftime("%Y-%m-%d"): float(v) for t, v in m.items()}), encoding="utf-8")
    return m.index.max().strftime("%Y-%m")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--region", action="append")
    ap.add_argument("--refresh", action="store_true")
    a = ap.parse_args()
    t0 = time.time()
    index = {"built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
             "enso": {"source": "NOAA CPC RONI", "last_season_centre": build_enso(a.refresh)},
             "regions": {}}
    for rid in a.region or list(REGIONS):
        index["regions"][rid] = build_region(rid, a.refresh)
        r = index["regions"][rid]
        print(f"{rid}: {len(r['land_points'])} land cells, {len(r['sea_points_dropped'])} sea "
              f"dropped, {len(r['cards'])} cards, as of {next(iter(r['cards'].values()))['data_as_of']}")
    (root() / "index.json").write_text(json.dumps(index, indent=1), encoding="utf-8")
    print(f"vault built in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
