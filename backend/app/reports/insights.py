"""Key insights for the executive summary: one chart-ready figure per record the detective tested.

For each record: the yearly values, the straight-line fit (ordinary least squares, the same fit as
the Ruler), the t-test and Mann-Kendall results, Sen's slope, R², the El Niño lamp re-test, and a
caption written here by code (rule 1: no model writes or computes these numbers). Significant
records also carry the fitted line drawn five years past the record, labelled as an illustration,
never as a forecast.

Built only from records the student tested (or chose, if they ran no test) on a closed case, so it
shows nothing they could not have seen in the lab. It never reads the answer key.
AI-assisted: written with Claude Code."""
from __future__ import annotations

import numpy as np

from app import casework
from app.analysis import trend
from app.reports.casefile import fmt
from app.schemas import CasePack
from app.vault import store
from app.vault.cards import CARDS

EXTEND = 5   # years the significant trend line is drawn past the record (illustration only)
MAX = 6
STAMP = {"significant": "Significant", "not_significant": "Not significant",
         "needs_more_years": "Needs more years", "record_too_short": "Record too short"}


def _cards(s, c: CasePack) -> list[str]:
    seen: list[str] = []
    for a in s.analyses:
        if a.get("card_id") not in seen:
            seen.append(a["card_id"])
    if not seen:
        seen = list(s.chosen)
    return [i for i in seen if i in CARDS and i in c.evidence][:MAX]


def _fit(y) -> tuple[float, float, float]:
    """(slope per year, intercept, R²) of the plain least-squares line."""
    x = y.index.to_numpy(dtype=float)
    v = y.to_numpy(dtype=float)
    b, a = np.polyfit(x, v, 1)
    pred = a + b * x
    ss_tot = float(((v - v.mean()) ** 2).sum())
    r2 = 0.0 if ss_tot == 0 else 1 - float(((v - pred) ** 2).sum()) / ss_tot
    return float(b), float(a), r2


def caption(name: str, unit: str, t: trend.TrendTest, lamp: trend.TrendTest | None, first: int, last: int,
            r2: float | None, band: float) -> str:
    """The story of one record, in plain words, every figure formatted by code."""
    per = f"{unit} per decade"
    if t.stamp == "record_too_short":
        return (f"{name} has only {t.n} complete years, fewer than the {trend.MIN_YEARS} the tests need, "
                "so this record cannot settle anything yet.")
    pt, pmk = fmt(t.t_test_p, p=True), fmt(t.mann_kendall_p, p=True)
    fit = f" The straight line explains {r2 * 100:.0f}% of the year-to-year variation (R²)." if r2 is not None else ""
    if t.stamp == "significant":
        word = "rose" if (t.rate_per_decade or 0) > 0 else "fell"
        out = (f"{name} {word} by {fmt(t.rate_per_decade)} {per} over {t.n} years ({first} to {last}). "
               f"Linear regression (t-test p {pt}) and the Mann-Kendall rank test (p {pmk}) both fall below the 0.05 line, "
               f"and Sen's slope ({fmt(t.sen_per_decade)} {per}) points the same way, so chance alone is an unlikely "
               f"explanation.{fit}")
        if lamp is not None:
            out += (" With the El Niño effect removed the trend still passes, so it is not just a few El Niño years."
                    if lamp.stamp == "significant" else
                    f" But with the El Niño effect removed it no longer passes ({STAMP[lamp.stamp].lower()}): "
                    "El Niño years may be doing much of the work.")
        return out
    lo, hi = (fmt(t.range[0]), fmt(t.range[1])) if t.range else ("?", "?")
    if t.stamp == "not_significant":
        return (f"{name} tilts {fmt(t.rate_per_decade)} {per}, but the tests are far from the 0.05 line "
                f"(t-test p {pt}, Mann-Kendall p {pmk}) and the whole 95% range ({lo} to {hi}) sits inside the "
                f"'too small to matter' band of plus or minus {band:g}. Read: no meaningful change; the year-to-year "
                f"noise is bigger than any trend.{fit}")
    need = "more than 50" if (t.years_needed or 0) > 50 else str(t.years_needed)
    return (f"{name} tilts {fmt(t.rate_per_decade)} {per}, but the tests stay above the 0.05 line "
            f"(t-test p {pt}, Mann-Kendall p {pmk}) and the 95% range ({lo} to {hi}) includes zero, so the tilt "
            f"could be chance. At this level of noise about {need} years of records would be needed to settle it.{fit}")


