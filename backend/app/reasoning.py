"""Reading the student's own words, in plain code (no model, so it is the same every time).

A verdict is more than three ticked boxes. This module checks that the written parts hold up:
  - they are real words, not "idk", a keyboard mash or text copied from the case or the hints;
  - "what" names something the case is about;
  - the student says why they took their stand on "is it real?" (a reason that fits their own stand);
  - the reasoning points at their own evidence (a record, a tool, a number);
  - the ticked boxes and the words don't contradict each other.
Every check is about the student's own stand, never about the answer key, so a sent-back student
learns what to explain better, not what the answer is.
AI-assisted: written with Claude Code."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher

from app.schemas import CasePack, ReasonCheck, Verdict
from app.vault.cards import CARDS

WORD = re.compile(r"[a-z][a-z'’-]*")
NUMBER = re.compile(r"[-+]?\d+(?:\.\d+)?")
STOP = set("""a an and are as at be been but by can could did do does for from had has have he her his how i if in
into is it its just me might my no not of on or our she so some than that the their them then there these they this
to too was we were what when where which who why will with would you your yes also very really get got lot lots thing
things stuff about because like more less much many one two maybe may""".split())

# Answers that are a way of not answering. Matched against the whole field.
NON_ANSWER = re.compile(
    r"^\W*(i\s*(do\s*n[o']?t|dont|dnt)\s*k?now|idk+|dunno|no\s*idea|not\s*sure|nothing|none|nil|n/?a|na|"
    r"whatever|random|idc|test(ing)?|lol+|ok(ay)?|yes|no|maybe|hmm+|huh|nope|yep|abc|xyz|something|anything|"
    r"same|\?+|\.+|-+|x+)\W*$", re.I)
SHRUG = re.compile(r"\b(idk|i\s*(do\s*n[o']?t|dont)\s*know|dunno|no\s*idea|whatever|random answer|just guess(ing)?)\b", re.I)
KEYBOARD = ("qwer", "wert", "asdf", "sdfg", "dfgh", "fghj", "ghjk", "hjkl", "zxcv", "xcvb", "cvbn", "vbnm", "uiop", "jkl")

# Reasons that back each stand on "is it real?"
DOUBT = re.compile(
    r"can'?t (tell|say|be sure|settle)|cannot (tell|say|be sure|settle)|not enough|too (short|few|little)|short record|"
    r"(only|just) \d+ years|few years|more (years|data|time)|needs? (more|longer)|el ?ni[nñ]o|enso|disagree|"
    r"(do|did)n'?t agree|mixed|unclear|not clear|uncertain|inconclusive|not (statistically )?significant|"
    r"needs more years|noise|noisy|natural (variation|variability|swings?|ups)|ups and downs|"
    r"one (bad|unusual|extreme|odd) year|single year|by chance|could be chance|varies|variab|stamps? (changed|differ)|"
    r"changed? the stamps?|lamp (changed|turned)|disappear", re.I)
STRONG_DOUBT = re.compile(r"can'?t tell|cannot tell|not enough (evidence|data|years)|inconclusive|too short", re.I)
REAL = re.compile(
    r"(?<!not )(?<!n't )(?<!in)(?<!no )significant|both tests|tests? (both )?agree|p ?[<=≤]|p-?value|"
    r"steady (rise|fall|increase|decrease|drop)|clear (trend|rise|fall|increase|decrease)|consistent(ly)?|"
    r"even with (the )?(el ?ni[nñ]o|lamp)|still (rose|fell|rising|falling|significant)|every (main )?(record|card)|"
    r"trend is real|real trend|out(side)? of the band|bigger than", re.I)
NO_CHANGE = re.compile(
    r"no (clear |real |significant |lasting )?(trend|change|rise|fall)|flat|stable|stays? (about )?(the )?same|unchanged|"
    r"not significant|no significant|(did|has|have)n'?t (really )?changed?|within the band|too small to matter|"
    r"tiny|level off|levelled|leveled|hardly (changed|moved)", re.I)
WORSE = re.compile(r"getting worse|worsen|worse|more (fires?|danger|severe|risk)|drier|drying", re.I)
BETTER = re.compile(r"getting better|improv|better|less (fires?|danger|severe|risk)|wetter", re.I)
TOOLS = re.compile(
    r"scales?|tests?|mann|kendall|t-test|season(s|al)? (filter|removed?|lens)|removed? the seasons?|ruler|lamp|el ?ni[nñ]o|"
    r"twin|stamps?|trend ?line|p-?value|per decade|\brate\b|\brange\b|record|\bdata\b|satellite|merra|nasa|graph|chart",
    re.I)

TOPIC_WORDS = """fire fires burn burning peat haze smoke flood floods flooding rain rainfall dry drier dryness drought wet
wetness soil moisture humid humidity heat hot temperature weather season seasons climate trend record wind storm
land forest river water air""".split()
CAUSE_WORDS = """el nino enso la nina climate warming warmer global greenhouse emission emissions drain drainage drained canal
canals plantation plantations palm oil logging logged deforest deforestation clearing cleared farming farm farms
agriculture crops urban city cities development roads monsoon ocean sea pacific natural variation variability cycle
cycles cloud clouds wind winds human people land use burning burnt peat peatland fires forest forests trees
evaporation sun heat pressure current currents pollution""".split()


def stem(w: str) -> str:
    w = w.lower().strip("'’-")
    return w[:5]


def words(text: str) -> list[str]:
    return WORD.findall(text.lower())


def real_word(w: str) -> bool:
    w = w.strip("'’-")
    if len(w) < 2 or not re.search(r"[aeiouy]", w):
        return False
    if re.search(r"(.)\1\1", w) or re.search(r"[bcdfghjklmnpqrstvwxz]{5,}", w):
        return False
    return not any(k in w for k in KEYBOARD)


def content(text: str) -> list[str]:
    return [w for w in words(text) if w not in STOP and real_word(w)]


@dataclass
class Field_:
    """How much real substance one written field carries."""
    text: str
    content: list[str] = field(default_factory=list)
    junk: str = ""      # why it doesn't count, in plain words ("" when it counts)

    @property
    def ok(self) -> bool:
        return not self.junk


def _copied(text: str, sources: list[str]) -> bool:
    t = " ".join(words(text))
    if len(t) < 25:
        return False
    for s in sources:
        s2 = " ".join(words(s))
        if not s2:
            continue
        if t in s2 or SequenceMatcher(None, t, s2).ratio() > 0.85:
            return True
    return False


def read_field(text: str, need: int, sources: list[str]) -> Field_:
    t = text.strip()
    f = Field_(text=t, content=content(t))
    toks = words(t)
    if not t:
        f.junk = "it is empty"
    elif NON_ANSWER.match(t):
        f.junk = f"“{t[:40]}” is not an answer"
    elif SHRUG.search(t) and len(f.content) < need + 2:
        f.junk = "it says you don't know rather than giving a reason"
    elif toks and sum(real_word(w) for w in toks) / len(toks) < 0.6:
        f.junk = "most of it isn't real words"
    elif len(f.content) < need:
        f.junk = "it is too thin to show your thinking"
    elif len(set(map(stem, f.content))) < max(2, 0.5 * len(f.content)):
        f.junk = "it repeats the same words"
    elif _copied(t, sources):
        f.junk = "it is copied from the case or the hints, not your own words"
    return f


@dataclass
class Reading:
    what: Field_
    why: Field_
    reason: Field_
    how_much: Field_
    on_topic: bool
    cause_named: bool
    stance_cue: str          # the phrase in the student's words that backs their stand ("" if none)
    cites: str               # the evidence they point at ("" if none)
    contradictions: list[str]
    checks: list[ReasonCheck]

    @property
    def sound(self) -> bool:
        """Good enough to close a case on: every check passed."""
        return all(c.ok for c in self.checks)


def _vocab(case: CasePack) -> set[str]:
    txt = " ".join([case.question, case.title, case.region.name, case.type])
    for cid in case.evidence:
        if cid in CARDS:
            d = CARDS[cid]
            txt += f" {d.name} {d.definition} {d.yearly_label}"
    return {stem(w) for w in content(txt)} | {stem(w) for w in TOPIC_WORDS}


def _card_words(case: CasePack, chosen: list[str]) -> dict[str, set[str]]:
    out = {}
    for cid in chosen:
        if cid in CARDS:
            out[CARDS[cid].name] = {stem(w) for w in content(CARDS[cid].name) if len(w) > 3}
    return out


def _quote(m: re.Match | None, text: str) -> str:
    """The clause the match sits in, cut at word boundaries."""
    if not m:
        return ""
    a = max(text.rfind(ch, 0, m.start()) for ch in ".;!?,") + 1
    ends = [i for i in (text.find(ch, m.end()) for ch in ".;!?,") if i != -1]
    b = min(ends) if ends else len(text)
    s = text[a:b].strip()
    if len(s) > 90:
        s = s[:90].rsplit(" ", 1)[0] + "…"
    return s


# the "is it real?" options exactly as the form shows them, and words that add nothing to them
TICK_LABEL = {"yes": "Yes, it is significant", "no": "No, there is no real change",
              "cant_tell": "Can't tell yet: not enough evidence"}
LABEL_FILLER = {stem(w) for w in """because think thought answer answers evidence enough tell yet real change chose choose
pick picked there isn't can't cannot not sure know so we it is significant no yes say said settle cause guess right
correct option box ticked tick result results""".split()}
STANCE = {"yes": "Yes, it is significant", "no": "No, there is no real change", "cant_tell": "Can't tell yet"}
STANCE_ASK = {
    "yes": "say what showed you the change is real (the stamps, both tests, the El Niño lamp, your ruler's rate)",
    "no": "say what showed you there is no real change (a flat line, a stamp, a rate too small to matter)",
    "cant_tell": "say why the record can't settle it yet (too few years? the tests disagree? El Niño?)",
}


def read(case: CasePack, chosen: list[str], v: Verdict) -> Reading:
    sources = [case.question, case.brief, *case.hints.evidence, *case.hints.method, *case.hints.verdict,
               "how wet the soil is in the driest months", "about 0.01 per decade"]
    sources += [CARDS[c].definition for c in case.evidence if c in CARDS]
    what = read_field(v.what, 2, sources)
    why = read_field(v.why_hypothesis, 4, sources)
    reason = read_field(v.reasoning, 4, sources) if v.reasoning.strip() else Field_(text="", junk="it is empty")
    how = read_field(v.how_much, 2, sources)
    if NUMBER.search(v.how_much) and not NON_ANSWER.match(v.how_much.strip()):
        how.junk = ""   # "0.013 per decade" is a full answer
    vocab = _vocab(case)
    on_topic = what.ok and any(stem(w) in vocab for w in what.content)
    cause_named = why.ok and any(stem(w) in {stem(x) for x in CAUSE_WORDS} | vocab for w in why.content)

    # the stand on "is it real?" and the reason the student gave for it: the cue has to be in the
    # reasoning box itself, so the right words typed into another box can't carry an empty reason
    stance_re = {"yes": REAL, "no": NO_CHANGE, "cant_tell": DOUBT}[v.is_it_real]
    m = stance_re.search(reason.text) if reason.ok else None
    stance_cue = _quote(m, reason.text) if m else ""
    if (not stance_cue and v.is_it_real == "yes" and reason.ok
            and (NUMBER.search(reason.text) or re.search(r"\brate\b|ruler|per decade", reason.text, re.I))):
        stance_cue = "your rate"   # a measured rate, named in the reasoning, backs "yes"
    # ...and say more than the box it ticked ("can't tell because there is not enough evidence" says nothing new)
    own = {stem(w) for w in reason.content} - {stem(w) for w in content(TICK_LABEL[v.is_it_real])} - LABEL_FILLER
    restates = reason.ok and len(own) < 2
    reason_relevant = reason.ok and not restates and bool(
        stance_re.search(reason.text) or TOOLS.search(reason.text) or any(stem(w) in vocab for w in reason.content))

    # what evidence the reasoning points at
    cites = ""
    joined = " ".join(f.text for f in (reason, how, what) if f.ok)
    stems = {stem(w) for w in content(joined)}
    for name, ws in _card_words(case, chosen).items():
        if ws & stems:
            cites = name.lower()
            break
    if not cites:
        m = TOOLS.search(" ".join(f.text for f in (reason, how) if f.ok))
        if m:
            cites = m.group(0).lower()
    if not cites and NUMBER.search(joined):
        cites = "your numbers"

    # contradictions between the ticked boxes, and between the boxes and the words
    contra: list[str] = []
    if v.direction == "no_change" and v.is_it_real == "yes":
        contra.append("you ticked 'No change' but also 'Yes, it is significant'")
    if v.direction != "no_change" and v.is_it_real == "no":
        contra.append(f"you ticked '{v.direction.replace('_', ' ').capitalize()}' but also 'No, there is no real change'")
    words_all = " ".join(f.text for f in (reason, how, what) if f.ok)
    if v.is_it_real == "yes" and STRONG_DOUBT.search(words_all):
        contra.append("you ticked 'Yes, it is significant' but wrote that the record can't tell")
    if v.is_it_real != "cant_tell":
        if v.direction == "improving" and WORSE.search(words_all) and not BETTER.search(words_all):
            contra.append("you ticked 'Improving' but your words describe things getting worse")
        if v.direction == "worsening" and BETTER.search(words_all) and not WORSE.search(words_all):
            contra.append("you ticked 'Worsening' but your words describe things getting better")

    def chk(id_: str, ok: bool, label: str, good: str, bad: str) -> ReasonCheck:
        return ReasonCheck(id=id_, ok=ok, label=label, detail=good if ok else bad)

    checks = [
        chk("what", what.ok and on_topic, "Says what is changing",
            f"You named it: “{what.text[:60]}”.",
            f"'What is changing?' doesn't count yet: {what.junk}." if not what.ok
            else "'What is changing?' should name the record you measured (soil wetness, rain, hot days…)."),
        chk("stance", reason_relevant and bool(stance_cue), f"Backs your stand: {STANCE[v.is_it_real]}",
            f"Your reason: “{stance_cue}”." if stance_cue != "your rate" else "You backed it with the rate you measured.",
            (f"Your reasoning doesn't count yet: {reason.junk}. " if not reason.ok
             else "Your reasoning only repeats the box you ticked. " if restates
             else "Your reasoning doesn't talk about this case's records or tests. " if not reason_relevant else "")
            + f"You chose '{STANCE[v.is_it_real]}', so {STANCE_ASK[v.is_it_real]}."),
        chk("evidence", bool(cites), "Points to your own evidence",
            f"You pointed to {cites}.",
            "Name the record or the test that led you there, so a reader can check your work."),
        chk("consistent", not contra, "Boxes and words agree",
            "Your ticked answers and your words tell the same story.",
            "Your answers pull against each other: " + "; ".join(contra) + "."),
        chk("why", why.ok and cause_named, "Offers a possible cause in your own words",
            "You offered a cause to test next.",
            f"'Why might it be?' doesn't count yet: {why.junk}." if not why.ok
            else "'Why might it be?' should name a possible cause of the change (El Niño, drainage, land clearing…)."),
    ]
    return Reading(what=what, why=why, reason=reason, how_much=how, on_topic=on_topic, cause_named=cause_named,
                   stance_cue=stance_cue, cites=cites, contradictions=contra, checks=checks)
