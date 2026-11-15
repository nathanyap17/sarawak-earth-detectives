// Kenyalang, the hornbill Partner, as a live guide: it says what to do now (scripted, typed out
// letter by letter), explains words from a vetted glossary, and passes hints and questions to
// the backend Partner, whose replies are guarded so they never give the answer.
// While the Partner thinks, the bubble says so; if a reply had to be swapped for an approved hint
// (it broke a rule, or the model was slow), the bubble says that too, so no question vanishes.
// AI-assisted: written with Claude Code.
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { partnerNote } from '../beats/partnerNote'
import { useSession } from '../state/session'
import { HoldToTalk } from '../beats/HoldToTalk'
import { GLOSSARY, say } from './script'
import { useGuideState } from './useGuideState'
import { useUI } from './ui'

const GROUP: Record<string, string> = {
  call: 'evidence', scene: 'evidence', locker: 'evidence', board: 'method', lab: 'method', deduction: 'verdict', closed: 'verdict',
}
const RUNG = ['Give me a nudge', 'Point me somewhere', 'Show me an example']

interface Bubble { id: number; title: string; text: string; ai?: boolean; note?: string }

/** Types `text` out two letters at a time. A new `id` restarts it, even for the same words. */
function useTyped(text: string, id: string) {
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [st, setSt] = useState({ id, n: reduce ? text.length : 0 })
  if (st.id !== id) setSt({ id, n: reduce ? text.length : 0 })   // reset during render, not in an effect
  useEffect(() => {
    if (reduce) return
    const t = setInterval(() => setSt((s) => (s.n >= text.length ? (clearInterval(t), s) : { ...s, n: s.n + 2 })), 18)
    return () => clearInterval(t)
  }, [id, text, reduce])
  return text.slice(0, st.id === id ? st.n : 0)
}

let seq = 1

export function Guide() {
  const gs = useGuideState()
  const idle = useUI((u) => u.idle)
  const { sessionId, beat, hintRung, addChat, chat, grade } = useSession()
  const script = say(gs)
  const [extra, setExtra] = useState<Bubble | null>(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string | null>(null)   // the question being thought about
  const [small, setSmall] = useState(false)
  const [scriptId, setScriptId] = useState(0)

  // Moving to another object or step shows that step's line; pins, cards and stamps don't wipe a reply.
  const place = `${gs.win}|${gs.beat}`
  const [lastPlace, setLastPlace] = useState(place)
  if (lastPlace !== place) { setLastPlace(place); setExtra(null); setScriptId((n) => n + 1) }

  const thinking: Bubble | null = busy ? { id: -1, title: busy, text: 'Hmm, let me think about that…' } : null
  const bubble = thinking ?? extra
  const shown = bubble ? bubble.text : script.text
  const typed = useTyped(shown, bubble ? `b${bubble.id}` : `s${scriptId}:${script.text}`)
  const group = GROUP[beat]
  const used = hintRung[group] ?? 0
  const canAsk = !!sessionId && beat !== 'call' && (beat !== 'closed' || !!grade?.can_retry)
  const answers = chat.filter((c) => c.a).slice(0, -1).reverse()   // the latest one is in the bubble

  async function ask(rung: number, message: string) {
    if (!sessionId || busy) return
    const title = message || RUNG[rung - 1]
    setBusy(title)
    try {
      const r = await api.partner(sessionId, beat, rung, message)
      const note = partnerNote(r, !!message)
      addChat({ q: title, a: r.text, source: r.source, beat, note }, group, message ? used : rung)
      setExtra({ id: seq++, title, text: r.text, ai: r.source === 'ai', note })
      setQ('')
    } catch (e) {
      const why = e instanceof Error ? e.message : 'I lost my train of thought.'
      setExtra({ id: seq++, title, text: `${why} ${message ? 'Your question is still in the box, so you can send it again.' : 'Press the hint button again.'}` })
    } finally {
      setBusy(null)
    }
  }

  if (small) {
    return <button className="guide-min" onClick={() => setSmall(false)} aria-label="Show Kenyalang, your guide"><Bird size={34} /> Need help?</button>
  }
  const next = Math.min(3, used + 1)
  return (
    <aside className={`guide ${idle && gs.win === null ? 'nudge' : ''} ${busy ? 'thinking' : ''}`} aria-label="Kenyalang, your guide" aria-busy={!!busy}>
      <div className="guide-bird"><Bird size={56} /></div>
      <div className="guide-body">
        <header>
          <strong>Kenyalang</strong><span className="muted"> · your partner</span>
          <button className="guide-x" onClick={() => setSmall(true)} aria-label="Hide the guide">–</button>
        </header>
        {bubble && <p className="guide-q">{bubble.title}</p>}
        {bubble?.note && <p className="guide-note">{bubble.note}</p>}
        <p className="guide-say" aria-live="polite">{typed}{bubble?.ai && typed.length >= shown.length && <span className="ai-tag">AI</span>}</p>
        <div className="guide-row">
          {extra && !busy && <button onClick={() => { setExtra(null); setScriptId((n) => n + 1) }}>↩ What do I do now?</button>}
          {script.words.map((w) => (
            <button key={w} className="chip" onClick={() => setExtra({ id: seq++, title: `What does “${w}” mean?`, text: GLOSSARY[w] })}>{w}?</button>
          ))}
          {canAsk && <button disabled={!!busy || used >= 3} onClick={() => ask(next, '')}>{used >= 3 ? 'No more hints here' : `💡 ${RUNG[next - 1]} (${next}/3)`}</button>}
        </div>
        {canAsk && (
          <form className="guide-row" onSubmit={(e) => { e.preventDefault(); if (q.trim()) ask(Math.max(1, used), q.trim()) }}>
            <input value={q} maxLength={300} onChange={(e) => setQ(e.target.value)} placeholder="Ask me anything about this case…" aria-label="Ask Kenyalang" />
            <button disabled={!!busy || !q.trim()}>{busy ? 'Thinking…' : 'Ask'}</button>
            <HoldToTalk disabled={!!busy} onText={setQ} onDone={(t) => ask(Math.max(1, used), t)} />
          </form>
        )}
        <details className="guide-log">
          <summary>📖 Word book ({Object.keys(GLOSSARY).length} words)</summary>
          <ul className="wordbook">{Object.keys(GLOSSARY).sort((a, b) => a.localeCompare(b)).map((w) => (
            <li key={w}><button className="chip" onClick={() => setExtra({ id: seq++, title: `What does “${w}” mean?`, text: GLOSSARY[w] })}>{w}</button></li>
          ))}</ul>
        </details>
        {answers.length > 0 && (
          <details className="guide-log">
            <summary>Earlier answers ({answers.length})</summary>
            <ul>{answers.map((c, i) => (
              <li key={i}><strong>{c.q}</strong> {c.a}{c.source === 'ai' && <span className="ai-tag">AI</span>}</li>
            ))}</ul>
          </details>
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
