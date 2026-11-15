// The Partner (hornbill) box, shared by lite mode and the 3D office. A hint ladder per stage
// (nudge → pointer → worked example) plus a short question box. Hints only, never answers:
// the backend guards every reply and falls back to the approved ladder.
// AI-assisted: written with Claude Code.
import { useState } from 'react'
import { api } from '../api/client'
import { useSession, type Beat } from '../state/session'
import { HoldToTalk } from './HoldToTalk'
import { partnerNote } from './partnerNote'

const GROUP: Record<Beat, string> = {
  call: 'evidence', scene: 'evidence', locker: 'evidence', board: 'method', lab: 'method', deduction: 'verdict', closed: 'verdict',
}
const RUNG_LABEL = ['Give me a nudge', 'Point me somewhere', 'Show me an example']

export function Partner() {
  const { sessionId, beat, chat, hintRung, addChat } = useSession()
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  if (!sessionId || beat === 'call' || beat === 'closed') return null
  const group = GROUP[beat]
  const used = hintRung[group] ?? 0
  const lines = chat.filter((c) => GROUP[c.beat as Beat] === group).slice(-3)

  async function ask(rung: number, message: string) {
    setBusy(true); setErr('')
    try {
      const r = await api.partner(sessionId!, beat, rung, message)
      addChat({ q: message || RUNG_LABEL[rung - 1], a: r.text, source: r.source, beat, note: partnerNote(r, !!message) }, group, rung)
      setQ('')
    } catch (e) { setErr(e instanceof Error ? e.message : 'The Partner is busy.') }
    setBusy(false)
  }

  const next = Math.min(3, used + 1)
  return (
    <aside className="partner" aria-label="Partner hints">
      <div className="partner-head"><span className="hornbill" aria-hidden="true">🐦</span>
        <strong>Your Partner</strong><span className="muted"> gives hints, never answers</span></div>
      {lines.length > 0 && (
        <ul className="partner-chat" aria-live="polite">
          {lines.map((c, i) => (
            <li key={i}><em>{c.q}</em>{c.note && <small className="guide-note">{c.note}</small>}<p>{c.a}{c.source === 'ai' && <span className="ai-tag">AI</span>}</p></li>
          ))}
        </ul>
      )}
      <div className="partner-row">
        <button disabled={busy || used >= 3} onClick={() => ask(next, '')}>
          {used >= 3 ? 'No more hints here' : `${RUNG_LABEL[next - 1]} (${next}/3)`}
        </button>
      </div>
      <form className="partner-row" onSubmit={(e) => { e.preventDefault(); if (q.trim()) ask(Math.max(1, used), q.trim()) }}>
        <input value={q} maxLength={300} onChange={(e) => setQ(e.target.value)} placeholder="Ask about this case…" aria-label="Ask the Partner" />
        <button disabled={busy || !q.trim()}>{busy ? 'Thinking…' : 'Ask'}</button>
        <HoldToTalk disabled={busy} onText={setQ} onDone={(t) => ask(Math.max(1, used), t)} />
      </form>
      {busy && <p className="muted" role="status">Your Partner is thinking…</p>}
      {err && <p className="error">{err}</p>}
    </aside>
  )
}
