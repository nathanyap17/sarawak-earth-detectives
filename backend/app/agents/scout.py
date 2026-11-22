"""The case desk (MASTER_SHEET §5.7): SCOUT -> QUALIFY -> BUILD -> REVIEW.

  SCOUT    code reads the news feeds (headline, link, date, summary: nothing else is kept) and
           checks the vault for unusual readings.
  QUALIFY  code runs a checklist (is it a physical event we hold checked records for, in a region
           we hold data for, and not already a case?). The Scout agent (Gemini) then reads the
           few that pass and sets aside anything that is not a real event or not fit for students.
  BUILD    the Case Builder agent (Gemini) writes the title and the client's brief from the
           headline only; code guards its numbers and blocks any stated result. Code picks the
           evidence cards, the hint ladder and the limits from approved templates, and code
           computes the answer key (rule 1). The draft is saved with status "draft".
  REVIEW   a human editor approves or rejects it (rule 4). Only then do students see it.

Runs weekly from Cloud Scheduler (POST /admin/scout/run), never during a student's request.
AI-assisted: written with Claude Code."""
from __future__ import annotations

import html
import json
import logging
import re
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse

import httpx

from app import casework, docs
from app.agents import activity, guard
from app.agents.runtime import run_once
from app.config import get_settings
from app.schemas import CasePack, Hints, Region, Scene, Source
from app.vault import store as vault
from app.vault.cards import CARDS, provisional_for

log = logging.getLogger("scout")
UA = "SarawakEarthDetectives-Scout/1.0 (student project; reads RSS headlines weekly)"
MAX_FEED_BYTES = 2_000_000
MAX_AGE_DAYS = 21


@dataclass
class Headline:
    title: str
    url: str
    date: str  # YYYY-MM-DD
    source: str
    summary: str
    year: int | None = None  # set when the data desk raised it: the year of the unusual reading

    @property
    def event_year(self) -> int:
        return self.year or int(self.date[:4])


# ------------------------------------------------------------------ SCOUT: read the feeds
def _clean(s: str | None, n: int) -> str:
    s = html.unescape(re.sub(r"<[^>]+>", " ", s or ""))
    return re.sub(r"\s+", " ", s).strip()[:n]


def parse_feed(xml_text: str, fallback_source: str) -> list[Headline]:
    root = ET.fromstring(xml_text)
    source = _clean(root.findtext("channel/title"), 60) or fallback_source
    out = []
    for it in root.iter("item"):
        title, link = _clean(it.findtext("title"), 200), (it.findtext("link") or "").strip()
        if not title or not link.startswith("http"):
            continue
        try:
            d = parsedate_to_datetime(it.findtext("pubDate") or "").date()
        except (TypeError, ValueError):
            d = date.today()
        out.append(Headline(title, link, d.isoformat(), source, _clean(it.findtext("description"), 320)))
    return out


def fetch_headlines(feeds: list[str]) -> tuple[list[Headline], list[str]]:
    heads, failed = [], []
    for url in feeds:
        try:
            r = httpx.get(url, timeout=20, headers={"User-Agent": UA}, follow_redirects=True)
            r.raise_for_status()
            heads += parse_feed(r.text[:MAX_FEED_BYTES], urlparse(url).netloc)
        except Exception as e:  # one feed down must not stop the run
            log.warning("feed %s failed: %s", url, type(e).__name__)
            failed.append(urlparse(url).netloc)
    cutoff = (date.today() - timedelta(days=MAX_AGE_DAYS)).isoformat()
    seen, fresh = set(), []
    for h in heads:
        if h.date >= cutoff and h.url not in seen:
            seen.add(h.url)
            fresh.append(h)
    return fresh, failed


