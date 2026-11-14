// The ONLY module that calls the backend. AI-assisted: written with Claude Code.
import type {
  AnalysisResult, CasePublic, ChooseResult, Grade, LogEvent, Series, SessionOut, Tool, Verdict,
} from './types'

const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) {
    let detail = `${r.status}`
    try { detail = (await r.json()).detail ?? detail } catch { /* not json */ }
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
  analyse: (sid: string, cardId: string, tool: Tool) =>
    call<AnalysisResult>('POST', `/sessions/${sid}/analyse`, { session_id: sid, card_id: cardId, tool }),
  verdict: (v: Verdict) => call<Grade>('POST', `/sessions/${v.session_id}/verdict`, v),
}

/** Fire-and-forget logging: a failed log must never block a student. */
export function logQuiet(sid: string | null, ev: LogEvent) {
  if (sid) api.log(sid, ev).catch(() => undefined)
}
