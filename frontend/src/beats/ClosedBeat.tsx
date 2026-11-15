// Beat 7, Case Closed: the Chief's stamp, the grade, badges and feedback.
// AI-assisted: written with Claude Code.
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Badge, ChiefNote } from '../api/types'
import { useSession } from '../state/session'
import { CaseReport, type ReportKind } from './CaseReport'

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

/** One request per attempt, even if the component mounts twice; one quiet retry if the first comes back empty. */
const asked = new Map<string, Promise<ChiefNote | null>>()
function fetchNote(sid: string, attempt: number) {
  const k = `${sid}:${attempt}`
  if (!asked.has(k)) {
    const once = () => api.chief(sid).catch(() => null)
    asked.set(k, once().then((n) => n?.chief_note ? n : new Promise<ChiefNote | null>((ok) => setTimeout(() => once().then(ok), 3000))))
  }
  return asked.get(k)!
}

/** The grade arrives at once (it is code); the Chief's wording follows when the model is done. */
function useChiefNote() {
  const { grade: g, sessionId, setGrade } = useSession()
  const [done, setDone] = useState<number | null>(null)   // attempt whose note has been asked for
  const attempt = g?.attempt ?? null
  const want = !!g && !g.chief_note && !!sessionId && done !== attempt
  useEffect(() => {
    if (!want || attempt === null) return
    let live = true
    fetchNote(sessionId!, attempt)
      .then((n) => {
        const cur = useSession.getState().grade
        if (live && n?.chief_note && cur && cur.attempt === n.attempt) setGrade({ ...cur, chief_note: n.chief_note })
      })                                                   // no note: the code's feedback still shows
      .finally(() => { if (live) setDone(attempt) })
    return () => { live = false }
  }, [want, attempt, sessionId, setGrade])
  return want   // true while the Chief is still writing
}

export function ClosedBeat({ onRetry, onShelf }: { onRetry: () => void; onShelf: () => void }) {
  const { grade: g, activeCase: c, sessionId } = useSession()
  const writing = useChiefNote()
  const [report, setReport] = useState<ReportKind | null>(null)
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
      {!g.chief_note && writing && <p className="chief-note writing" role="status">The Chief is writing you a note…</p>}
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
      {!g.can_retry && sessionId && (
        <div className="report-actions">
          <h3>Keep your work</h3>
          <button onClick={() => setReport('study')}>🗂 My case study (print or PDF)</button>
          <button onClick={() => setReport('summary')}>📄 Executive summary</button>
        </div>
      )}
      {report && sessionId && <CaseReport sid={sessionId} kind={report} onClose={() => setReport(null)} />}
      {g.can_retry
        ? <button className="primary" onClick={onRetry}>Revise my verdict</button>
        : <button className="primary" onClick={onShelf}>File it on the shelf</button>}
    </section>
  )
}
