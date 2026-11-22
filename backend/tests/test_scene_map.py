"""The map table's files line up with lon/lat (EXP-12): hot spots on the sea are not drawn as fires,
and the land/sea mask sits on the picture's own pixel grid. Build-time code only, no network.
AI-assisted: written with Claude Code."""
import json

import numpy as np
from PIL import Image

from app.config import REPO_ROOT
from app.vault import terrain

SCENE = REPO_ROOT / "frontend" / "public" / "scenes" / "001"


def test_hot_spots_on_the_sea_are_left_out(tmp_path):
    m = {"bbox": [110.0, 1.0, 111.0, 2.0], "fire_days": ["2026-02-01"]}
    a = np.zeros((10, 10, 4), dtype=np.uint8)
    a[2, 2, 3] = 255      # a hot spot on land
    a[7, 8, 3] = 255      # one on the sea
    Image.fromarray(a, "RGBA").save(tmp_path / "fires_2026-02-01.png")
    sea = np.zeros((10, 10), dtype=bool)
    sea[5:, 5:] = True
    pts, dropped = terrain.fire_points(tmp_path, m, sea)
    assert dropped == 1 and len(pts) == 1
    day, lon, lat = pts[0]
    assert (day, lon, lat) == (0, 110.25, 1.75)   # pixel centre (2.5, 2.5) of a 10x10 grid over 1 degree


def test_saved_scene_has_no_fire_on_the_sea():
    man = json.loads((SCENE / "manifest.json").read_text())
    sea = np.asarray(Image.open(SCENE / man["sea"]["file"])) > 127
    assert sea.shape == (man["height"], man["width"])     # same grid as base.jpg
    W, S, E, N = man["bbox"]
    fires = json.loads((SCENE / man["fire_points"]["file"]).read_text())
    assert len(fires) == man["fire_points"]["count"] and man["fire_points"]["sea_removed"] > 0
    for _, lon, lat in fires:
        x = min(man["width"] - 1, int((lon - W) / (E - W) * man["width"]))
        y = min(man["height"] - 1, int((N - lat) / (N - S) * man["height"]))
        assert not sea[y, x], (lon, lat)


def test_sea_mask_matches_the_picture_coast():
    """The blue sea in the Blue Marble picture and the sea in the height data agree almost everywhere."""
    man = json.loads((SCENE / "manifest.json").read_text())
    img = np.asarray(Image.open(SCENE / man["base"]).convert("RGB")).astype(int)
    blue = (img[..., 2] > img[..., 0] + 25) & (img[..., 2] > img[..., 1] + 5)
    sea = np.asarray(Image.open(SCENE / man["sea"]["file"])) > 127
    assert (blue == sea).mean() > 0.97
