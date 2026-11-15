// The wire desk: what the agency's agents, its code and its human editor have been doing.
// Shows the mechanism behind the system: who finds a case, who checks it, who does the maths,
// and where a person must say yes. Lines come from the backend's activity log (wording and
// counts only). Shared by the 3D office and lite mode.
// AI-assisted: written with Claude Code.
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Agency as AgencyT, AgencyEvent } from '../api/types'

const ICON: Record<string, string> = {
  Scout: '🔭', 'Data desk': '🛰️', 'Case Builder': '🗂️', Editor: '🧑‍💼', Partner: '🦜', Chief: '🎖️', Grader: '⚖️',
}
const BY: Record<AgencyEvent['by'], string> = { ai: 'AI', code: 'Code', human: 'Human' }

function when(at: string) {
  const d = new Date(at)
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`
  return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', timeZone: 'Asia/Kuching' })
}

export function Agency() {
  const [a, setA] = useState<AgencyT | null>(null)
  const [err, setErr] = useState('')
  const [only, setOnly] = useState<'all' | AgencyEvent['by']>('all')
  useEffect(() => {
    let live = true
    const load = () => api.agency().then((x) => { if (live) { setA(x); setErr('') } }).catch(() => live && setErr('The wire is quiet: the agency line did not answer.'))
    load()
    const t = setInterval(load, 15000)
    return () => { live = false; clearInterval(t) }
  }, [])

  if (err && !a) return <p className="error">{err}</p>
  if (!a) return <p className="muted">Reading the wire…</p>
  const events = a.events.filter((e) => only === 'all' || e.by === only)
  return (
    <section className="beat agency">
      <p>The agency never sleeps. Here is who does what behind the scenes. Notice the pattern: <strong>AI writes words</strong>,{' '}
        <strong>code does every number</strong>, and <strong>a person decides</strong> what students see.</p>

      <ol className="pipeline" aria-label="How a new case is made">
        {a.steps.map((s, i) => (
          <li key={s.name}>
            <span className="pipe-no">{i + 1}</span>
            <strong>{s.name}</strong>
            <span className="pipe-by">{s.by.split(' + ').map((b) => <i key={b} className={`by by-${b.toLowerCase()}`}>{b}</i>)}</span>
            <small>{s.does}</small>
          </li>
        ))}
      </ol>

      <dl className="agency-counts">
        <div><dt>Cases open</dt><dd>{a.counts.open}</dd></div>
        <div><dt>Drafts waiting for the editor</dt><dd>{a.counts.waiting}</dd></div>
        <div><dt>Next scan</dt><dd className="small">{a.schedule}</dd></div>
      </dl>

      <div className="seg" role="group" aria-label="Show lines written by">
        {(['all', 'ai', 'code', 'human'] as const).map((k) => (
          <button key={k} className={only === k ? 'on' : ''} onClick={() => setOnly(k)}>{k === 'all' ? 'Everything' : BY[k]}</button>
        ))}
      </div>
      <ul className="wire" aria-live="polite">
        {events.length === 0 && <li className="muted">Nothing on the wire yet. The Scout's next scan will show here.</li>}
        {events.map((e, i) => (
          <li key={e.at + i} className={`wire-${e.by}`}>
            <span className="wire-icon" aria-hidden="true">{ICON[e.agent] ?? '•'}</span>
            <div>
              <header><strong>{e.agent}</strong><i className={`by by-${e.by}`}>{BY[e.by]}</i><time dateTime={e.at}>{when(e.at)}</time></header>
              <p>{e.text}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="source">The wire shows wording and counts only: no student's words, no answer key, and nothing from a case a human has not approved.
        News comes from public feeds (headline, link and date only). NASA data is read from saved files, never fetched while you work.</p>
    </section>
  )
}