def build(s, c: CasePack) -> list[dict]:
    out = []
    for cid in _cards(s, c):
        card = CARDS[cid]
        try:
            ser = store.load_series(c.region.id, cid)
        except FileNotFoundError:
            continue
        y = trend._clean(store.yearly_series(ser))
        if y.empty:
            continue
        t = trend.scales(y, card.band)
        lamp, r, adj = None, None, None
        if t.stamp != "record_too_short":
            e = casework.enso_for(card)
            adj_s = trend.elnino_lamp(y, e)
            lamp = trend.scales(adj_s, card.band)
            r = trend.elnino_correlation(y, e)
            adj = [[int(k), round(float(v), 4)] for k, v in adj_s.dropna().items()]
        b, a, r2 = _fit(y) if len(y) >= 3 else (None, None, None)
        first, last = int(y.index.min()), int(y.index.max())
        line = None
        if b is not None and t.stamp != "record_too_short":
            line = [[first, round(a + b * first, 4)], [last, round(a + b * last, 4)]]
            if t.stamp == "significant":
                line.append([last + EXTEND, round(a + b * (last + EXTEND), 4)])
        out.append({
            "card_id": cid, "name": card.name, "definition": card.definition, "unit": card.unit,
            "yearly_label": card.yearly_label, "mission": card.mission, "data_as_of": ser.data_as_of,
            "points": [[int(k), round(float(v), 4)] for k, v in y.items()],
            "line": line, "extend_years": EXTEND if line and len(line) == 3 else 0,
            "elnino_points": adj,
            "metrics": {
                "n_years": t.n, "first": first, "last": last,
                "rate": fmt(t.rate_per_decade), "range": [fmt(x) for x in t.range] if t.range else None,
                "t_test_p": fmt(t.t_test_p, p=True), "mann_kendall_p": fmt(t.mann_kendall_p, p=True),
                "t_test_p_raw": t.t_test_p, "mann_kendall_p_raw": t.mann_kendall_p,
                "sen": fmt(t.sen_per_decade), "r2": None if r2 is None else f"{r2:.2f}",
                "elnino_r": fmt(r), "after_elnino": STAMP.get(lamp.stamp) if lamp else None,
                "after_elnino_rate": fmt(lamp.rate_per_decade) if lamp else None,
                "band": f"{card.band:g}", "years_needed": ("more than 50" if (t.years_needed or 0) > 50 else t.years_needed),
            },
            "stamp": t.stamp, "stamp_text": STAMP[t.stamp], "direction": t.direction,
            "significant": t.stamp == "significant",
            "caption": caption(card.name, card.unit, t, lamp, first, last, r2, card.band),
        })
    out.sort(key=lambda i: (not i["significant"], i["metrics"]["t_test_p_raw"] if i["metrics"]["t_test_p_raw"] is not None else 2))
    return out


def facts(items: list[dict]) -> str:
    """Lines the Reporter may quote (the number guard allows only figures that appear here)."""
    lines = []
    for i in items:
        m = i["metrics"]
        lines.append(f"Chart {i['name']}: {i['stamp_text']}; {m['n_years']} years {m['first']} to {m['last']}; "
                     f"rate {m['rate']} {i['unit']} per decade; t-test p {m['t_test_p']}; Mann-Kendall p {m['mann_kendall_p']}; "
                     f"Sen's slope {m['sen']}; R² {m['r2']}; after El Nino removal {m["after_elnino"]}.")
    return "\n".join(lines)
