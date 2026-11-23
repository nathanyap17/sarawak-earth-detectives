"""Key insights for the executive summary: one chart-ready figure per record in the case.

For each record: the yearly values, the straight-line fit (ordinary least squares, the same fit as
the Ruler), the t-test and Mann-Kendall results, Sen's slope, R², the El Niño lamp re-test, and a
caption written here by code (rule 1: no model writes or computes these numbers). Records
whose trend survives every check also carry the fitted line drawn five years past the record, labelled as an illustration,
never as a forecast.

The executive summary is the agency's worked example of the case (changed 2026-11-19): it charts every
record that bears on the question, whether or not this student tested it, and runs the same tests the
lab runs, so a student sees how each record is judged, including the ones that are not significant
and why. It is built only after the case is closed and never reads the answer key (it recomputes
each record's statistics, exactly as the lab would). Records that don't bear on the question are
left out. Each record is placed in one of three groups:
  robust     significant, and still significant with the El Nino effect removed
  elnino     significant at first, but not once the El Nino effect is removed
  not        not significant (or the record is too short)
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
         "needs_more_years": "Not clear yet", "record_too_short": "Record too short"}


def _cards(c: CasePack) -> list[str]:
    """Every record that bears on the question: the main records first, then the others in case order."""
    rel = [i for i in c.evidence if i not in c.red_herrings and i in CARDS]
    return ([i for i in c.main_cards if i in rel] + [i for i in rel if i not in c.main_cards])[:MAX]


GROUP_TEXT = {"robust": "Significant, and holds with El Niño removed",
              "elnino": "Significant at first, not once El Niño is removed",
              "not": "Not significant"}


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
        if t.small:
            out += (f" But the whole 95% range sits inside the 'too small to matter' band of plus or minus {band:g}: "
                    "the change is real, yet too small to matter.")
        return out
    lo, hi = (fmt(t.range[0]), fmt(t.range[1])) if t.range else ("?", "?")
    if t.stamp == "not_significant":
        return (f"{name} tilts {fmt(t.rate_per_decade)} {per}, but the tests are far from the 0.05 line "
                f"(t-test p {pt}, Mann-Kendall p {pmk}) and the whole 95% range ({lo} to {hi}) sits inside the "
                f"'too small to matter' band of plus or minus {band:g}. Read: no meaningful change; the year-to-year "
                f"noise is bigger than any trend.{fit}")
    head = (f"{name} tilts {fmt(t.rate_per_decade)} {per}, but the two tests do not both clear the 0.05 line "
            f"(t-test p {pt}, Mann-Kendall p {pmk}), and the 95% range ({lo} to {hi}) is too wide to rule out a change "
            f"bigger than the 'too small to matter' band of plus or minus {band:g}. Read: not clear yet. The "
            f"{t.n}-year record is long enough to test; the year-to-year wobble hides the answer.")
    if t.years_needed is None:
        return (head + " The tilt so far is smaller than what matters, so no count of extra years is given: "
                f"more years would show whether a change that matters is hiding in the wobble.{fit}")
    need = "more than 50" if t.years_needed > 50 else f"about {t.years_needed}"
    return head + f" If the tilt and the wobble stay the same, {need} more years would settle it.{fit}"


def build(c: CasePack) -> list[dict]:
    out = []
    for cid in _cards(c):
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
        group = ("not" if t.stamp != "significant" else
                 "robust" if lamp is not None and lamp.stamp == "significant" else "elnino")
        line = None
        if b is not None and t.stamp != "record_too_short":
            line = [[first, round(a + b * first, 4)], [last, round(a + b * last, 4)]]
            if group == "robust":   # only a trend that survives every check is drawn forward (an illustration)
                line.append([last + EXTEND, round(a + b * (last + EXTEND), 4)])
        out.append({
            "card_id": cid, "group": group, "group_text": GROUP_TEXT[group], "name": card.name, "definition": card.definition, "unit": card.unit,
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
                "after_elnino_t_p": fmt(lamp.t_test_p, p=True) if lamp else None,
                "after_elnino_mk_p": fmt(lamp.mann_kendall_p, p=True) if lamp else None,
                "after_elnino_t_p_raw": lamp.t_test_p if lamp else None,
                "after_elnino_mk_p_raw": lamp.mann_kendall_p if lamp else None,
                "band": f"{card.band:g}", "years_needed": ("more than 50" if (t.years_needed or 0) > 50 else t.years_needed),
            },
            "stamp": t.stamp, "stamp_text": STAMP[t.stamp], "direction": t.direction,
            "significant": t.stamp == "significant",
            "caption": caption(card.name, card.unit, t, lamp, first, last, r2, card.band),
        })
    rank = {"robust": 0, "elnino": 1, "not": 2}
    out.sort(key=lambda i: (rank[i["group"]], i["metrics"]["t_test_p_raw"] if i["metrics"]["t_test_p_raw"] is not None else 2))
    return out


def facts(c: CasePack, items: list[dict]) -> str:
    """The Reporter's only source for the exemplar: the case and the code's statistics, nothing about
    the student (no nickname, verdict, marks or badges). The number guard allows only figures in here."""
    lines = [
        f"Case {c.id}: {c.title}. Question: {c.question}",
        f"Brief: {c.brief}",
        f"Region: {c.region.name}" + (f"; a second region for comparison: {c.twin_region.name}" if c.twin_region else "") + ".",
        "Records analysed: " + "; ".join(f"{i['name']} ({i['mission']}, {i['yearly_label']})" for i in items) + ".",
        "Tests run on every record: linear regression with a t-test, the Mann-Kendall rank test with Sen's slope, "
        "R² of the line, and the same tests again with the El Nino effect removed.",
    ]
    for i in items:
        m = i["metrics"]
        lines.append(f"Chart {i['name']}: {i['stamp_text']} ({i['group_text']}); {m['n_years']} years {m['first']} to {m['last']}; "
                     f"rate {m['rate']} {i['unit']} per decade; 95% range {m['range'][0] if m['range'] else '?'} to "
                     f"{m['range'][1] if m['range'] else '?'}; t-test p {m['t_test_p']}; Mann-Kendall p {m['mann_kendall_p']}; "
                     f"Sen's slope {m['sen']}; R² {m['r2']}; correlation with El Nino {m['elnino_r']}; "
                     f"after El Nino removal {m['after_elnino']} (t-test p {m['after_elnino_t_p']}, Mann-Kendall p {m['after_elnino_mk_p']}); "
                     f"years needed {m['years_needed']}.")
    lines.append("Limits: " + " ".join(c.limits))
    return "\n".join(lines)