# ------------------------------------------------------------------ SCOUT: watch the data
def data_watch() -> dict:
    """Code only: is the last full year unusual against 1991-2020, in the direction that is worse?"""
    idx = vault.load_index()
    checked, unusual, as_of = 0, [], ""
    for rid, reg in idx.get("regions", {}).items():
        for cid, card in CARDS.items():
            if provisional_for(card, rid) or not card.worse_when:
                continue
            try:
                ser = vault.load_series(rid, cid)
            except FileNotFoundError:
                continue
            y = vault.yearly_series(ser)
            base = y[(y.index >= 1991) & (y.index <= 2020)]
            if len(base) < 20 or base.std() == 0:
                continue
            checked += 1
            as_of = max(as_of, ser.data_as_of)
            z = float((y.iloc[-1] - base.mean()) / base.std())
            if (z >= 1.5 and card.worse_when == "rising") or (z <= -1.5 and card.worse_when == "falling"):
                unusual.append({"region": reg["name"], "region_id": rid, "card_id": cid, "card": card.name, "year": int(y.index[-1]),
                                "z": round(z, 1), "side": "above" if z > 0 else "below"})
    unusual.sort(key=lambda u: -abs(u["z"]))
    stale = bool(as_of) and (date.today() - date.fromisoformat(as_of)).days > 30
    return {"checked": checked, "regions": len(idx.get("regions", {})), "unusual": unusual,
            "data_as_of": as_of, "stale": stale}


# ------------------------------------------------------------------ QUALIFY: the checklist (code)
TYPES: list[tuple[str, re.Pattern]] = [(t, re.compile(p, re.I)) for t, p in [
    ("fire", r"\b(peat\s?fires?|bush\s?fires?|forest fires?|wild\s?fires?|open burning|hotspots?|kebakaran (hutan|belukar|tanah gambut))\b"),
    ("haze", r"\b(haze|hazy|jerebu|air pollutant index|air quality|unhealthy api)\b"),
    ("dry", r"\b(drought|dry spell|dry season|water shortage|water rationing|water crisis|kemarau)\b"),
    ("heat", r"\b(heat\s?wave|hot weather|hot spell|extreme heat|heat stroke|gelombang haba|cuaca panas)\b"),
    ("flood", (r"\b(floods?|flooded|flooding|flash floods?|banjir|inundated|water levels?|heavy rain|downpours?|torrential|"
               r"continuous rain|hujan lebat|landslides?|tanah runtuh)\b")),
]]
PLACES = {
    "north-peat": r"\b(miri|bintulu|tatau|marudi|niah|sebauh|subis|beluru|baram|lambir|bekenu|suai|kuala baram|northern sarawak)\b",
    "south-west": r"\b(kuching|samarahan|serian|bau|lundu|padawan|siburan|asajaya|tebedu|southern sarawak)\b",
}
# What each kind of case tests. Main cards must be checked (non-provisional) records.
TEMPLATES: dict[str, dict] = {
    "fire": {"evidence": ["soil_dry3", "humidity_feb_apr", "rain_feb_apr", "dry_spell", "wind"],
             "main": ["soil_dry3", "humidity_feb_apr"], "herring": ["wind"],
             "question": "Are fire seasons in {place} getting worse, or was {year} one bad year?",
             "thing": "the weather that dries the ground out"},
    "haze": {"evidence": ["soil_dry3", "humidity_feb_apr", "dry_spell", "temp_mean", "wind"],
             "main": ["soil_dry3", "humidity_feb_apr"], "herring": ["wind"],
             "question": "Is the dry weather that brings haze to {place} getting worse, or was {year} one bad year?",
             "thing": "the dry weather that lets fires and haze start"},
    "dry": {"evidence": ["soil_dry3", "dry_spell", "rain_jun_sep", "hot_days", "wind"],
            "main": ["soil_dry3", "hot_days"], "herring": ["wind"],
            "question": "Are dry times in {place} getting worse, or was {year} one bad year?",
            "thing": "how dry the ground gets"},
    "heat": {"evidence": ["hot_days", "hot_nights", "temp_mean", "humidity_feb_apr", "wind"],
             "main": ["hot_days", "hot_nights"], "herring": ["wind"],
             "question": "Are hot days and hot nights in {place} becoming more common, or was {year} one hot year?",
             "thing": "how often it gets very hot"},
    "flood": {"evidence": ["rain_nov_feb", "soil_wet3", "heavy_rain_days", "wettest_5day", "wind"],
              "main": ["rain_nov_feb", "soil_wet3"], "herring": ["wind"],
              "question": "Are wet seasons in {place} getting wetter, or was this just one wet spell?",
              "thing": "how much rain the wet season brings"},
}


