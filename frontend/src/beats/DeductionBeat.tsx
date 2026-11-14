// Beat 6, The Deduction: the student writes the verdict in their own words.
// AI-assisted: written with Claude Code.
import { useState } from 'react'
import { api } from '../api/client'
import { useSession, type Draft } from '../state/session'

export function DeductionBeat({ onDone }: { onDone: () => void }) {
  const { activeCase: c, sessionId, setGrade, grade, draft, setDraft } = useSession()
  const [v, setV] = useState<Draft>(draft ?? {
    what: '', where: c!.region.name, direction: 'no_change', how_much: '',
    is_it_real: 'cant_tell', why_hypothesis: '', confidence: 2,
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV({ ...v, [k]: val })

  async function submit() {
    setBusy(true); setErr(null)
    setDraft(v)
    try { setGrade(await api.verdict({ session_id: sessionId!, ...v })); onDone() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const ok = v.what.trim().length > 3 && v.why_hypothesis.trim().length >= 15
  return (
    <section className="beat typewriter">
      <h2>The Deduction</h2>
      {grade?.can_retry && <p className="caveat">Second try: read the Chief's notes, then revise.</p>}
      <p className="question">{c!.question}</p>
      <label className="field">What is changing?
        <input value={v.what} maxLength={400} onChange={(e) => set('what', e.target.value)} placeholder="e.g. how wet the soil is in the driest months" />
      </label>
      <label className="field">Where?
        <input value={v.where} maxLength={200} onChange={(e) => set('where', e.target.value)} />
      </label>
      <fieldset className="field"><legend>Which way?</legend>
        {(['worsening', 'improving', 'no_change'] as const).map((d) => (
          <label key={d} className="radio"><input type="radio" checked={v.direction === d} onChange={() => set('direction', d)} />
            {d === 'no_change' ? 'No change' : d[0].toUpperCase() + d.slice(1)}</label>
        ))}
      </fieldset>
      <label className="field">How much? (use the rate and range from your ruler, or say the record can't tell)
        <input value={v.how_much} maxLength={200} onChange={(e) => set('how_much', e.target.value)} placeholder="e.g. about 0.01 per decade" />
      </label>
      <fieldset className="field"><legend>Is it real?</legend>
        {([['yes', 'Yes, it is significant'], ['no', 'No, there is no real change'], ['cant_tell', "Can't tell yet: not enough evidence"]] as const).map(([k, label]) => (
          <label key={k} className="radio"><input type="radio" checked={v.is_it_real === k} onChange={() => set('is_it_real', k)} />{label}</label>
        ))}
      </fieldset>
      <label className="field">Why might it be? (a possibility, not a proof)
        <textarea rows={3} maxLength={600} value={v.why_hypothesis} onChange={(e) => set('why_hypothesis', e.target.value)} />
      </label>
      <label className="field">How sure are you?
        <input type="range" min={1} max={3} value={v.confidence} onChange={(e) => set('confidence', +e.target.value as 1 | 2 | 3)} />
        <output>{['', 'Not very', 'Fairly', 'Very'][v.confidence]}</output>
      </label>
      {err && <p className="error">{err}</p>}
      <button className="primary" disabled={busy || !ok} onClick={submit}>{busy ? 'Sending to the Chief…' : 'Submit the verdict'}</button>
    </section>
  )
}
