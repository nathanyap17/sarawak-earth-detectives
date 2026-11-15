// The editor's desk (/#/review): a person reads every case the Scout and Case Builder drafted
// and approves or rejects it (rule 4). The editor's key is typed here and kept only in memory:
// it is never saved, never in the code, never in a URL.
// AI-assisted: written with Claude Code.
import { useState } from 'react'
import { api } from '../api/client'
import type { DraftRow } from '../api/types'

export function Review() {
  const [key, setKey] = useState('')
  const [rows, setRows] = useState<DraftRow[] | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => api.admin.drafts(key).then((r) => { setRows(r); setMsg('') }).catch((e: Error) => { setRows(null); setMsg(e.message) })
  async function decide(id: string, d: 'approve' | 'reject') {
    setBusy(true)
    try { await api.admin.decide(key, id, d); await load() } catch (e) { setMsg((e as Error).message) } finally { setBusy(false) }
  }
  async function scan() {
    setBusy(true); setMsg('The Scout is reading the feeds. This can take a minute…')
    try { const r = await api.admin.scout(key); setMsg(`Scan done: ${r.headlines} headlines read, ${r.drafted.length} new draft(s).`); await load() }
    catch (e) { setMsg((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="lite review">
      <header className="top"><h1>Editor's desk</h1><a href="#/play">Back to the office</a></header>
      <main>
        <p>Every case the agents draft waits here. Nothing reaches students until a person approves it.</p>
        <form className="slider-row" onSubmit={(e) => { e.preventDefault(); load() }}>
          <label>Editor's key <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" /></label>
          <button className="primary" type="submit">Open the tray</button>
          <button type="button" disabled={busy} onClick={scan}>Run the Scout now</button>
        </form>
        {msg && <p className="muted" role="status">{msg}</p>}
        {rows?.length === 0 && <p className="muted">The tray is empty.</p>}
        {rows?.map(({ case: c, key_overall, key_stamps }) => (
          <article key={c.id} className={`mail ${c.status === 'draft' ? 'mine' : ''}`}>
            <header><span className="mail-type">{c.type}</span><strong>Case {c.id}: {c.title}</strong>
              <span className={`mail-state ${c.status === 'draft' ? 'now' : c.status === 'open' ? 'ok' : 'new'}`}>{c.status}</span></header>
            <p className="mail-q">{c.question}</p>
            <blockquote className="brief">{c.brief}</blockquote>
            <p className="source">Source: <a href={c.sources[0]?.url} target="_blank" rel="noreferrer">{c.sources[0]?.title}</a> ({c.sources[0]?.date}) · Region: {c.region.name}</p>
            <p><strong>Evidence cards:</strong> {c.evidence.join(', ')} · <strong>main:</strong> {c.main_cards.join(', ')} · <strong>red herring:</strong> {c.red_herrings.join(', ')}</p>
            <p><strong>Answer key (computed by code, editor's eyes only):</strong> {key_overall?.replace(/_/g, ' ')} ·{' '}
              {Object.entries(key_stamps).map(([k, [a, b]]) => `${k}: ${a.replace(/_/g, ' ')} → with El Niño lamp ${b.replace(/_/g, ' ')}`).join(' · ')}</p>
            {c.status === 'draft' && (
              <p className="slider-row">
                <button className="primary" disabled={busy} onClick={() => decide(c.id, 'approve')}>Approve: open it to students</button>
                <button disabled={busy} onClick={() => decide(c.id, 'reject')}>Reject</button>
              </p>
            )}
          </article>
        ))}
      </main>
    </div>
  )
}
