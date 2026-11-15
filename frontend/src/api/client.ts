// The ONLY module that calls the backend. AI-assisted: written with Claude Code.
import type {
  Agency, AnalysisResult, CaseFile, CasePublic, DraftRow, ChiefNote, ExecSummary, ChooseResult, MyLineResult, ShuffleResult, Grade, LogEvent, PartnerReply, Series, SessionOut, Tool, Verdict,
} from './types'

const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

/** Set by state/recover.ts: makes a fresh session after the backend lost one, returns its id. */
let recoverSession: ((oldId: string) => Promise<string | null>) | null = null
export function onSessionLost(fn: (oldId: string) => Promise<string | null>) { recoverSession = fn }

/** No call waits forever: the model-backed routes get longer, everything else 15 s. */
const TIMEOUT_MS = 15_000
const SLOW_MS = 25_000

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, retried = false, ms = TIMEOUT_MS, extra?: Record<string, string>): Promise<T> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  let r: Response
  try {
    r = await fetch(`${BASE}${path}`, {
      method, signal: ctl.signal,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...extra },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (e) {
    throw new Error(ctl.signal.aborted ? 'The agency line timed out. Please try again.' : 'Could not reach the agency. Check your connection.', { cause: e })
  } finally { clearTimeout(t) }
  if (!r.ok) {
    let detail = `${r.status}`
    try { detail = (await r.json()).detail ?? detail } catch { /* not json */ }
    // The backend forgot this session (restart, or an old tab): start a new one quietly and retry once.
    const m = /^\/sessions\/([0-9a-f]+)\//.exec(path)
    if (r.status === 404 && detail === 'session not found' && m && recoverSession && !retried) {
      const fresh = await recoverSession(m[1])
      if (fresh) {
        const b = body && typeof body === 'object' && 'session_id' in body ? { ...body, session_id: fresh } : body
        return call<T>(method, path.replace(m[1], fresh), b, true, ms)
      }
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return r.json() as Promise<T>
}

export const api = {
  health: () => call<{ ok: boolean; env: string; data_backend: string }>('GET', '/health'),
  cases: () => call<CasePublic[]>('GET', '/cases'),
  series: (caseId: string, cardId: string, regionId?: string) =>
    call<Series>('GET', `/cases/${caseId}/series/${cardId}${regionId ? `?region_id=${regionId}` : ''}`),
  startSession: (caseId: string, nickname: string) =>
    call<SessionOut>('POST', '/sessions', { case_id: caseId, nickname }),
  choose: (sid: string, cards: string[]) =>
    call<ChooseResult>('POST', `/sessions/${sid}/choose`, { cards }),
  log: (sid: string, ev: LogEvent) => call<{ ok: boolean }>('POST', `/sessions/${sid}/log`, ev),
  /** Used only while recovering: plain calls that never trigger another recovery. */
  raw: { post: <T>(path: string, body: unknown) => call<T>('POST', path, body, true) },
  analyse: (sid: string, cardId: string, tool: Tool) =>
    call<AnalysisResult>('POST', `/sessions/${sid}/analyse`, { session_id: sid, card_id: cardId, tool }),
  myLine: (sid: string, cardId: string, rate: number, level: number) =>
    call<MyLineResult>('POST', `/sessions/${sid}/myline`, { card_id: cardId, rate_per_decade: rate, level }),
  shuffle: (sid: string, cardId: string) =>
    call<ShuffleResult>('POST', `/sessions/${sid}/shuffle`, { card_id: cardId }),
  partner: (sid: string, beat: string, rung: number, message: string) =>
    call<PartnerReply>('POST', `/sessions/${sid}/partner`, { beat, rung, message }, false, SLOW_MS),
  verdict: (v: Verdict) => call<Grade>('POST', `/sessions/${v.session_id}/verdict`, v),
  agency: () => call<Agency>('GET', '/agency/activity'),
  /** Editor's desk. The key is typed by the editor and kept only in this tab's memory. */
  admin: {
    drafts: (key: string) => call<DraftRow[]>('GET', '/admin/cases', undefined, true, TIMEOUT_MS, { 'X-Admin-Token': key }),
    decide: (key: string, id: string, d: 'approve' | 'reject') => call<{ id: string; status: string }>('POST', `/admin/cases/${id}/${d}`, undefined, true, TIMEOUT_MS, { 'X-Admin-Token': key }),
    scout: (key: string) => call<{ drafted: { id: string }[]; headlines: number }>('POST', '/admin/scout/run', undefined, true, 180_000, { 'X-Admin-Token': key }),
  },
  chief: (sid: string) => call<ChiefNote>('POST', `/sessions/${sid}/chief`, undefined, false, SLOW_MS),
  casefile: (sid: string) => call<CaseFile>('GET', `/sessions/${sid}/casefile`, undefined, true),
  summary: (sid: string) => call<ExecSummary>('POST', `/sessions/${sid}/summary`, undefined, true, 40_000),
  /** Hold-to-talk fallback: a short recording in, the words out (nothing is stored). */
  transcribe: async (sid: string, audio: Blob): Promise<string> => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), SLOW_MS)
    try {
      const r = await fetch(`${BASE}/sessions/${sid}/transcribe`, { method: 'POST', body: audio, signal: ctl.signal,
        headers: { 'Content-Type': audio.type.split(';')[0] || 'audio/webm' } })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(typeof j.detail === 'string' ? j.detail : "I couldn't hear that. Try typing instead.")
      return (j.text as string) || ''
    } catch (e) {
      throw ctl.signal.aborted ? new Error('The line timed out. Try again or type it.') : e
    } finally { clearTimeout(t) }
  },
}

/** Fire-and-forget logging: a failed log must never block a student. */
export function logQuiet(sid: string | null, ev: LogEvent) {
  if (sid) api.log(sid, ev).catch(() => undefined)
}
