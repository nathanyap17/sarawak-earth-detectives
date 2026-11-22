"""Build-time terrain for the 3D map table (PLAN Phase 3.5). Never runs during a request.

Heights: AWS Terrain Tiles (terrarium encoding, public, no login), SRTM-derived. Swap to
NASADEM via Earthdata when Nathan's login is available. Also turns the saved GIBS VIIRS
fire frames into a point list so the browser can draw embers, and saves a land/sea mask on the
picture's pixel grid (sea.png): hot spots on the sea are gas flares, not fires, so they are left out.

Usage (from backend/): uv run python -m app.vault.terrain [case_id]
AI-assisted: written with Claude Code."""
from __future__ import annotations

import io
import json
import math
import sys
from pathlib import Path

import httpx
import numpy as np
from PIL import Image

from app.config import REPO_ROOT

TILE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
N = 256  # mesh resolution
Z = 8


def _tile_xy(lon: float, lat: float, z: int) -> tuple[float, float]:
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def _raw(bbox: tuple[float, float, float, float], lons: np.ndarray, lats: np.ndarray, z: int) -> np.ndarray:
    """Terrarium heights in metres (sea depths negative) at every (lat, lon) of the grid, nearest pixel."""
    W, S, E, Nn = bbox
    x0, y0 = _tile_xy(W, Nn, z)
    x1, y1 = _tile_xy(E, S, z)
    tx0, ty0, tx1, ty1 = int(x0), int(y0), int(x1), int(y1)
    mosaic = np.zeros(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256))
    with httpx.Client(timeout=30) as c:
        for tx in range(tx0, tx1 + 1):
            for ty in range(ty0, ty1 + 1):
                r = c.get(TILE.format(z=z, x=tx, y=ty))
                r.raise_for_status()
                a = np.asarray(Image.open(io.BytesIO(r.content)).convert("RGB"), dtype=np.float64)
                mosaic[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] =                     a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    n = 2 ** z
    fx = (lons + 180) / 360 * n
    fy = (1 - np.arcsinh(np.tan(np.radians(lats))) / np.pi) / 2 * n
    px = np.clip(((fx - tx0) * 256).astype(int), 0, mosaic.shape[1] - 1)
    py = np.clip(((fy - ty0) * 256).astype(int), 0, mosaic.shape[0] - 1)
    return mosaic[np.ix_(py, px)]


def heights(bbox: tuple[float, float, float, float], size: int = N) -> np.ndarray:
    """size×size heights in metres, row 0 = north, sampled on a regular lon/lat grid whose first and
    last rows and columns sit on the bbox edges (they become the mesh's edge vertices)."""
    W, S, E, Nn = bbox
    return np.clip(_raw(bbox, np.linspace(W, E, size), np.linspace(Nn, S, size), Z), 0, None)


def sea_mask(bbox: tuple[float, float, float, float], width: int, height: int) -> np.ndarray:
    """True where the ground is at or below sea level, on the picture's own pixel grid (pixel centres),
    so it lines up with base.jpg and the fire frames. Zoom 9 tiles: about 300 m per tile pixel."""
    W, S, E, Nn = bbox
    lons = W + (np.arange(width) + 0.5) / width * (E - W)
    lats = Nn - (np.arange(height) + 0.5) / height * (Nn - S)
    return _raw(bbox, lons, lats, 9) <= 0


def fire_points(scene_dir: Path, manifest: dict, sea: np.ndarray | None = None) -> tuple[list[list[float]], int]:
    """[day_index, lon, lat] for every red pixel in each daily VIIRS frame, and how many were left out
    because they sit on the sea: gas flares at offshore platforms and at the shore (Bintulu's LNG
    plant), which return to the same spots day after day. They are hot, but they are not fires."""
    W, S, E, Nn = manifest["bbox"]
    pts: list[list[float]] = []
    dropped = 0
    for d, day in enumerate(manifest["fire_days"]):
        p = scene_dir / f"fires_{day}.png"
        if not p.exists():
            continue
        a = np.asarray(Image.open(p).convert("RGBA"))
        ys, xs = np.nonzero(a[..., 3] > 0)
        h, w = a.shape[:2]
        seen: set[tuple[int, int]] = set()  # GIBS draws each fire as a pixel blob: keep one per 0.03°
        for y, x in zip(ys, xs):
            lon, lat = W + (x + 0.5) / w * (E - W), Nn - (y + 0.5) / h * (Nn - S)
            k = (round(lon / 0.03), round(lat / 0.03))
            if k in seen:
                continue
            seen.add(k)
            if sea is not None and sea[y, x]:
                dropped += 1
                continue
            pts.append([d, round(lon, 3), round(lat, 3)])
    return pts, dropped


def build(case_id: str = "001") -> None:
    scene = REPO_ROOT / "frontend" / "public" / "scenes" / case_id
    m = json.loads((scene / "manifest.json").read_text())
    bbox = tuple(m["bbox"])
    h = heights(bbox)
    (scene / "height.bin").write_bytes(h.astype("<u2").tobytes())
    sea = sea_mask(bbox, m["width"], m["height"])
    Image.fromarray((sea * 255).astype(np.uint8), "L").save(scene / "sea.png", optimize=True)
    pts, dropped = fire_points(scene, m, sea)
    (scene / "fires.json").write_text(json.dumps(pts, separators=(",", ":")))
    m["terrain"] = {"file": "height.bin", "size": N, "max_m": int(h.max()),
                    "source": "SRTM-derived heights (AWS Terrain Tiles, terrarium)"}
    m["sea"] = {"file": "sea.png", "source": "Land and sea from the same heights with sea depths: 0 m or below is sea"}
    m["fire_points"] = {"file": "fires.json", "count": len(pts), "sea_removed": dropped}
    (scene / "manifest.json").write_text(json.dumps(m, indent=1))
    print(f"terrain {N}x{N} max {h.max():.0f} m; sea {sea.mean():.0%} of the picture; "
          f"{len(pts)} fire points, {dropped} hot spots on the sea left out")


if __name__ == "__main__":
    build(*(sys.argv[1:2] or ["001"]))
