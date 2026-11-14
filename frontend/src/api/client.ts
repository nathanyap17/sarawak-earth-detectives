// The ONLY module that calls the backend. AI-assisted: written with Claude Code.
import type {
  AnalysisResult, CasePublic, ChooseResult, Grade, LogEvent, PartnerReply, Series, SessionOut, Tool, Verdict,
} from './types'

const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

/** Set by state/recover.ts: makes a fresh session after the backend lost one, returns its id. */
let recoverSession: ((oldId: string) => Promise<string | null>) | null = null
export function onSessionLost(fn: (oldId: string) => Promise<string | null>) { recoverSession = fn }

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, retried = false): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) {
    let detail = `${r.status}`
    try { detail = (await r.json()).detail ?? detail } catch { /* not json */ }
    // The backend forgot this session (restart, or an old tab): start a new one quietly and retry once.
    const m = /^\/sessions\/([0-9a-f]+)\//.exec(path)
    if (r.status === 404 && detail === 'session not found' && m && recoverSession && !retried) {
      const fresh = await recoverSession(m[1])
      if (fresh) {
        const b = body && typeof body === 'object' && 'session_id' in body ? { ...body, session_id: fresh } : body
        return call<T>(method, path.replace(m[1], fresh), b, true)
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
  partner: (sid: string, beat: string, rung: number, message: string) =>
    call<PartnerReply>('POST', `/sessions/${sid}/partner`, { beat, rung, message }),
  verdict: (v: Verdict) => call<Grade>('POST', `/sessions/${v.session_id}/verdict`, v),
}

/** Fire-and-forget logging: a failed log must never block a student. */
export function logQuiet(sid: string | null, ev: LogEvent) {
  if (sid) api.log(sid, ev).catch(() => undefined)
}
