// Beat 6, The Deduction: the student writes the verdict in their own words.
// The form says what is still missing (no silent disabled button), submits with Enter, and turns
// read-only once the case is filed, so a final verdict can't be sent twice.
// AI-assisted: written with Claude Code.
import { useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { caseFiled, useSession, type Draft } from '../state/session'

const MIN_WHAT = 4
const MIN_WHY = 15
const DIR = { worsening: 'Worsening', improving: 'Improving', no_change: 'No change' } as const
const REAL = { yes: 'Yes, it is significant', no: 'No, there is no real change', cant_tell: "Can't tell yet: not enough evidence" } as const

export function DeductionBeat({ onDone }: { onDone: () => void }) {
  const { activeCase: c, sessionId, setGrade, grade, draft, setDraft } = useSession()
  const [v, setV] = useState<Draft>(draft ?? {
    what: '', where: c!.region.name, direction: 'no_change', how_much: '',
    is_it_real: 'cant_tell', why_hypothesis: '', confidence: 2,
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [tried, setTried] = useState(false)
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV({ ...v, [k]: val })

  if (caseFiled(grade)) {
    return (
      <section className="beat typewriter">
        <h2>The Deduction</h2>
        <p className="caveat">This verdict is filed. The Chief has stamped the case, so it can't be changed.</p>
        {draft && <dl className="filed">
          <dt>What</dt><dd>{draft.what}</dd>
          <dt>Where</dt><dd>{draft.where}</dd>
          <dt>Which way</dt><dd>{DIR[draft.direction]}</dd>
          <dt>How much</dt><dd>{draft.how_much || '—'}</dd>
          <dt>Is it real?</dt><dd>{REAL[draft.is_it_real]}</dd>
          <dt>Why</dt><dd>{draft.why_hypothesis}</dd>
        </dl>}
        <button className="primary" onClick={onDone}>See the Chief's stamp</button>
      </section>
    )
  }

  const whatLeft = MIN_WHAT - v.what.trim().length
  const whyLeft = MIN_WHY - v.why_hypothesis.trim().length
  const missing = [
    whatLeft > 0 && 'say what is changing',
    whyLeft > 0 && `add ${whyLeft} more character${whyLeft === 1 ? '' : 's'} to "Why might it be?"`,
  ].filter(Boolean) as string[]

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    setTried(true)
    if (missing.length || busy) return
    setBusy(true); setErr(null)
    setDraft(v)
    try { setGrade(await api.verdict({ session_id: sessionId!, ...v })); onDone() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <form className="beat typewriter" onSubmit={submit} noValidate>
      <h2>The Deduction</h2>
      {grade?.can_retry && <p className="caveat">Second try: read the Chief's notes, then revise.</p>}
      <p className="question">{c!.question}</p>
      <label className="field">What is changing? <small className="muted">(required)</small>
        <input value={v.what} maxLength={400} onChange={(e) => set('what', e.target.value)} placeholder="e.g. how wet the soil is in the driest months"
          aria-invalid={tried && whatLeft > 0} />
        {tried && whatLeft > 0 && <small className="hint-bad">Write a few words about what you measured.</small>}
      </label>
      <label className="field">Where?
        <input value={v.where} maxLength={200} onChange={(e) => set('where', e.target.value)} />
      </label>
      <fieldset className="field"><legend>Which way?</legend>
        {(Object.keys(DIR) as (keyof typeof DIR)[]).map((d) => (
          <label key={d} className="radio"><input type="radio" checked={v.direction === d} onChange={() => set('direction', d)} />{DIR[d]}</label>
        ))}
      </fieldset>
      <label className="field">How much? (use the rate and range from your ruler, or say the record can't tell)
        <input value={v.how_much} maxLength={200} onChange={(e) => set('how_much', e.target.value)} placeholder="e.g. about 0.01 per decade" />
      </label>
      <fieldset className="field"><legend>Is it real?</legend>
        {(Object.keys(REAL) as (keyof typeof REAL)[]).map((k) => (
          <label key={k} className="radio"><input type="radio" checked={v.is_it_real === k} onChange={() => set('is_it_real', k)} />{REAL[k]}</label>
        ))}
      </fieldset>
      <label className="field">Why might it be? (a possibility, not a proof) <small className="muted">(required, at least {MIN_WHY} characters)</small>
        <textarea rows={3} maxLength={600} value={v.why_hypothesis} onChange={(e) => set('why_hypothesis', e.target.value)}
          aria-invalid={tried && whyLeft > 0} aria-describedby="why-count"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit() }} />
        <small id="why-count" className={whyLeft > 0 ? 'muted' : 'hint-ok'}>
          {whyLeft > 0 ? `${v.why_hypothesis.trim().length} / ${MIN_WHY} characters` : '✔ Long enough'}</small>
      </label>
      <label className="field">How sure are you?
        <input type="range" min={1} max={3} value={v.confidence} onChange={(e) => set('confidence', +e.target.value as 1 | 2 | 3)} />
        <output>{['', 'Not very', 'Fairly', 'Very'][v.confidence]}</output>
      </label>
      {err && <p className="error" role="alert">{err}</p>}
      {missing.length > 0 && <p className={tried ? 'error' : 'muted'} role={tried ? 'alert' : undefined}>Before you submit: {missing.join(', and ')}.</p>}
      <button className="primary" type="submit" disabled={busy} aria-disabled={missing.length > 0}>{busy ? 'Filing your verdict…' : 'Submit the verdict'}</button>
    </form>
  )
}
