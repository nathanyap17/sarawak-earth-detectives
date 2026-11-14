// Beat 4, The Board: each pinned card flips to show its record over time.
// AI-assisted: written with Claude Code.
import { useState } from 'react'
import { api, logQuiet } from '../api/client'
import { useSession } from '../state/session'
import { MissionBadge, TimeChart } from './shared'

export function BoardBeat({ onDone }: { onDone: () => void }) {
  const { activeCase: c, sessionId, chosen, series, putSeries, opened, markOpened } = useSession()
  const [view, setView] = useState<Record<string, 'yearly' | 'monthly'>>({})
  const [err, setErr] = useState<string | null>(null)

  async function open(id: string) {
    try {
      if (!series[id]) putSeries(await api.series(c!.id, id))
      markOpened(id)
      logQuiet(sessionId, { kind: 'open_card', card_id: id })
    } catch (e) { setErr((e as Error).message) }
  }

  const cards = c!.evidence.filter((e) => chosen.includes(e.id))
  return (
    <section className="beat">
      <h2>The Board</h2>
      <p>Flip each card to see its record. Look for patterns before you test anything.</p>
      {err && <p className="error">{err}</p>}
      <div className="board">
        {cards.map((e) => {
          const s = series[e.id]
          const v = view[e.id] ?? 'yearly'
          return (
            <article key={e.id} className={`pinned ${opened.includes(e.id) ? 'open' : ''}`}>
              <header><strong>{e.name}</strong> <small>({e.unit}, {e.yearly_label})</small></header>
              {!s ? (
                <button className="flip" onClick={() => open(e.id)}>Flip card</button>
              ) : (
                <>
                  <div className="seg">
                    <button className={v === 'yearly' ? 'on' : ''} onClick={() => setView({ ...view, [e.id]: 'yearly' })}>Each year</button>
                    <button className={v === 'monthly' ? 'on' : ''} onClick={() => setView({ ...view, [e.id]: 'monthly' })}>Each month</button>
                  </div>
                  <TimeChart unit={e.unit} zoom={v === 'monthly'}
                    lines={[{ name: e.name, points: v === 'yearly' ? s.yearly.map((p) => [p.y, p.v]) : s.monthly.map((p) => [p.t, p.v]) }]}
                    summary={`${e.name}, ${v} values from ${s.yearly[0]?.y} to ${s.yearly.at(-1)?.y}.`} />
                  <MissionBadge mission={e.mission} asOf={s.data_as_of} definition={e.definition} />
                </>
              )}
            </article>
          )
        })}
      </div>
      <button className="primary" disabled={!cards.every((e) => opened.includes(e.id))} onClick={onDone}>
        Take them to the Lab
      </button>
    </section>
  )
}
