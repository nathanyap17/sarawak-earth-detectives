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
  stamp: Stamp | null; years_needed: number | null; direction: Direction | null
  series_out: { y: number; v: number | null }[]
  monthly_out: { t: string; v: number | null }[]
  /** elnino tool: the El Niño index for each year, for the scatter chart */
  enso_out: { y: number; v: number | null }[]
}
export interface Verdict {
  session_id: string; what: string; where: string; direction: 'worsening' | 'improving' | 'no_change'
  how_much: string; is_it_real: 'yes' | 'no' | 'cant_tell'; why_hypothesis: string; confidence: 1 | 2 | 3
}
export interface Grade {
  score: number; parts: { evidence: number; method: number; verdict: number; explanation: number }
  ending: Ending; feedback: string[]; badges: Badge[]; report_url: string | null
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
export interface DraftRow { case: Omit<CasePublic, 'evidence'> & { red_herrings: string[]; main_cards: string[]; evidence: string[] }; key_overall: string | null; key_stamps: Record<string, [string, string]> }
export interface SceneManifest {
  bbox: [number, number, number, number]; width: number; height: number; base: string
  base_source: string; fires_source: string; fire_days: string[]; missing_days: string[]
  terrain?: { file: string; size: number; max_m: number; source: string }
  fire_points?: { file: string; count: number }
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
