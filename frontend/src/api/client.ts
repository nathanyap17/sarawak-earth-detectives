// The ONLY module that calls the backend. AI-assisted: written with Claude Code.
import type {
  AnalysisResult, CasePublic, ChiefNote, ChooseResult, MyLineResult, ShuffleResult, Grade, LogEvent, PartnerReply, Series, SessionOut, Tool, Verdict,
} from './types'

const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

/** Set by state/recover.ts: makes a fresh session after the backend lost one, returns its id. */
let recoverSession: ((oldId: string) => Promise<string | null>) | null = null
export function onSessionLost(fn: (oldId: string) => Promise<string | null>) { recoverSession = fn }

/** No call waits forever: the model-backed routes get longer, everything else 15 s. */
const TIMEOUT_MS = 15_000
const SLOW_MS = 25_000

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, retried = false, ms = TIMEOUT_MS): Promise<T> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  let r: Response
  try {
    r = await fetch(`${BASE}${path}`, {
      method, signal: ctl.signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
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
  chief: (sid: string) => call<ChiefNote>('POST', `/sessions/${sid}/chief`, undefined, false, SLOW_MS),
}

/** Fire-and-forget logging: a failed log must never block a student. */
export function logQuiet(sid: string | null, ev: LogEvent) {
  if (sid) api.log(sid, ev).catch(() => undefined)
}
