"""Vault file layout and readers. Routes read only from here (rule 7: never fetch at request time).

data/vault/
  index.json                         what's available and how fresh
  daily/{region}.parquet             region-averaged daily POWER record
  series/{region}/{card}.json        Series contract (monthly, yearly, normal)
  enso/roni_monthly.json             RONI by centre month
  answer_keys/{case}.json            AnswerKey: SERVER-ONLY
AI-assisted: written with Claude Code."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import pandas as pd

from app.config import get_settings
from app.schemas import AnswerKey, Series


def root() -> Path:
    return get_settings().data_dir / "vault"


def series_path(region_id: str, card_id: str) -> Path:
    return root() / "series" / region_id / f"{card_id}.json"


@lru_cache(maxsize=256)
def load_series(region_id: str, card_id: str) -> Series:
    p = series_path(region_id, card_id)
    if not p.exists():
        raise FileNotFoundError(f"no vault series for {region_id}/{card_id}")
    return Series.model_validate_json(p.read_text(encoding="utf-8"))


def yearly_series(s: Series) -> pd.Series:
    return pd.Series({p.y: p.v for p in s.yearly}, dtype=float).dropna()


def monthly_series(s: Series) -> pd.Series:
    return pd.Series({pd.Timestamp(p.t + "-01"): p.v for p in s.monthly}, dtype=float)


@lru_cache(maxsize=1)
def load_roni() -> pd.Series:
    d = json.loads((root() / "enso" / "roni_monthly.json").read_text(encoding="utf-8"))
    return pd.Series({pd.Timestamp(k): v for k, v in d.items()}, dtype=float).sort_index()


def load_index() -> dict:
    p = root() / "index.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {"regions": {}}


def load_answer_key(case_id: str) -> AnswerKey:
    p = root() / "answer_keys" / f"{case_id}.json"
    return AnswerKey.model_validate_json(p.read_text(encoding="utf-8"))


def clear_caches() -> None:
    load_series.cache_clear()
    load_roni.cache_clear()
