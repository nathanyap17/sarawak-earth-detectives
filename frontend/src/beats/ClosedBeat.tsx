// Beat 7, Case Closed: the Chief's stamp, the grade, badges and feedback.
// AI-assisted: written with Claude Code.
import type { Badge } from '../api/types'
import { useSession } from '../state/session'

const BADGES: Record<Badge, [string, string]> = {
  clean_signal: ['Clean Signal', 'Removed the seasons before testing'],
  red_herring: ['Red Herring', 'Rejected irrelevant evidence'],
  honest_doubt: ['Honest Doubt', 'Correctly said the record can’t settle it'],
  second_opinion: ['Second Opinion', 'Weighed more than one record'],
  twin_trail: ['Twin Trail', 'Compared two regions'],
  elnino_eye: ['El Niño Eye', 'Checked the El Niño effect'],
}
const ENDING = {
  solved: 'Case closed: solved',
  solved_not_enough: 'Case closed: solved — not enough evidence',
  sent_back: 'Sent back by the Chief',
}

export function ClosedBeat({ onRetry, onShelf }: { onRetry: () => void; onShelf: () => void }) {
  const { grade: g, activeCase: c } = useSession()
  if (!g) return null
  return (
    <section className="beat">
      <p className={`chief-stamp ${g.ending}`} role="status">{ENDING[g.ending]}</p>
      <h2>{c!.title}</h2>
      <p className="score">{g.score}<small>/100</small></p>
      <dl className="parts">
        <dt>Evidence choice</dt><dd>{g.parts.evidence} / 25</dd>
        <dt>Method</dt><dd>{g.parts.method} / 25</dd>
        <dt>Verdict</dt><dd>{g.parts.verdict} / 30</dd>
        <dt>Explanation</dt><dd>{g.parts.explanation} / 20</dd>
      </dl>
      {g.chief_note && <blockquote className="chief-note">{g.chief_note}<span className="ai-tag">Worded by AI from the code's grade</span></blockquote>}
      <h3>The Chief's notes</h3>
      <ul className="feedback">{g.feedback.map((f, i) => <li key={i}>{f}</li>)}</ul>
      {g.badges.length > 0 && (
        <>
          <h3>Badges</h3>
          <ul className="badges">{g.badges.map((b) => (
            <li key={b}><strong>{BADGES[b][0]}</strong><span>{BADGES[b][1]}</span></li>
          ))}</ul>
        </>
      )}
      <h3>Limits of this case</h3>
      <ul className="limits">{c!.limits.map((l) => <li key={l}>{l}</li>)}</ul>
      {g.can_retry
        ? <button className="primary" onClick={onRetry}>Revise my verdict</button>
        : <button className="primary" onClick={onShelf}>File it on the shelf</button>}
    </section>
  )
}
