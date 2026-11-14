// The inbox: happenings (real events open for investigation) and learnt cases (solved, kept in
// this browser). Each case shows the four things the challenge asks a detective to do.
// AI-assisted: written with Claude Code.
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { CasePublic } from '../api/types'
import { useSession } from '../state/session'
import { stampedCount } from './script'
import { loadLearnt } from './learnt'
import { useUI } from './ui'

const STEPS = [
  ['Select variables', 'Choose which Earth measurements could answer the question'],
  ['See change over time', 'Open each record and look at how it moved over the years'],
  ['What, where, how much', 'Measure the change for the region with the ruler or the scales'],
  ['Is it significant?', 'Weigh the trend against chance, with and without El Niño'],
] as const

export function Inbox() {
  const { activeCase, chosen, opened, results, grade, beat } = useSession()
  const setWin = useUI((u) => u.setWin)
  const [cases, setCases] = useState<CasePublic[] | null>(null)
  const [err, setErr] = useState('')
  const learnt = loadLearnt()
  useEffect(() => { api.cases().then(setCases).catch(() => setErr('The agency line is down. Is the backend running?')) }, [])

  const measured = chosen.some((id) => results[id]?.ruler || results[id]?.scales)
  const done = [chosen.length >= 3, opened.length >= 1, measured, stampedCount(results, chosen) >= 1]

  return (
    <section className="beat inbox">
      <h3>Happenings</h3>
      {err && <p className="error">{err}</p>}
      {!cases && !err && <p className="muted">Sorting the mail…</p>}
      {cases?.map((c) => {
        const mine = activeCase?.id === c.id
        const solved = learnt.some((l) => l.id === c.id)
        return (
          <article key={c.id} className={`mail ${mine ? 'mine' : ''}`}>
            <header>
              <span className="mail-type">{c.type}</span>
              <strong>Case {c.id}: {c.title}</strong>
              <span className={`mail-state ${mine ? 'now' : solved ? 'ok' : 'new'}`}>{mine ? (grade ? 'Filed' : 'In progress') : solved ? 'Solved' : 'New'}</span>
            </header>
            <p className="mail-q">{c.question}</p>
            {c.sources[0] && <p className="source">In the news: {c.sources[0].title} ({c.sources[0].date})</p>}
            <ol className="verbs">
              {STEPS.map(([name, what], i) => (
                <li key={name} className={mine && done[i] ? 'done' : ''}><span aria-hidden="true">{mine && done[i] ? '✔' : i + 1}</span>
                  <div><strong>{name}</strong><small>{what}</small></div></li>
              ))}
            </ol>
            <button className="primary" onClick={() => setWin(mine ? beat : 'call')}>{mine ? (grade ? "See the Chief's stamp" : 'Continue the case') : 'Open the case folder'}</button>
          </article>
        )
      })}
      <h3>Learnt cases</h3>
      {learnt.length === 0 && <p className="muted">Nothing filed yet. Solved cases land here with what you practised.</p>}
      {learnt.map((l) => (
        <article key={l.id + l.date} className="mail learnt">
          <header><strong>Case {l.id}: {l.title}</strong><span className="mail-state ok">{l.score}/100</span></header>
          <p className="mail-q">{l.ending} · {l.date}</p>
          <ul className="practised">
            <li><strong>Variables selected:</strong> {l.variables.join(', ')}</li>
            <li><strong>Change over time:</strong> looked at each record across the years</li>
            <li><strong>Tools used:</strong> {l.tools.join(', ') || 'none'}</li>
            <li><strong>Your verdict:</strong> {l.verdict}</li>
          </ul>
        </article>
      ))}
    </section>
  )
}
