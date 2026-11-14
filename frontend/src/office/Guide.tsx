// Kenyalang, the hornbill Partner, as a live guide: it says what to do now (scripted, typed out
// letter by letter), explains words from a vetted glossary, and passes hints and questions to
// the backend Partner, whose replies are guarded so they never give the answer.
// AI-assisted: written with Claude Code.
import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { useSession } from '../state/session'
import { GLOSSARY, say } from './script'
import { useGuideState } from './useGuideState'
import { useUI } from './ui'

const GROUP: Record<string, string> = {
  call: 'evidence', scene: 'evidence', locker: 'evidence', board: 'method', lab: 'method', deduction: 'verdict', closed: 'verdict',
}
const RUNG = ['Give me a nudge', 'Point me somewhere', 'Show me an example']

function useTyped(text: string) {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(text.length); return }
    const t = setInterval(() => setN((k) => { if (k >= text.length) { clearInterval(t); return k } return k + 2 }), 18)
    return () => clearInterval(t)
  }, [text])
  return text.slice(0, n)
}

export function Guide() {
  const gs = useGuideState()
  const idle = useUI((u) => u.idle)
  const { sessionId, beat, hintRung, addChat } = useSession()
  const script = say(gs)
  const [extra, setExtra] = useState<{ title: string; text: string; ai?: boolean } | null>(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [small, setSmall] = useState(false)
  const last = useRef(script.text)
  useEffect(() => { if (last.current !== script.text) { last.current = script.text; setExtra(null) } }, [script.text])

  const shown = extra ? extra.text : script.text
  const typed = useTyped(shown)
  const group = GROUP[beat]
  const used = hintRung[group] ?? 0
  const canAsk = !!sessionId && beat !== 'call' && beat !== 'closed'

  async function ask(rung: number, message: string) {
    if (!sessionId) return
    setBusy(true)
    try {
      const r = await api.partner(sessionId, beat, rung, message)
      addChat({ q: message || RUNG[rung - 1], a: r.text, source: r.source, beat }, group, message ? used : rung)
      setExtra({ title: message || RUNG[rung - 1], text: r.text, ai: r.source === 'ai' })
      setQ('')
    } catch (e) {
      setExtra({ title: 'Hmm', text: e instanceof Error ? e.message : 'I lost my train of thought. Try again.' })
    }
    setBusy(false)
  }

  if (small) {
    return <button className="guide-min" onClick={() => setSmall(false)} aria-label="Show Kenyalang, your guide"><Bird size={34} /> Need help?</button>
  }
  const next = Math.min(3, used + 1)
  return (
    <aside className={`guide ${idle && gs.win === null ? 'nudge' : ''}`} aria-label="Kenyalang, your guide">
      <div className="guide-bird"><Bird size={56} /></div>
      <div className="guide-body">
        <header>
          <strong>Kenyalang</strong><span className="muted"> · your partner</span>
          <button className="guide-x" onClick={() => setSmall(true)} aria-label="Hide the guide">–</button>
        </header>
        {extra && <p className="guide-q">{extra.title}</p>}
        <p className="guide-say" aria-live="polite">{typed}{extra?.ai && typed.length >= shown.length && <span className="ai-tag">AI</span>}</p>
        <div className="guide-row">
          {extra && <button onClick={() => setExtra(null)}>↩ What do I do now?</button>}
          {script.words.map((w) => (
            <button key={w} className="chip" onClick={() => setExtra({ title: `What does “${w}” mean?`, text: GLOSSARY[w] })}>{w}?</button>
          ))}
          {canAsk && <button disabled={busy || used >= 3} onClick={() => ask(next, '')}>{used >= 3 ? 'No more hints here' : `💡 ${RUNG[next - 1]} (${next}/3)`}</button>}
        </div>
        {canAsk && (
          <form className="guide-row" onSubmit={(e) => { e.preventDefault(); if (q.trim()) ask(Math.max(1, used), q.trim()) }}>
            <input value={q} maxLength={300} onChange={(e) => setQ(e.target.value)} placeholder="Ask me anything about this case…" aria-label="Ask Kenyalang" />
            <button disabled={busy || !q.trim()}>{busy ? '…' : 'Ask'}</button>
          </form>
        )}
      </div>
    </aside>
  )
}

/** A small drawn hornbill head (no image files). */
function Bird({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className="bird">
      <circle cx="26" cy="36" r="17" fill="#141414" />
      <path d="M36 30 Q58 30 62 44 Q48 42 38 42 Z" fill="#f1e3b5" />
      <path d="M30 22 Q46 8 56 18 Q46 20 40 30 Z" fill="#e2571e" />
      <path d="M50 14 Q57 12 58 19 Q54 18 51 19 Z" fill="#f6c700" />
      <circle cx="29" cy="32" r="4.5" fill="#fff" /><circle className="pupil" cx="30" cy="32" r="2.2" fill="#c8102e" />
      <path d="M12 46 Q20 60 34 52 Q22 52 16 44 Z" fill="#efe9dc" />
    </svg>
  )
}
