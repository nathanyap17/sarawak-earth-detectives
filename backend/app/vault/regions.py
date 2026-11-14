"""Regions for the hackathon vault (MASTER_SHEET §17: starter cases only).

Grid points are MERRA-2 cell centres (0.5 deg lat x 0.625 deg lon), the native grid behind
NASA POWER meteorology, so each point is a distinct cell. Sea-dominated cells are dropped
at build time (see vault/power.py, EXP-1).
AI-assisted: written with Claude Code."""
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class RegionDef:
    id: str
    name: str
    bbox: tuple[float, float, float, float]  # west, south, east, north

    @property
    def centroid(self) -> tuple[float, float]:
        w, s, e, n = self.bbox
        return (round((w + e) / 2, 3), round((s + n) / 2, 3))

    def grid_points(self) -> list[tuple[float, float]]:
        w, s, e, n = self.bbox
        lons = [x for x in np.arange(-180, 180, 0.625) if w <= x <= e]
        lats = [y for y in np.arange(-90, 90.001, 0.5) if s <= y <= n]
        return [(round(float(x), 3), round(float(y), 3)) for y in lats for x in lons]


REGIONS: dict[str, RegionDef] = {
    r.id: r
    for r in [
        # Case 001: the 2026 fires hit 11 districts of northern Sarawak (Miri, Bintulu, Tatau...).
        RegionDef("north-peat", "Northern Sarawak (Bintulu to Miri)", (112.8, 2.5, 114.9, 4.7)),
        # Case 002: water aid concentrated in southern Sarawak (Kuching, Samarahan, Serian).
        RegionDef("south-west", "Southern Sarawak (Kuching to Serian)", (109.9, 0.8, 111.3, 1.8)),
    ]
}
