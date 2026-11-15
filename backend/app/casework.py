"""Case packs, public views and the desk tools (code only: rule 1).

The AnswerKey is computed here and written to the vault. It is never returned by a route
and never given to the Partner (rules 2 and 3).
AI-assisted: written with Claude Code."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from functools import lru_cache

import pandas as pd

from app.analysis import trend
from app.config import get_settings
from app.schemas import (AnalysisResult, AnswerKey, CardKey, CasePack, CasePublic, EvidenceCard,
                         MonthlyPoint, YearlyPoint)
from app.vault import enso, store
from app.vault.cards import CARDS, CardDef


# ---------------------------------------------------------------- case packs
@lru_cache(maxsize=64)
def load_case(case_id: str) -> CasePack:
    p = get_settings().cases_dir / f"{case_id}.json"
    if not p.exists():
        raise KeyError(case_id)
    return CasePack.model_validate_json(p.read_text(encoding="utf-8"))


def list_cases(status: str | None = "open") -> list[CasePack]:
    out = []
    for p in sorted(get_settings().cases_dir.glob("*.json")):
        c = load_case(p.stem)
        if status is None or c.status == status:
            out.append(c)
    return out


def public_card(card: CardDef) -> EvidenceCard:
    return EvidenceCard(id=card.id, name=card.name, definition=card.definition,
                        mission=card.mission, unit=card.unit, yearly_label=card.yearly_label,
                        **{"from": card.from_year}, grid_km=card.grid_km,
                        provisional=card.provisional)


def public_case(c: CasePack) -> CasePublic:
    return CasePublic(
        id=c.id, title=c.title, type=c.type, status=c.status, question=c.question,
        brief=c.brief, sources=c.sources, region=c.region, twin_region=c.twin_region,
        scene=c.scene, evidence=[public_card(CARDS[i]) for i in c.evidence],
        limits=c.limits, data_as_of=c.data_as_of)


# ---------------------------------------------------------------- desk tools
def _pts(y: pd.Series) -> list[YearlyPoint]:
    return [YearlyPoint(y=int(k), v=round(float(v), 4)) for k, v in y.items()]


def _r(x: float | None, nd: int = 4) -> float | None:
    return None if x is None else round(float(x), nd)


def _from_test(base: dict, t: trend.TrendTest) -> dict:
    return {**base, "n_years": t.n, "rate_per_decade": _r(t.rate_per_decade),
            "range": None if t.range is None else (_r(t.range[0]), _r(t.range[1])),
            "t_test_p": _r(t.t_test_p), "mann_kendall_p": _r(t.mann_kendall_p),
            "sen_per_decade": _r(t.sen_per_decade), "stamp": t.stamp,
            "direction": t.direction, "years_needed": t.years_needed}


def enso_for(card: CardDef) -> pd.Series:
    return enso.for_months(store.load_roni(), card.months)


def run_tool(card_id: str, region_id: str, tool: str, options: dict | None = None
             ) -> AnalysisResult:
    """Run one desk tool on one record. Every number returned is computed here."""
    options = options or {}
    card = CARDS[card_id]
    ser = store.load_series(region_id, card_id)
    yearly = store.yearly_series(ser)
    base = {"card_id": card_id, "region_id": region_id, "tool": tool, "mission": card.mission,
            "data_as_of": ser.data_as_of, "unit": f"{card.unit} per decade"}

    if tool == "magnifier":
        return AnalysisResult(**base, n_years=len(yearly), series_out=_pts(yearly))
    if tool == "season":
        anom = trend.season_filter(store.monthly_series(ser)).dropna()
        return AnalysisResult(**base, n_years=len(yearly), series_out=_pts(yearly), monthly_out=[
            MonthlyPoint(t=t.strftime("%Y-%m"), v=round(float(v), 4)) for t, v in anom.items()])
    if tool == "ruler":
        if len(yearly) < trend.MIN_YEARS:
            return AnalysisResult(**base, n_years=len(yearly), stamp="record_too_short")
        rate, rng, _ = trend.ruler(yearly)
        return AnalysisResult(**base, n_years=len(yearly), rate_per_decade=_r(rate),
                              range=(_r(rng[0]), _r(rng[1])),
                              direction="rising" if rate > 0 else "falling",
                              series_out=_pts(yearly))
    if tool == "scales":
        return AnalysisResult(**_from_test(base, trend.scales(yearly, card.band)),
                              series_out=_pts(yearly))
    if tool == "elnino":
        e = enso_for(card)
        adj = trend.elnino_lamp(yearly, e)
        return AnalysisResult(**_from_test(base, trend.scales(adj, card.band)),
                              elnino_r=_r(trend.elnino_correlation(yearly, e), 3),
                              series_out=_pts(adj))
    if tool == "twin":
        region_b = options.get("region_b")
        if not region_b:
            raise ValueError("twin needs options.region_b")
        a = trend.scales(yearly, card.band)
        yb = store.yearly_series(store.load_series(region_b, card_id))
        b = trend.scales(yb, card.band)
        twin_res = AnalysisResult(**_from_test({**base, "region_id": region_b}, b),
                                  series_out=_pts(yb))
        return AnalysisResult(**_from_test(base, a), series_out=_pts(yearly),
                              opposite_trends=trend.twin(a, b), twin=twin_res)
    raise ValueError(f"unknown tool {tool}")


# ---------------------------------------------------------------- workbench (learning tools)
def _wb_base(card_id: str, region_id: str):
    card = CARDS[card_id]
    ser = store.load_series(region_id, card_id)
    return store.yearly_series(ser), {"card_id": card_id, "mission": card.mission,
                                      "data_as_of": ser.data_as_of, "unit": f"{card.unit} per decade"}


def run_my_line(card_id: str, region_id: str, rate_per_decade: float, level: float) -> dict:
    yearly, base = _wb_base(card_id, region_id)
    r = trend.my_line(yearly, rate_per_decade, level)
    return {**base, **{k: (_r(v) if isinstance(v, float) else v) for k, v in r.items()}}


def run_shuffle(card_id: str, region_id: str) -> dict:
    yearly, base = _wb_base(card_id, region_id)
    r = trend.shuffle_test(yearly)
    return {**base, **r, "real_rate_per_decade": _r(r["real_rate_per_decade"]),
            "edges": [_r(e) for e in r["edges"]]}


# ---------------------------------------------------------------- answer key
def build_answer_key(case_id: str) -> AnswerKey:
    c = load_case(case_id)
    bad = [m for m in c.main_cards if CARDS[m].provisional]
    if bad:
        raise ValueError(f"provisional cards cannot be main cards: {bad}")
    per_card, outcomes = {}, []
    for cid in c.evidence:
        if cid in c.red_herrings:
            continue
        card = CARDS[cid]
        y = store.yearly_series(store.load_series(c.region.id, cid))
        t = trend.scales(y, card.band)
        lamp = trend.scales(trend.elnino_lamp(y, enso_for(card)), card.band)
        per_card[cid] = CardKey(direction=t.direction, stamp=t.stamp,
                                rate_per_decade=_r(t.rate_per_decade) or 0.0,
                                range=t.range or (0.0, 0.0), elnino_stamp=lamp.stamp)
        if cid in c.main_cards:
            outcomes.append(trend.card_outcome(t, card.worse_when, lamp))
    return AnswerKey(case_id=case_id, per_card=per_card,
                     overall=trend.overall_verdict(outcomes),
                     computed_at=datetime.now(timezone.utc).isoformat(timespec="seconds"))


def write_answer_key(case_id: str) -> AnswerKey:
    key = build_answer_key(case_id)
    d = store.root() / "answer_keys"
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{case_id}.json").write_text(key.model_dump_json(indent=1), encoding="utf-8")
    return key


if __name__ == "__main__":  # uv run python -m app.casework  -> rebuild all answer keys
    for case in list_cases(status=None):
        k = write_answer_key(case.id)
        print(case.id, k.overall, json.dumps({i: (v.stamp, v.elnino_stamp)
                                              for i, v in k.per_card.items()}))
