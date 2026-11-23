// Mirror of backend/app/schemas.py (MASTER_SHEET §15). Keep in sync; prefer generating from /openapi.json.
// AnswerKey is intentionally absent: it never reaches the browser.
// AI-assisted: scaffolded with Claude Code.
export type CaseType = 'fire' | 'haze' | 'flood' | 'dry' | 'heat' | 'land'
export type Tool = 'magnifier' | 'season' | 'ruler' | 'scales' | 'elnino' | 'twin'
export type Stamp = 'significant' | 'not_significant' | 'needs_more_years' | 'record_too_short'
export type Direction = 'rising' | 'falling' | 'flat'
export type Ending = 'solved' | 'solved_not_enough' | 'sent_back'
export type Badge = 'clean_signal' | 'red_herring' | 'honest_doubt' | 'second_opinion' | 'twin_trail' | 'elnino_eye'

export interface Source { title: string; url: string; date: string }
export interface Region { id: string; name: string; bbox: [number, number, number, number]; centroid: [number, number] }
export interface EvidenceCard {
  id: string; name: string; definition: string; mission: string; unit: string
  yearly_label: string; from: number; grid_km: number; provisional: string | null
}
export interface CasePublic {
  id: string; title: string; type: CaseType; status: 'draft' | 'open' | 'closed'
  question: string; brief: string; sources: Source[]; region: Region; twin_region: Region | null
  scene: { layers: string[]; from: string; to: string }
  evidence: EvidenceCard[]; limits: string[]; data_as_of: string
}
export interface SessionOut { id: string; case_id: string; nickname: string; created_at: string }
export interface Series {
  card_id: string; region_id: string
  monthly: { t: string; v: number | null }[]; yearly: { y: number; v: number | null }[]
  normal: { m: number; v: number }[]; data_as_of: string
}
export interface AnalysisResult {
  card_id: string; region_id: string; tool: Tool; mission: string; data_as_of: string
  n_years: number | null; elnino_r: number | null; opposite_trends: boolean | null; twin: AnalysisResult | null
  rate_per_decade: number | null; range: [number, number] | null; unit: string
  t_test_p: number | null; mann_kendall_p: number | null; sen_per_decade: number | null
  stamp: Stamp | null; years_needed: number | null; small?: boolean; direction: Direction | null
  series_out: { y: number; v: number | null }[]
  monthly_out: { t: string; v: number | null }[]
  /** elnino tool: the El Niño index for each year, for the scatter chart */
  enso_out: { y: number; v: number | null }[]
}
export interface Verdict {
  session_id: string; what: string; where: string; direction: 'worsening' | 'improving' | 'no_change'
  how_much: string; is_it_real: 'yes' | 'no' | 'cant_tell'; why_hypothesis: string; confidence: 1 | 2 | 3
  /** what in the student's own evidence backs their answer to "is it real?" */
  reasoning: string
}
/** How the grader read the student's written reasoning (about their own stand, never the answer key). */
export interface ReasonCheck { id: 'what' | 'stance' | 'evidence' | 'consistent' | 'why'; ok: boolean; label: string; detail: string }
export interface Grade {
  score: number; parts: { evidence: number; method: number; verdict: number; explanation: number }
  ending: Ending; feedback: string[]; badges: Badge[]; report_url: string | null
  checks?: ReasonCheck[]
  attempt: number; can_retry: boolean; chief_note: string | null
}
export interface PartnerReply {
  text: string; rung: number; source: 'ai' | 'ladder'; turns_left: number
  /** why the approved hint replaced an AI reply; null when source is 'ai' */
  fallback?: 'guarded' | 'busy' | 'off' | null
}
export interface ChiefNote { attempt: number; chief_note: string | null }
export interface ChooseResult { chosen: string[]; partner_asks_why: boolean }
export interface LogEvent {
  kind: 'beat' | 'clue' | 'open_card' | 'hint' | 'pins'
  beat?: string; card_id?: string; lonlat?: [number, number]; pins?: [number, number][]
}
/** GET /agency/activity: what the agents, the code and the human editor have been doing. */
export interface AgencyEvent { at: string; agent: string; by: 'ai' | 'code' | 'human'; kind: string; text: string }
export interface Agency {
  steps: { name: string; by: string; does: string }[]; schedule: string
  counts: { open: number; waiting: number }; events: AgencyEvent[]
}
/** Editor's desk (admin only). */
export interface DatasetConfig {
  id: string; name: string; missing?: boolean
  definition?: string; mission?: string; unit?: string; yearly_label?: string; from_year?: number; grid_km?: number
  months?: string[]; worse_when?: string | null; band_per_decade?: number; provisional?: string | null
  role?: 'main' | 'supporting' | 'red_herring'
  vault?: Record<string, { region: string; first?: number | null; last?: number | null; n_years?: number; data_as_of?: string; missing?: boolean }>
}
export interface KeyCard { direction: string | null; stamp: string; rate_per_decade: number; range: [number, number]; elnino_stamp: string }
/** The teacher's desk (GET /admin/cases, editor's key only): every case with its full configuration. */
export interface DraftRow {
  case: Omit<CasePublic, 'evidence'> & { red_herrings: string[]; main_cards: string[]; evidence: string[]
    hints: { evidence: string[]; method: string[]; verdict: string[] } }
  origin: 'repository' | 'desk'
  key_overall: string | null; key_computed_at: string | null
  key_stamps: Record<string, [string, string]>; key_cards: Record<string, KeyCard>
  datasets: DatasetConfig[]
}
/** Daily rain over the case region (GET /cases/{id}/rain): drives the map's rain and rising water. */
export interface SceneRain { region: string; days: { d: string; mm: number }[]; source: string; note: string; data_as_of: string | null }

