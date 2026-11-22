"""Case packs, public views and the desk tools (code only: rule 1).

The AnswerKey is computed here and written to the vault. It is never returned by a route
and never given to the Partner (rules 2 and 3).
AI-assisted: written with Claude Code."""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from functools import lru_cache

import pandas as pd

from app import docs
from app.analysis import trend
from app.config import get_settings
from app.schemas import (AnalysisResult, AnswerKey, CardKey, CasePack, CasePublic, EvidenceCard,
                         MonthlyPoint, YearlyPoint)
from app.vault import enso, store
from app.vault.cards import CARDS, RAIN_CHECK_NOTE, RAIN_PROVISIONAL, CardDef, provisional_for


# ---------------------------------------------------------------- case packs
@lru_cache(maxsize=64)
def _file_case(case_id: str) -> CasePack | None:
    p = get_settings().cases_dir / f"{case_id}.json"
    return CasePack.model_validate_json(p.read_text(encoding="utf-8")) if p.exists() else None


_dyn: dict[str, tuple[float, CasePack | None]] = {}  # cases written by the case desk, cached briefly
_dyn_all: list = [0.0, []]
TTL = 30.0


def forget(case_id: str | None = None) -> None:
    """Drop cached desk cases after one is drafted, approved or rejected."""
    _dyn.clear()
    _dyn_all[0] = 0.0


def load_case(case_id: str) -> CasePack:
    """Hand-made cases live in cases/*.json; cases from the Scout live in the document store."""
    c = _file_case(case_id) if case_id.replace("-", "").replace("_", "").isalnum() else None
    if c:
        return c
    hit = _dyn.get(case_id)
    if not hit or time.monotonic() - hit[0] > TTL:
        d = docs.store().get("cases", case_id)
        hit = (time.monotonic(), CasePack.model_validate(d) if d else None)
        _dyn[case_id] = hit
    if hit[1] is None:
        raise KeyError(case_id)
    return hit[1]


def _desk_cases() -> list[CasePack]:
    if _dyn_all[0] == 0.0 or time.monotonic() - _dyn_all[0] > TTL:
        _dyn_all[1] = [CasePack.model_validate(d) for d in docs.store().all("cases")]
        _dyn_all[0] = time.monotonic()
    return _dyn_all[1]


def list_cases(status: str | None = "open") -> list[CasePack]:
    files = [load_case(p.stem) for p in sorted(get_settings().cases_dir.glob("*.json"))]
    have = {c.id for c in files}
    out = files + [c for c in _desk_cases() if c.id not in have]
    return sorted((c for c in out if status is None or c.status == status), key=lambda c: c.id)


def public_card(card: CardDef, region_id: str | None = None) -> EvidenceCard:
    caveat = provisional_for(card, region_id)
    # a rain record that passed EXP-11 here says what it was checked against
    checked = card.provisional == RAIN_PROVISIONAL and caveat is None
    return EvidenceCard(id=card.id, name=card.name,
                        definition=f"{card.definition} {RAIN_CHECK_NOTE}." if checked else card.definition,
                        mission=card.mission, unit=card.unit, yearly_label=card.yearly_label,
                        **{"from": card.from_year}, grid_km=card.grid_km, provisional=caveat)


def public_case(c: CasePack) -> CasePublic:
    return CasePublic(
        id=c.id, title=c.title, type=c.type, status=c.status, question=c.question,
        brief=c.brief, sources=c.sources, region=c.region, twin_region=c.twin_region,
        scene=c.scene, evidence=[public_card(CARDS[i], c.region.id) for i in c.evidence],
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
    return enso.for_months(store.load_roni(), card.months, card.wraps)


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
                              series_out=_pts(adj), enso_out=_pts(e.reindex(yearly.index).dropna()))
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
    return build_answer_key_for(load_case(case_id))


def build_answer_key_for(c: CasePack) -> AnswerKey:
    case_id = c.id
    bad = [m for m in c.main_cards if provisional_for(CARDS[m], c.region.id)]
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


def stored_key(case_id: str) -> dict | None:
    """A hand-made case's answer key as written by `python -m app.casework` (teacher's desk only)."""
    p = store.root() / "answer_keys" / f"{case_id}.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


def dataset_config(c: CasePack) -> list[dict]:
    """Every dataset a case uses, how it is configured and what the vault holds for it, for the
    teacher's desk. Roles come from the case pack: main (decides the verdict), supporting, or red
    herring (planted to be rejected)."""
    rows = []
    for cid in c.evidence:
        card = CARDS.get(cid)
        if card is None:
            rows.append({"id": cid, "name": cid, "missing": True})
            continue
        vault_rows = {}
        for region in [c.region] + ([c.twin_region] if c.twin_region else []):
            try:
                ser = store.load_series(region.id, cid)
                yrs = [p.y for p in ser.yearly if p.v is not None]
                vault_rows[region.id] = {"region": region.name, "first": min(yrs) if yrs else None,
                                         "last": max(yrs) if yrs else None, "n_years": len(yrs),
                                         "data_as_of": ser.data_as_of}
            except (FileNotFoundError, KeyError):
                vault_rows[region.id] = {"region": region.name, "missing": True}
        rows.append({
            "id": cid, "name": card.name, "definition": card.definition, "mission": card.mission,
            "unit": card.unit, "yearly_label": card.yearly_label, "from_year": card.from_year,
            "grid_km": card.grid_km, "months": [MONTHS[m - 1] for m in card.months],
            "worse_when": card.worse_when, "band_per_decade": card.band, "provisional": provisional_for(card, c.region.id),
            "role": "main" if cid in c.main_cards else "red_herring" if cid in c.red_herrings else "supporting",
            "vault": vault_rows,
        })
    return rows


def write_answer_key(case_id: str) -> AnswerKey:
    key = build_answer_key(case_id)
    d = store.root() / "answer_keys"
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{case_id}.json").write_text(key.model_dump_json(indent=1), encoding="utf-8")
    return key


if __name__ == "__main__":  # uv run python -m app.casework  -> rebuild all answer keys
    for case in list_cases(status=None):
        if _file_case(case.id) is None:
            continue  # desk cases keep their key in the document store
        k = write_answer_key(case.id)
        print(case.id, k.overall, json.dumps({i: (v.stamp, v.elnino_stamp)
                                              for i, v in k.per_card.items()}))
