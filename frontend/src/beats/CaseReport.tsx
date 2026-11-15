// The case study and the executive summary of a closed case, as printable documents.
// "Print or save as PDF" uses the browser's own print dialog (Save as PDF), so nothing extra is
// downloaded. Everything shown comes from GET /sessions/{id}/casefile (built by code from the
// session) and, for the summary, POST /sessions/{id}/summary (the Reporter agent, guarded).
// AI-assisted: written with Claude Code.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../api/client'
import type { CaseFile, ExecSummary } from '../api/types'

export type ReportKind = 'study' | 'summary'

const myt = (iso: string) => new Date(iso).toLocaleString('en-MY', { timeZone: 'Asia/Kuching', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-MY', { timeZone: 'Asia/Kuching', hour: '2-digit', minute: '2-digit' })
const words = (s: string) => s.replace(/_/g, ' ')
const BADGE: Record<string, string> = {
  clean_signal: 'Clean Signal', red_herring: 'Red Herring', honest_doubt: 'Honest Doubt',
  second_opinion: 'Second Opinion', twin_trail: 'Twin Trail', elnino_eye: 'El Niño Eye',
}

function Head({ f, title }: { f: CaseFile; title: string }) {
  return (
    <header className="doc-head">
      <img src="/brand/logo-128.webp" width="64" height="64" alt="" />
      <div>
        <p className="doc-kicker">Sarawak Earth Detectives · {title}</p>
        <h1>Case {f.case.id}: {f.case.title}</h1>
        <p className="doc-meta">Detective <strong>{f.detective}</strong> · {f.case.region} · {myt(f.started)} to {myt(f.finished)} (Sarawak time)</p>
      </div>
    </header>
  )
}

function Study({ f }: { f: CaseFile }) {
  const v = f.verdict
  return (
    <>
      <Head f={f} title="Case study" />
      <section><h2>1. The question</h2><p className="doc-q">{f.case.question}</p><p>{f.case.brief}</p></section>
      <section>
        <h2>2. The evidence chosen</h2>
        <table><thead><tr><th>Record</th><th>What it measures</th><th>Source</th></tr></thead>
          <tbody>{f.evidence.map((e) => <tr key={e.name}><td>{e.name}</td><td>{e.definition}</td><td className="mono">{e.mission}</td></tr>)}</tbody></table>
        <p className="doc-small">Map pins inspected at the scene: {f.pins}.</p>
      </section>
      <section>
        <h2>3. The investigation, step by step</h2>
        <ol className="doc-trail">{f.steps.map((s, i) => (
          <li key={i}><span className="mono">{time(s.at)}</span><b>{s.stage}</b><span>{s.what}</span></li>
        ))}</ol>
      </section>
      <section>
        <h2>4. The tests</h2>
        {f.tests.length === 0 ? <p>No tests were run.</p> : (
          <table className="doc-tests"><thead><tr><th>Record</th><th>Tool</th><th>Rate of change</th><th>95% range</th><th>t-test p</th><th>Mann-Kendall p</th><th>Stamp</th></tr></thead>
            <tbody>{f.tests.map((t, i) => (
              <tr key={i}><td>{t.card}</td><td>{t.tool}</td>
                <td className="mono">{t.rate ? `${t.rate} ${t.unit ?? ''}` : '—'}</td>
                <td className="mono">{t.range ? `${t.range[0]} to ${t.range[1]}` : '—'}</td>
                <td className="mono">{t.t_test_p ?? '—'}</td><td className="mono">{t.mann_kendall_p ?? '—'}</td>
                <td>{t.stamp ?? (t.elnino_r ? `El Niño r ${t.elnino_r}` : '—')}{t.years_needed ? ` (needs ${t.years_needed} years)` : ''}</td></tr>
            ))}</tbody></table>
        )}
        <p className="doc-small">Every number was computed by the statistics code from {[...new Set(f.tests.map((t) => t.mission).filter(Boolean))].join(', ') || 'NASA records'}{f.tests[0]?.data_as_of ? `, data to ${f.tests[0].data_as_of}` : ''}. AI did no maths.</p>
      </section>
      {f.partner.length > 0 && (
        <section>
          <h2>5. Questions to Kenyalang</h2>
          <dl className="doc-chat">{f.partner.map((p, i) => <div key={i}><dt>{p.q}</dt><dd>{p.a} <small>({p.by})</small></dd></div>)}</dl>
        </section>
      )}
      <section>
        <h2>{f.partner.length > 0 ? 6 : 5}. The verdict</h2>
        {v ? (
          <dl className="doc-verdict">
            <dt>What</dt><dd>{v.what}</dd><dt>Where</dt><dd>{v.where}</dd>
            <dt>Direction</dt><dd>{words(v.direction)}</dd><dt>How much</dt><dd>{v.how_much}</dd>
            <dt>Is it real?</dt><dd>{words(v.is_it_real)}</dd><dt>Why</dt><dd>{v.why_hypothesis}</dd>
            <dt>Confidence</dt><dd>{v.confidence} of 3</dd>
          </dl>
        ) : <p>No verdict.</p>}
      </section>
      <section className="doc-outcome">
        <h2>{f.partner.length > 0 ? 7 : 6}. The Chief's stamp</h2>
        <p className="doc-stamp">{f.grade.ending}</p>
        <p><strong className="doc-score">{f.grade.score}</strong>/100 after {f.attempts} attempt{f.attempts > 1 ? 's' : ''} ·
          evidence {f.grade.parts.evidence}/25 · method {f.grade.parts.method}/25 · verdict {f.grade.parts.verdict}/30 · explanation {f.grade.parts.explanation}/20</p>
        {f.grade.chief_note && <blockquote>{f.grade.chief_note} <small>(worded by AI from the code's grade)</small></blockquote>}
        <ul>{f.grade.feedback.map((x) => <li key={x}>{x}</li>)}</ul>
        {f.grade.badges.length > 0 && <p>Badges: {f.grade.badges.map((b) => BADGE[b] ?? b).join(' · ')}</p>}
      </section>
      <section>
        <h2>Limits and sources</h2>
        <ul>{f.case.limits.map((l) => <li key={l}>{l}</li>)}</ul>
        <ul className="doc-small">{f.case.sources.map((s) => <li key={s.title}>{s.title}{s.date ? `, ${s.date}` : ''}{s.url ? ` · ${s.url}` : ''}</li>)}</ul>
      </section>
    </>
  )
}

function Summary({ f, s }: { f: CaseFile; s: ExecSummary }) {
  const rows: [keyof ExecSummary['sections'], string][] = [['purpose', 'Purpose'], ['method', 'Method'], ['findings', 'Findings'], ['conclusion', 'Conclusion'], ['limitations', 'Limitations']]
  return (
    <>
      <Head f={f} title="Executive summary" />
      <dl className="doc-memo">
        <dt>Case</dt><dd>{f.case.id}, {f.case.title}</dd>
        <dt>Outcome</dt><dd>{f.grade.ending} · {f.grade.score}/100</dd>
        <dt>Prepared by</dt><dd>{s.source === 'ai' ? 'The Reporter agent (AI), from the statistics code’s facts sheet; every figure checked by the number guard' : 'The case desk’s code template'}</dd>
      </dl>
      {rows.map(([k, label]) => <section key={k}><h2>{label}</h2><p>{s.sections[k]}</p></section>)}
    </>
  )
}

export function CaseReport({ sid, kind, onClose }: { sid: string; kind: ReportKind; onClose: () => void }) {
  const [f, setF] = useState<CaseFile | null>(null)
  const [s, setS] = useState<ExecSummary | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let live = true
    api.casefile(sid).then((x) => { if (live) { setF(x); if (x.summary) setS(x.summary) } }).catch((e) => live && setErr(e instanceof Error ? e.message : 'Could not open the case file.'))
    return () => { live = false }
  }, [sid])
  useEffect(() => {
    if (kind !== 'summary' || !f || s) return
    let live = true
    api.summary(sid).then((x) => live && setS(x)).catch((e) => live && setErr(e instanceof Error ? e.message : 'The Reporter is busy.'))
    return () => { live = false }
  }, [kind, f, s, sid])
  useEffect(() => {
    document.body.classList.add('printing-report')
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => { document.body.classList.remove('printing-report'); window.removeEventListener('keydown', esc) }
  }, [onClose])
  const ready = f && (kind === 'study' || s)
  return createPortal(
    <div className="report-overlay" role="dialog" aria-modal="true" aria-label={kind === 'study' ? 'Case study' : 'Executive summary'}>
      <div className="report-toolbar">
        <button className="primary" disabled={!ready} onClick={() => window.print()}>🖨 Print or save as PDF</button>
        <button onClick={onClose}>Close</button>
        <small>In the print window, choose “Save as PDF” to keep a file.</small>
      </div>
      <article className="report-doc">
        {err && <p className="error">{err}</p>}
        {!err && !ready && <p className="muted" role="status">{kind === 'summary' && f ? 'The Reporter is writing the summary…' : 'Opening the case file…'}</p>}
        {f && kind === 'study' && <Study f={f} />}
        {f && kind === 'summary' && s && <Summary f={f} s={s} />}
        {ready && <footer className="doc-foot">Sarawak Earth Detectives · NASA Space Apps 2026 · Data: NASA POWER (MERRA-2), NASA GIBS (VIIRS), NOAA ONI · Numbers come from statistics code, not AI.</footer>}
      </article>
    </div>,
    document.body,
  )
}