def can_build(kind: str, region_id: str) -> str:
    """Can the records we hold for this region decide this kind of case? '' when they can, else why not.
    Code checks every main record: it must be in the vault for the region and checked (not provisional)."""
    held = vault.load_index().get("regions", {}).get(region_id, {}).get("cards", {})
    for cid in TEMPLATES[kind]["main"]:
        if cid not in held:
            return f"no {CARDS[cid].name.lower()} record for that region yet"
        if provisional_for(CARDS[cid], region_id):
            return f"the {CARDS[cid].name.lower()} record for that region has not passed its cross-check"
    return ""
EVIDENCE_EXAMPLE = {
    "flood": "Example: for a made-up heat case, a detective would pick hot days, not rain.",
    "default": "Example: for a made-up flood case, a detective would pick heavy-rain days, not air temperature.",
}
HINTS = Hints(
    evidence=["What has to change in the air or the ground before this can happen?",
              "Look for cards that measure that change directly. One card in the locker does not belong.",
              EVIDENCE_EXAMPLE["default"]],
    method=["Some months are always wetter or hotter than others. Could that fool your ruler?",
            "Try the season filter first, then the scales. And ask: was El Nino strong in the bad years?",
            "Example: a made-up record rises only in El Nino years. With the El Nino lamp on, the rise disappears, so the trend wasn't real."],
    verdict=["Did both tests agree on every main card, with and without the El Nino lamp?",
             "If the lamp changes the stamp, think about what 'Can't tell' means.",
             "Example: in a made-up heat case, hot days rose on both tests and still rose with the El Nino lamp on, so that detective wrote 'worsening, and it is real'. Your verdict must follow your own stamps in the same way, whatever they say."])
LIMITS = [
    "This case was drafted by the agency's Scout and Case Builder from a news headline, then checked and approved by a human editor.",
    "The records come from a weather model (MERRA-2) checked against observations, not from a sensor on the ground.",
    "Each value is an average over grid squares about 50 km wide, not one village.",
    "A trend in the weather is not proof of what caused the event; people, land use and drainage matter too.",
]


FLOOD_LIMIT = ("Rain is a stand-in for floods: rivers, tides, drains and how the land is used decide whether "
               "heavy rain becomes a flood.")


def hints_for(kind: str) -> Hints:
    ev = list(HINTS.evidence)
    ev[2] = EVIDENCE_EXAMPLE.get(kind, EVIDENCE_EXAMPLE["default"])
    return HINTS.model_copy(update={"evidence": ev})


def limits_for(kind: str) -> list[str]:
    return LIMITS[:3] + [FLOOD_LIMIT] + LIMITS[3:] if kind == "flood" else list(LIMITS)


# A reading far from normal can open a case too (a "data-triggered" case), when the news is quiet.
DATA_CASE = {"hot_days": "heat", "hot_nights": "heat", "temp_mean": "heat", "soil_dry3": "dry",
             "rain_nov_feb": "flood", "soil_wet3": "flood"}


def data_headline(u: dict, as_of: str) -> Headline:
    """The data desk's flag, shaped like a headline so the same builder can use it."""
    side = "high" if u["side"] == "above" else "low"
    return Headline(
        title=f"NASA record for {_short(u['region'])}: {u['card'].lower()}, {u['year']} was unusually {side}",
        url="https://power.larc.nasa.gov/", date=as_of, source="NASA POWER (MERRA-2), flagged by the agency's data desk",
        summary=f"The last full year, {u['year']}, was far {u['side']} the normal for 1991 to 2020.", year=u["year"])


def classify(h: Headline) -> tuple[str | None, str | None, str]:
    """(type, region_id, reason it was set aside or '')."""
    text = f"{h.title}. {h.summary}"
    kind = next((t for t, rx in TYPES if rx.search(text)), None)
    if not kind:
        return None, None, "not a weather or land event"
    if not re.search(r"\bsarawak\b", text, re.I) and not any(re.search(p, text, re.I) for p in PLACES.values()):
        return kind, None, "not in Sarawak"
    if kind not in TEMPLATES:
        return kind, None, "no case template for this kind of event"
    have = set(vault.load_index().get("regions", {}))
    region = next((rid for rid, p in PLACES.items() if rid in have and re.search(p, h.title, re.I)), None) \
        or next((rid for rid, p in PLACES.items() if rid in have and re.search(p, text, re.I)), None)
    if not region:
        return kind, None, "no region we hold records for"
    if why := can_build(kind, region):
        return kind, None, why
    return kind, region, ""


