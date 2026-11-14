// When the backend no longer knows the session (it restarted, or this tab is old), open a new
// session for the same case and replay what the student already did (cards chosen, tools run),
// so their work and their method marks are kept. Registered once from main.tsx.
// AI-assisted: written with Claude Code.
import { api, onSessionLost } from '../api/client'
import type { ChooseResult, SessionOut, Tool } from '../api/types'
import { useSession } from './session'

let inFlight: Promise<string | null> | null = null

async function recover(oldId: string): Promise<string | null> {
  const s = useSession.getState()
  if (!s.activeCase) return null
  if (s.sessionId && s.sessionId !== oldId) return s.sessionId   // another call already recovered
  const fresh = await api.raw.post<SessionOut>('/sessions', { case_id: s.activeCase.id, nickname: s.nickname.trim() || 'Detective' })
  s.setSessionId(fresh.id)
  if (s.chosen.length) await api.raw.post<ChooseResult>(`/sessions/${fresh.id}/choose`, { cards: s.chosen })
  for (const [cardId, byTool] of Object.entries(s.results)) {
    for (const tool of Object.keys(byTool ?? {}) as Tool[]) {
      await api.raw.post(`/sessions/${fresh.id}/analyse`, { session_id: fresh.id, card_id: cardId, tool }).catch(() => undefined)
    }
  }
  return fresh.id
}

export function installRecovery() {
  onSessionLost((oldId) => {
    inFlight ??= recover(oldId).catch(() => null).finally(() => { inFlight = null })
    return inFlight
  })
}
