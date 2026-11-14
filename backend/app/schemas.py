"""Data contracts (MASTER_SHEET §15). The single source of truth for both tracks.
Frontend mirror: frontend/src/api/types.ts. Change only with a docs/BUILD_LOG.md entry.
AI-assisted: scaffolded with Claude Code."""
from typing import Literal

from pydantic import BaseModel, Field

CaseType = Literal["fire", "haze", "flood", "dry", "heat", "land"]
CaseStatus = Literal["draft", "open", "closed"]
Tool = Literal["magnifier", "season", "ruler", "scales", "elnino", "twin"]
Stamp = Literal["significant", "not_significant", "needs_more_years", "record_too_short"]
Direction = Literal["rising", "falling", "flat"]
Overall = Literal["worsening", "improving", "no_change", "not_enough_evidence"]
IsItReal = Literal["yes", "no", "cant_tell"]
Ending = Literal["solved", "solved_not_enough", "sent_back"]
Badge = Literal[
    "clean_signal", "red_herring", "honest_doubt", "second_opinion", "twin_trail", "elnino_eye"
]


class Source(BaseModel):
    title: str
    url: str
    date: str  # YYYY-MM-DD


class Region(BaseModel):
    id: str
    name: str
    bbox: tuple[float, float, float, float]  # west, south, east, north (lon/lat)
    centroid: tuple[float, float]  # lon, lat


class Scene(BaseModel):
    layers: list[str]
    from_: str = Field(alias="from")
    to: str

    model_config = {"populate_by_name": True}


class Hints(BaseModel):
    evidence: list[str] = Field(default_factory=list, max_length=3)
    method: list[str] = Field(default_factory=list, max_length=3)
    verdict: list[str] = Field(default_factory=list, max_length=3)


class CasePack(BaseModel):
    """Everything a case needs. Built by the Case Builder, approved by a human."""
    id: str
    title: str
    type: CaseType
    status: CaseStatus = "draft"
    question: str
    brief: str
    sources: list[Source]
    region: Region
    scene: Scene
    evidence: list[str]  # EvidenceCard ids, red herrings included
    red_herrings: list[str]
    main_cards: list[str]  # cards the overall verdict is derived from (§16)
    hints: Hints
    limits: list[str]
    data_as_of: str


class EvidenceCard(BaseModel):
    id: str
    name: str
    definition: str
    mission: str  # plain-text label, never a logo
    unit: str
    from_: int = Field(alias="from")
    grid_km: float
    relevant: bool  # server-side only; stripped before sending to the browser

    model_config = {"populate_by_name": True}


class MonthlyPoint(BaseModel):
    t: str  # YYYY-MM
    v: float | None


class YearlyPoint(BaseModel):
    y: int
    v: float | None


class NormalPoint(BaseModel):
    m: int  # 1..12
    v: float


class Series(BaseModel):
    card_id: str
    region_id: str
    monthly: list[MonthlyPoint]
    yearly: list[YearlyPoint]
    normal: list[NormalPoint]
    data_as_of: str


class AnalysisRequest(BaseModel):
    session_id: str
    card_id: str
    tool: Tool
    options: dict = Field(default_factory=dict)  # e.g. {"region_b": "south-basin"}


class AnalysisResult(BaseModel):
    card_id: str
    tool: Tool
    rate_per_decade: float | None = None
    range: tuple[float, float] | None = None
    unit: str = "per decade"
    t_test_p: float | None = None
    mann_kendall_p: float | None = None
    sen_per_decade: float | None = None
    stamp: Stamp | None = None
    years_needed: int | None = None  # capped: 51 means "more than 50"
    direction: Direction | None = None
    series_out: list[YearlyPoint] = Field(default_factory=list)


class CardKey(BaseModel):
    direction: Direction
    stamp: Stamp
    rate_per_decade: float
    range: tuple[float, float]
    elnino_stamp: Stamp


class AnswerKey(BaseModel):
    """Computed by code at case build. NEVER sent to the browser or the Partner."""
    case_id: str
    per_card: dict[str, CardKey]
    overall: Overall
    computed_at: str


class Verdict(BaseModel):
    session_id: str
    what: str
    where: str
    direction: Literal["worsening", "improving", "no_change"]
    how_much: str
    is_it_real: IsItReal
    why_hypothesis: str
    confidence: Literal[1, 2, 3]


class GradeParts(BaseModel):
    evidence: float  # 0..25
    method: float  # 0..25
    verdict: float  # 0..30
    explanation: float  # 0..20


class Grade(BaseModel):
    score: float
    parts: GradeParts
    ending: Ending
    feedback: list[str]
    badges: list[Badge]
    report_url: str | None = None