# ------------------------------------------------------------------ QUALIFY: the Scout agent (AI)
SCOUT_INSTRUCTION = """You are the Scout of Sarawak Earth Detectives, a science game for students aged 10 to 15.
You are given numbered news items. For each one decide whether it reports a real weather or land
event that actually happened in Sarawak (a fire, haze, a dry spell, a heat wave, a flood or heavy rain) that students
could investigate with climate records. Say keep=false for politics, funding announcements,
court cases, opinion pieces, events outside Sarawak, or items that dwell on deaths or injuries.
Reply with JSON only: [{"i": 0, "keep": true, "why": "at most twelve words"}]"""


async def ai_screen(cands: list[tuple[Headline, str, str]]) -> tuple[list[bool], str]:
    """Which candidates the Scout agent keeps. On any failure every candidate is kept: a human
    reviews each draft anyway (rule 4)."""
    prompt = "\n".join(f"{i}. [{k}] {h.title} :: {h.summary}" for i, (h, k, _) in enumerate(cands))
    text, _, err = await run_once("scout", SCOUT_INSTRUCTION, prompt, timeout=45, max_tokens=600, as_json=True)
    if text is None:
        return [True] * len(cands), f"skipped ({err})"
    try:
        rows = json.loads(text)
        keep = [True] * len(cands)
        for r in rows:
            if isinstance(r, dict) and isinstance(r.get("i"), int) and 0 <= r["i"] < len(cands):
                keep[r["i"]] = bool(r.get("keep"))
        return keep, "ok"
    except (ValueError, TypeError):
        return [True] * len(cands), "skipped (reply was not valid JSON)"


# ------------------------------------------------------------------ BUILD
BUILDER_INSTRUCTION = """You are the Case Builder of Sarawak Earth Detectives. From one news item, write a case
for a student detective aged 10 to 15. Reply with JSON only:
{"title": "The ... (two to four words, like a detective story)",
 "brief": "three or four short sentences spoken by the Client, starting with 'Detective, we have a case.'"}
Rules: use only facts from the NEWS ITEM. Do not write any number that is not in the NEWS ITEM.
Do not say whether things are getting worse or better, or whether a trend is real: that is what
the detective must find out. End the brief by asking the QUESTION in your own words. Plain words."""


def _short(name: str) -> str:
    return re.sub(r"\s*\(.*\)", "", name).replace("Northern", "northern").replace("Southern", "southern")


def _fallback_text(h: Headline, kind: str, place: str, question: str) -> tuple[str, str]:
    used = {c.title for c in casework.list_cases(status=None)}
    options = {"fire": ["The Smouldering Ground", "The Ember Trail"], "haze": ["The Grey Sky", "The Missing Horizon"],
               "dry": ["The Empty Tank", "The Cracked Field"], "heat": ["The Long Hot Night", "The Restless Heat"],
               "flood": ["The Rising Water", "The Swollen River"]}[kind]
    title = next((t for t in options if t not in used), f"{options[0]}: {place}")
    if h.year:  # raised by the data desk, not by the news
        brief = (f"Detective, we have a case. The agency's data desk has flagged something in the NASA record "
                 f"for {place}: {h.event_year} was far from normal. Before anyone decides what that means, "
                 f"I need you to look at the whole record. {question}")
    else:
        brief = (f"Detective, we have a case. On {h.date} the news reported: “{h.title}”. "
                 f"People in {place} are asking whether this is the new normal. Before anyone decides, "
                 f"I need you to look at the record. {question}")
    return title, brief


