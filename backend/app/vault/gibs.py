"""Save NASA GIBS imagery for a case scene as static files (rule 7: nothing fetched live).

    uv run python -m app.vault.gibs 001

Writes frontend/public/scenes/{case}/: base.jpg (Blue Marble shaded relief), fires_YYYY-MM-DD.png
(VIIRS SNPP 375 m thermal anomalies, transparent, one per day of the scene window) and
manifest.json. EPSG:4326, so pixel x/y are linear in lon/lat.
AI-assisted: written with Claude Code."""
from __future__ import annotations

import json
import sys
from datetime import date, timedelta

import httpx

from app.casework import load_case
from app.config import REPO_ROOT

WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
BBOX = (109.5, 0.8, 115.7, 5.1)  # all of Sarawak: west, south, east, north
WIDTH = 930
HEIGHT = round(WIDTH * (BBOX[3] - BBOX[1]) / (BBOX[2] - BBOX[0]))
BASE = "BlueMarble_ShadedRelief_Bathymetry"
FIRES = "VIIRS_SNPP_Thermal_Anomalies_375m_All"


def _get(client: httpx.Client, layer: str, fmt: str, day: str | None) -> bytes:
    q = {"SERVICE": "WMS", "REQUEST": "GetMap", "VERSION": "1.3.0", "CRS": "EPSG:4326",
         "BBOX": f"{BBOX[1]},{BBOX[0]},{BBOX[3]},{BBOX[2]}", "WIDTH": WIDTH, "HEIGHT": HEIGHT,
         "LAYERS": layer, "FORMAT": fmt, "TRANSPARENT": "TRUE"}
    if day:
        q["TIME"] = day
    r = client.get(WMS, params=q, timeout=60)
    r.raise_for_status()
    if not r.headers.get("content-type", "").startswith("image/"):
        raise RuntimeError(f"GIBS returned {r.headers.get('content-type')} for {layer} {day}")
    return r.content


def save_scene(case_id: str) -> dict:
    c = load_case(case_id)
    out = REPO_ROOT / "frontend" / "public" / "scenes" / case_id
    out.mkdir(parents=True, exist_ok=True)
    d0, d1 = date.fromisoformat(c.scene.from_), date.fromisoformat(c.scene.to)
    days, missing = [], []
    with httpx.Client() as cl:
        (out / "base.jpg").write_bytes(_get(cl, BASE, "image/jpeg", None))
        d = d0
        while d <= d1:
            f = out / f"fires_{d.isoformat()}.png"
            if not f.exists():
                try:
                    f.write_bytes(_get(cl, FIRES, "image/png", d.isoformat()))
                except RuntimeError:
                    missing.append(d.isoformat())  # GIBS has no granule for that day
                    d += timedelta(days=1)
                    continue
            days.append(d.isoformat())
            d += timedelta(days=1)
    manifest = {"bbox": BBOX, "width": WIDTH, "height": HEIGHT, "base": "base.jpg",
                "base_source": "NASA GIBS: Blue Marble shaded relief and bathymetry",
                "fires_source": "NASA GIBS: VIIRS (Suomi NPP) 375 m thermal anomalies",
                "fire_days": days, "missing_days": missing}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    return manifest


if __name__ == "__main__":
    m = save_scene(sys.argv[1] if len(sys.argv) > 1 else "001")
    print(f"saved base + {len(m['fire_days'])} fire frames, {m['width']}x{m['height']}")