export interface SceneManifest {
  bbox: [number, number, number, number]; width: number; height: number; base: string
  base_source: string; fires_source: string; fire_days: string[]; missing_days: string[]
  terrain?: { file: string; size: number; max_m: number; source: string }
  fire_points?: { file: string; count: number; sea_removed?: number }
  /** land/sea mask on the picture's pixel grid: white is sea */
  sea?: { file: string; source: string }
}

/** Workbench (learning tools, never graded). Mirrors backend MyLineResult / ShuffleResult. */
export interface MyLineResult {
  card_id: string; mission: string; data_as_of: string; unit: string
  your_miss: number; best_miss: number; score: number
  best_rate_per_decade: number; best_level: number; mid_year: number; same_direction: boolean
}
export interface ShuffleResult {
  card_id: string; mission: string; data_as_of: string; unit: string
  real_rate_per_decade: number; n: number; as_steep: number; edges: number[]; counts: number[]
}

/** The printable case study (GET /sessions/{id}/casefile). Built by code from the session; never the answer key. */
export interface CaseFileTest {
  card: string; tool: string; mission: string | null; data_as_of: string | null; n_years: number | null
  rate: string | null; unit: string | null; range: [string, string] | null
  t_test_p: string | null; mann_kendall_p: string | null; stamp: string | null; direction: string | null
  years_needed: number | string | null; elnino_r: string | null; small?: boolean
}
export interface Insight {
  card_id: string; name: string; definition: string; unit: string; yearly_label: string; mission: string; data_as_of: string
  points: [number, number][]; line: [number, number][] | null; extend_years: number; elnino_points: [number, number][] | null
  metrics: { n_years: number; first: number; last: number; rate: string | null; range: [string, string] | null
    t_test_p: string | null; mann_kendall_p: string | null; t_test_p_raw: number | null; mann_kendall_p_raw: number | null
    sen: string | null; r2: string | null; elnino_r: string | null; after_elnino: string | null; after_elnino_rate: string | null
    after_elnino_t_p: string | null; after_elnino_mk_p: string | null
    after_elnino_t_p_raw: number | null; after_elnino_mk_p_raw: number | null
    band: string; years_needed: number | string | null }
  stamp: Stamp; stamp_text: string; direction: string | null; significant: boolean; caption: string
  /** robust: significant and still with El Niño removed · elnino: significant only until El Niño is removed · not: not significant */
  group: 'robust' | 'elnino' | 'not'; group_text: string
}
/** The executive report (POST /sessions/{id}/summary): the agency's exemplar of the case (every relevant record, no marks).
 *  Story text by the Reporter (guarded), charts and captions by code. */
export interface ExecSummary {
  v: 3
  sections: { headline: string; issue: string; response: string; insights: string; impact: string }
  source: 'ai' | 'code'
  insights: Insight[]
}
export interface CaseFile {
  case: { id: string; title: string; question: string; brief: string; region: string; twin_region: string | null
          sources: { title: string; url?: string; date?: string }[]; limits: string[] }
  detective: string; started: string; finished: string
  evidence: { name: string; definition: string; mission: string }[]
  pins: number
  steps: { at: string; stage: string; what: string }[]
  tests: CaseFileTest[]
  partner: { q: string; a: string; by: string }[]
  verdict: { what: string; where: string; direction: string; how_much: string; is_it_real: string; why_hypothesis: string; confidence: number; reasoning?: string } | null
  attempts: number
  grade: { score: number; parts: Grade["parts"]; ending: string; feedback: string[]; badges: string[]; chief_note: string | null; checks?: ReasonCheck[] }
  summary: ExecSummary | null
}