async def write_text(h: Headline, kind: str, place: str, question: str) -> tuple[str, str, str]:
    """(title, brief, who wrote it). The agent's text is used only if it passes the guards."""
    fb_title, fb_brief = _fallback_text(h, kind, place, question)
    news = f"{h.title}. {h.summary} (reported {h.date})"
    prompt = f"NEWS ITEM: {news}\nPLACE: {place}\nQUESTION: {question}"
    text, err = None, ""
    for _ in range(2):  # an offline job can afford one retry (the model's first call is slow)
        text, _, err = await run_once("builder", BUILDER_INSTRUCTION, prompt, timeout=45, max_tokens=500, as_json=True)
        if text is not None:
            break
    if text is None:
        return fb_title, fb_brief, f"code template ({err})"
    try:
        j = json.loads(text)
        title, brief = str(j["title"]).strip(), str(j["brief"]).strip()
    except (ValueError, KeyError, TypeError):
        return fb_title, fb_brief, "code template (reply was not valid JSON)"
    if not (3 <= len(title) <= 48) or not (80 <= len(brief) <= 700):
        return fb_title, fb_brief, "code template (wrong length)"
    if title in {c.title for c in casework.list_cases(status=None)}:
        title = fb_title
    for chk in (guard.check_numbers(f"{title} {brief}", prompt), guard.check_answer(brief, prompt)):
        if not chk.ok:
            return fb_title, fb_brief, f"code template (guard: {chk.reason})"
    return title, brief, "ai"


def _next_id() -> str:
    nums = [int(c.id) for c in casework.list_cases(status=None) if c.id.isdigit()]
    return f"{max(nums, default=0) + 1:03d}"


def assemble(h: Headline, kind: str, region_id: str, title: str, brief: str, case_id: str) -> CasePack:
    idx = vault.load_index()["regions"]

    def region(rid: str) -> Region:
        w, s, e, n = idx[rid]["bbox"]
        return Region(id=rid, name=idx[rid]["name"], bbox=(w, s, e, n),
                      centroid=(round((w + e) / 2, 3), round((s + n) / 2, 3)))

    t = TEMPLATES[kind]
    twin = next((rid for rid in idx if rid != region_id), None)
    d = date.fromisoformat(h.date)
    as_of = next(iter(idx[region_id]["cards"].values()))["data_as_of"]
    return CasePack(
        id=case_id, title=title, type=kind, status="draft",
        question=t["question"].format(place=_short(idx[region_id]["name"]), year=h.event_year), brief=brief,
        sources=[Source(title=f"{h.title} ({h.source})"[:200], url=h.url, date=h.date)],
        region=region(region_id), twin_region=region(twin) if twin else None,
        scene=Scene(layers=[], **{"from": (d - timedelta(days=30)).isoformat(), "to": h.date}),
        evidence=t["evidence"], red_herrings=t["herring"], main_cards=t["main"],
        hints=hints_for(kind), limits=limits_for(kind), data_as_of=as_of)


def save_draft(pack: CasePack) -> str:
    """Store the draft and its code-computed answer key. Returns the key's overall verdict."""
    key = casework.build_answer_key_for(pack)
    docs.store().put("cases", pack.id, pack.model_dump(by_alias=True))
    docs.store().put("answer_keys", pack.id, key.model_dump())
    casework.forget(pack.id)
    return key.overall


# ------------------------------------------------------------------ the weekly run
def _tally(reasons: list[str]) -> str:
    counts: dict[str, int] = {}
    for r in reasons:
        counts[r] = counts.get(r, 0) + 1
    return "; ".join(f"{n} {r}" for r, n in sorted(counts.items(), key=lambda x: -x[1]))


