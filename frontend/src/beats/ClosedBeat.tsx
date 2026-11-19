// Beat 7, Case Closed: the Chief's stamp, the grade, how the reasoning was read, badges and feedback.
// A closed case wins a medal (gold, silver or bronze by score; ribbon by ending; a coloured gem per
// skill badge), a fanfare and a burst of confetti, and is filed on the 3D shelf (both modes).
// AI-assisted: written with Claude Code.
import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import type { ChiefNote, Grade } from '../api/types'
import { useSession } from '../state/session'
import { fanfare, sfx } from '../sound/audio'
import { saveLearnt } from '../office/learnt'
import { CaseReport, type ReportKind } from './CaseReport'
import { BADGES, RIBBON, TIER, tierOf } from './medal'
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

const TOOL: Record<string, string> = { magnifier: 'magnifier', season: 'season filter', ruler: 'ruler', scales: 'scales', elnino: 'El Niño lamp', twin: 'twin map' }

/** File a closed case under "Learnt cases" and on the shelf (this browser only). */
function file(g: Grade) {
  const st = useSession.getState(), c = st.activeCase
  if (!c || g.ending === 'sent_back') return
  const tools = [...new Set(Object.values(st.results).flatMap((r) => Object.keys(r ?? {})))].map((t) => TOOL[t] ?? t)
  saveLearnt({
    id: c.id, title: c.title, score: g.score,
    ending: g.ending === 'solved_not_enough' ? 'Solved: not enough evidence yet' : 'Solved',
    tier: tierOf(g.score), badges: g.badges, kind: g.ending,
    date: new Date().toISOString().slice(0, 10),
    variables: c.evidence.filter((e) => st.chosen.includes(e.id)).map((e) => e.name), tools,
    verdict: st.draft ? `${st.draft.direction.replace('_', ' ')}; is it real: ${{ yes: 'yes', no: 'no', cant_tell: "can't tell" }[st.draft.is_it_real]}` : '',
  })
}

function Confetti({ colours }: { colours: string[] }) {
  const bits = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    left: (i * 37) % 100, delay: ((i * 13) % 10) / 14, dur: 1.6 + ((i * 7) % 5) / 5,
    rot: (i * 47) % 360, colour: colours[i % colours.length], drift: ((i * 29) % 40) - 20,
  })), [colours])
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b, i) => <i key={i} style={{ left: `${b.left}%`, background: b.colour, animationDelay: `${b.delay}s`,
        animationDuration: `${b.dur}s`, ['--rot' as string]: `${b.rot}deg`, ['--drift' as string]: `${b.drift}px` }} />)}
    </div>
  )
}

export function ClosedBeat({ onRetry, onShelf }: { onRetry: () => void; onShelf: () => void }) {
  const { grade: g, activeCase: c, sessionId } = useSession()
  const writing = useChiefNote()
  const [report, setReport] = useState<ReportKind | null>(null)
  const stamped = g ? `${sessionId}:${g.attempt}` : null
  useEffect(() => {          // the Chief's stamp lands; a closed case wins its medal, a fanfare and a place on the shelf
    if (!stamped || !g) return
    sfx('stamp')
    if (g.ending === 'sent_back') return
    file(g)
    const t = setTimeout(() => fanfare(tierOf(g.score)), 420)
    return () => clearTimeout(t)
  }, [stamped]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!g) return null
  const closed = g.ending !== 'sent_back'
  const tier = TIER[tierOf(g.score)]
  const ribbon = closed ? RIBBON[g.ending as keyof typeof RIBBON] : null
  return (
    <section className="beat">
      {closed && <Confetti key={`confetti-${stamped}`} colours={[tier.metal, ribbon!.colour, ...g.badges.map((b) => BADGES[b].colour)]} />}
      <p className={`chief-stamp ${g.ending}`} role="status">{ENDING[g.ending]}</p>
      <h2>{c!.title}</h2>
      {closed && ribbon && (
        <div className={`medal-award tier-${tierOf(g.score)}`} key={`medal-${stamped}`}>
          <div className="medal" aria-hidden="true" style={{ ['--metal' as string]: tier.metal, ['--shine' as string]: tier.shine, ['--ribbon' as string]: ribbon.colour }}>
            <span className="ribbon" /><span className="disc"><b>{g.score}</b></span>
          </div>
          <div>
            <strong>{tier.name} medal: {tier.title}</strong>
            <small>{ribbon.words} · filed on your case shelf</small>
            {g.badges.length > 0 && <span className="gems">{g.badges.map((b) => <i key={b} title={BADGES[b].name} style={{ background: BADGES[b].colour }} />)}</span>}
          </div>
        </div>
      )}
      <p className="score">{g.score}<small>/100</small></p>
      <dl className="parts">
        <dt>Evidence choice</dt><dd>{g.parts.evidence} / 25</dd>
        <dt>Method</dt><dd>{g.parts.method} / 25</dd>
        <dt>Verdict</dt><dd>{g.parts.verdict} / 30</dd>
        <dt>Explanation</dt><dd>{g.parts.explanation} / 20</dd>
      </dl>
      {!g.chief_note && writing && <p className="chief-note writing" role="status">The Chief is writing you a note…</p>}
      {g.chief_note && <blockquote className="chief-note">{g.chief_note}<span className="ai-tag">Worded by AI from the code's grade</span></blockquote>}
      {g.checks && g.checks.length > 0 && (
        <>
          <h3>How your reasoning was read</h3>
          <ul className="checks">{g.checks.map((ck) => (
            <li key={ck.id} className={ck.ok ? 'ok' : 'bad'}><span aria-hidden="true">{ck.ok ? '✔' : '✘'}</span>
              <div><strong>{ck.label}</strong><small>{ck.detail}</small></div></li>
          ))}</ul>
        </>
      )}
      <h3>The Chief's notes</h3>
      <ul className="feedback">{g.feedback.map((f, i) => <li key={i}>{f}</li>)}</ul>
      {g.badges.length > 0 && (
        <>
          <h3>Badges</h3>
          <ul className="badges">{g.badges.map((b) => (
            <li key={b} style={{ ['--badge' as string]: BADGES[b].colour }}><strong>{BADGES[b].name}</strong><span>{BADGES[b].what}</span></li>
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
