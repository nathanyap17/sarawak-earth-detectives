// Beat 3, The Evidence Locker: pick 3 to 5 cards; one may be a red herring.
// AI-assisted: written with Claude Code.
import { useState } from 'react'
import { api } from '../api/client'
import { useSession } from '../state/session'

export function LockerBeat({ onDone }: { onDone: () => void }) {
  const { activeCase: c, sessionId, chosen, setChosen, herringWarning } = useSession()
  const [sel, setSel] = useState<string[]>(chosen)
  const [busy, setBusy] = useState(false)
  const [asked, setAsked] = useState(herringWarning)

  const toggle = (id: string) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 5 ? s : [...s, id]))

  async function submit(force = false) {
    setBusy(true)
    try {
      const r = await api.choose(sessionId!, sel)
      setChosen(r.chosen, r.partner_asks_why)
      if (r.partner_asks_why && !asked && !force) { setAsked(true); return }
      onDone()
    } finally { setBusy(false) }
  }

  return (
    <section className="beat">
      <h2>The Evidence Locker</h2>
      <p>Choose three to five records that could answer the question. Not every card belongs to this case.</p>
      <div className="cards">
        {c!.evidence.map((e) => (
          <button key={e.id} className={`ev-card ${sel.includes(e.id) ? 'on' : ''}`} onClick={() => toggle(e.id)}
            aria-pressed={sel.includes(e.id)}>
            <strong>{e.name}</strong>
            <span>{e.definition}</span>
            <small className="mission">{e.mission} · from {e.from} · {e.yearly_label}</small>
            {e.provisional && <small className="caveat">⚠ {e.provisional}</small>}
          </button>
        ))}
      </div>
      {asked && (
        <div className="hornbill" role="note">
          <span aria-hidden>🐦</span>
          <p><strong>The Partner tilts its head:</strong> “One of these cards — why this one? What does it have to do with the question?”</p>
        </div>
      )}
      <div className="actions">
        <span>{sel.length} chosen</span>
        <button className="primary" disabled={busy || sel.length < 3} onClick={() => submit(false)}>
          Pin them to the Board
        </button>
        {asked && <button disabled={busy || sel.length < 3} onClick={() => submit(true)}>Keep my choice</button>}
      </div>
    </section>
  )
}