async def run(headlines: list[Headline] | None = None, from_editor: bool = False) -> dict:
    """One full pass. `headlines` lets tests (and a dry run) skip the network; `from_editor` is a
    report a human editor handed in, so the data desk does not add cases of its own to that run."""
    st = get_settings()
    started = datetime.now(timezone.utc)

    # SCOUT: data
    w = data_watch()
    line = f"Checked {w['checked']} NASA records across {w['regions']} regions (data to {w['data_as_of']})."
    if w["unusual"]:
        u = w["unusual"][0]
        line += (f" Unusual: {u['card']} in {u['region']} was {abs(u['z'])} standard deviations {u['side']} "
                 f"normal in {u['year']}" + (f", and {len(w['unusual']) - 1} more." if len(w["unusual"]) > 1 else "."))
    else:
        line += " Nothing unusual in the last full year."
    if w["stale"]:
        line += " The data is more than 30 days old: a refresh is due."
    activity.record("Data desk", "code", line, "data")

    # SCOUT: news
    failed: list[str] = []
    if headlines is None:
        feeds = [f.strip() for f in st.scout_feeds.split(",") if f.strip()]
        headlines, failed = fetch_headlines(feeds)
        activity.record("Scout", "code", f"Read {len(headlines)} headlines from {len(feeds) - len(failed)} news feeds"
                        + (f" ({len(failed)} feed did not answer)." if failed else "."), "news")
    elif from_editor:
        activity.record("Scout", "code", f"A human editor handed in {len(headlines)} news report"
                        f"{'s' if len(headlines) != 1 else ''} to check.", "news")
    else:
        activity.record("Scout", "code", f"Read {len(headlines)} headlines handed to it for a test run.", "news")

    # QUALIFY: checklist in code
    existing = {(c.type, c.region.id) for c in casework.list_cases(status=None) if c.status != "closed"}
    cands, reasons = [], []
    for h in headlines:
        kind, region, why = classify(h)
        if not why and (kind, region) in existing:
            why = "already a case on our shelf"
        if why:
            reasons.append(why)
        elif not any(k == kind and r == region for _, k, r in cands):
            cands.append((h, kind, region))
        else:
            reasons.append("same event as another headline")
    activity.record("Scout", "code", f"Checklist: {len(cands)} of {len(headlines)} headlines could become a case."
                    + (f" Set aside: {_tally(reasons)}." if reasons else ""), "qualify")

    # QUALIFY: the Scout agent reads the few that passed
    kept = list(cands)
    if cands:
        keep, how = await ai_screen(cands[:8])
        kept = [c for c, k in zip(cands[:8], keep) if k]
        activity.record("Scout", "ai" if how == "ok" else "code",
                        (f"Read the {len(cands[:8])} that passed and kept {len(kept)} as real events fit for students."
                         if how == "ok" else f"AI check {how}; all {len(kept)} go to the human editor."), "qualify")

    # When the news is quiet, an unusual reading can open a case instead (code decides, not AI)
    from_data = 0
    for u in ([] if from_editor else w["unusual"]):
        kind = DATA_CASE.get(u["card_id"])
        taken = existing | {(k, r) for _, k, r in kept}
        if len(kept) >= st.scout_max_drafts or not kind or (kind, u["region_id"]) in taken:
            continue
        kept.append((data_headline(u, w["data_as_of"]), kind, u["region_id"]))
        from_data += 1
    if from_data:
        activity.record("Data desk", "code", f"The news was quiet, so {from_data} unusual "
                        f"reading{'s' if from_data > 1 else ''} in the NASA record went to the Case Builder instead.", "data")

    # BUILD
    drafted = []
    for h, kind, region in kept[: st.scout_max_drafts]:
        idx = vault.load_index()["regions"][region]
        t = TEMPLATES[kind]
        question = t["question"].format(place=_short(idx["name"]), year=h.event_year)
        title, brief, who = await write_text(h, kind, _short(idx["name"]), question)
        pack = assemble(h, kind, region, title, brief, _next_id())
        try:
            save_draft(pack)
        except Exception as e:
            activity.record("Case Builder", "code", f"Could not build a {kind} case for {idx['name']}: {type(e).__name__}.", "build")
            continue
        drafted.append({"id": pack.id, "type": kind, "region": region, "text_by": who})
        activity.record("Case Builder", "ai" if who == "ai" else "code",
                        f"Drafted case {pack.id}: a {kind} case for {idx['name']}. "
                        + ("The brief was written by AI and passed the number guard and the answer guard. "
                           if who == "ai" else "The brief came from the approved template. ")
                        + f"Picked {len(pack.evidence)} evidence cards.", "build")
        activity.record("Grader", "code", f"Computed the answer key for case {pack.id} from "
                        f"{len(pack.main_cards)} main records with the t-test, Mann-Kendall and the El Nino check. "
                        "It stays on the server.", "key")
        activity.record("Editor", "human", f"Case {pack.id} is waiting for a human editor. Students cannot see it yet.", "review")
    if not drafted:
        activity.record("Case Builder", "code", "No new case this run. The shelf stays as it is.", "build")

    return {"started": started.isoformat(timespec="seconds"), "headlines": len(headlines), "feeds_failed": failed,
            "candidates": len(cands), "kept": len(kept), "drafted": drafted, "set_aside": _tally(reasons),
            "data_watch": w}


def headline_dicts(hs: list[Headline]) -> list[dict]:
    return [asdict(h) for h in hs]
