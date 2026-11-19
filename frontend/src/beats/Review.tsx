// The teacher's desk (/#/review): every case, open or waiting, shown with its full configuration:
// the question and brief, the region and scene, each dataset with its role and what the vault
// holds, the code's answer key, the Partner's hints, limits and sources. Drafts from the Scout and
// Case Builder are approved or rejected here (rule 4). Nothing is shown without the editor's key:
// the server checks it on every admin call (ADMIN_TOKEN), locally too, and with no key configured
// the desk stays locked. The key is typed here and kept only in memory: it is never saved, never
// in the code, never in a URL.
// AI-assisted: written with Claude Code.
import { useMemo, useState } from 'react'
import { api } from '../api/client'
import type { DatasetConfig, DraftRow } from '../api/types'

type Filter = 'draft' | 'open' | 'closed' | 'all'
const FILTERS: [Filter, string][] = [['draft', 'Waiting for approval'], ['open', 'Open to students'], ['closed', 'Rejected or closed'], ['all', 'All cases']]
const ROLE: Record<string, [string, string]> = {
  main: ['Main', 'Decides the verdict'], supporting: ['Supporting', 'Useful context'], red_herring: ['Red herring', 'Planted to be rejected'],
}
const words = (s?: string | null) => (s ?? '—').replace(/_/g, ' ')
const num = (x?: number | null) => (x == null ? '—' : x.toLocaleString('en-MY', { maximumSignificantDigits: 3 }))

function Datasets({ rows }: { rows: DatasetConfig[] }) {
  return (
    <div className="desk-scroll">
      <table className="desk-table">
        <thead><tr><th>Role</th><th>Dataset</th><th>Source</th><th>One yearly value</th><th>Unit · grid</th><th>Record in the vault</th><th>“Too small” band</th><th>Worse when</th></tr></thead>
        <tbody>{rows.map((d) => (
          <tr key={d.id} className={`role-${d.role ?? 'missing'}`}>
            <td data-l="Role"><span className={`role-chip ${d.role}`} title={d.role ? ROLE[d.role][1] : ''}>{d.role ? ROLE[d.role][0] : 'Unknown'}</span></td>
            <td data-l="Dataset"><strong>{d.name}</strong><small className="mono"> {d.id}</small>{d.definition && <div className="desk-def">{d.definition}</div>}
              {d.provisional && <div className="caveat">Provisional: {d.provisional}</div>}</td>
            <td data-l="Source" className="mono">{d.mission ?? '—'}</td>
            <td data-l="One yearly value">{d.yearly_label ?? '—'}{d.months && d.months.length < 12 && <div className="desk-def">Months: {d.months.join(', ')}</div>}</td>
            <td data-l="Unit · grid" className="mono">{d.unit ?? '—'}{d.grid_km ? ` · ${d.grid_km} km` : ''}</td>
            <td data-l="Record in the vault" className="mono">{d.vault ? Object.values(d.vault).map((v) => (
              <div key={v.region}>{v.missing ? `${v.region}: not in the vault` : `${v.region}: ${v.first}–${v.last} (${v.n_years} yrs), to ${v.data_as_of}`}</div>
            )) : '—'}</td>
            <td data-l="“Too small” band" className="mono">{d.band_per_decade != null ? `±${d.band_per_decade} / decade` : '—'}</td>
            <td data-l="Worse when">{words(d.worse_when)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function CaseCard({ r, busy, decide }: { r: DraftRow; busy: boolean; decide: (id: string, d: 'approve' | 'reject') => void }) {
  const c = r.case
  const name = (id: string) => r.datasets.find((d) => d.id === id)?.name ?? id
  const draft = c.status === 'draft'
  return (
    <article className={`mail desk-case ${draft ? 'mine' : ''}`}>
      <header>
        <span className="mail-type">{c.type}</span><strong>Case {c.id}: {c.title}</strong>
        <span className={`mail-state ${draft ? 'now' : c.status === 'open' ? 'ok' : 'new'}`}>{draft ? 'waiting for approval' : c.status === 'open' ? 'open to students' : c.status}</span>
        <span className="desk-origin">{r.origin === 'desk' ? 'Drafted by the agents' : 'Hand-made (repository)'}</span>
      </header>
      <p className="mail-q">{c.question}</p>
      <blockquote className="brief">{c.brief}</blockquote>
      <dl className="desk-facts">
        <dt>Region</dt><dd>{c.region.name} <small className="mono">({c.region.id}; box W {c.region.bbox[0]}, S {c.region.bbox[1]}, E {c.region.bbox[2]}, N {c.region.bbox[3]})</small></dd>
        {c.twin_region && <><dt>Twin region</dt><dd>{c.twin_region.name} <small className="mono">({c.twin_region.id})</small></dd></>}
        <dt>Scene</dt><dd>{c.scene.layers.join(', ') || '—'} · {c.scene.from} to {c.scene.to}</dd>
        <dt>Data as of</dt><dd className="mono">{c.data_as_of}</dd>
        <dt>Datasets</dt><dd>{c.evidence.length} offered · main: {c.main_cards.map(name).join(', ') || '—'} · red herrings: {c.red_herrings.map(name).join(', ') || 'none'}</dd>
      </dl>

      <details open={draft}>
        <summary>Datasets and how each is configured ({r.datasets.length})</summary>
        <Datasets rows={r.datasets} />
      </details>

      <details open={draft}>
        <summary>Answer key (computed by code, teachers' and editors' eyes only)</summary>
        {r.key_overall ? (
          <>
            <p>Overall verdict: <strong>{words(r.key_overall)}</strong>{r.key_computed_at && <small className="mono"> · computed {r.key_computed_at}</small>}</p>
            <div className="desk-scroll"><table className="desk-table">
              <thead><tr><th>Dataset</th><th>Direction</th><th>Stamp</th><th>Rate per decade</th><th>95% range</th><th>With the El Niño lamp</th></tr></thead>
              <tbody>{Object.entries(r.key_cards).map(([id, k]) => (
                <tr key={id}><td data-l="Dataset">{name(id)}</td><td data-l="Direction">{words(k.direction)}</td><td data-l="Stamp">{words(k.stamp)}</td>
                  <td data-l="Rate per decade" className="mono">{num(k.rate_per_decade)}</td><td data-l="95% range" className="mono">{num(k.range[0])} to {num(k.range[1])}</td><td data-l="With the El Niño lamp">{words(k.elnino_stamp)}</td></tr>
              ))}</tbody>
            </table></div>
          </>
        ) : <p className="muted">No answer key stored yet. Run <code>uv run python -m app.casework</code> to build it.</p>}
      </details>

      <details>
        <summary>Hints Kenyalang may give, limits and sources</summary>
        <div className="desk-hints">
          {(['evidence', 'method', 'verdict'] as const).map((k) => (
            <div key={k}><h4>{k} hints</h4><ol>{(c.hints?.[k] ?? []).map((h) => <li key={h}>{h}</li>)}</ol></div>
          ))}
        </div>
        <h4>Limits shown to students</h4><ul>{c.limits.map((l) => <li key={l}>{l}</li>)}</ul>
        <h4>Sources</h4><ul>{c.sources.map((s) => <li key={s.title}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title}{s.date ? ` (${s.date})` : ''}</li>)}</ul>
      </details>

      {draft && r.origin === 'desk' && (
        <p className="slider-row">
          <button className="primary" disabled={busy} onClick={() => decide(c.id, 'approve')}>Approve: open it to students</button>
          <button disabled={busy} onClick={() => decide(c.id, 'reject')}>Reject</button>
        </p>
      )}
    </article>
  )
}

export function Review() {
  const [key, setKey] = useState('')
  const [rows, setRows] = useState<DraftRow[] | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<Filter>('draft')

  const load = () => (key.trim() ? api.admin.drafts(key.trim()) : Promise.reject(new Error('Type the editor’s key first.'))).then((r) => {
    setRows(r); setMsg('')
    if (!r.some((x) => x.case.status === 'draft')) setFilter('all')
  }).catch((e: Error) => { setRows(null); setMsg(e.message) })
  async function decide(id: string, d: 'approve' | 'reject') {
    setBusy(true)
    try { await api.admin.decide(key, id, d); await load() } catch (e) { setMsg((e as Error).message) } finally { setBusy(false) }
  }
  async function scan() {
    setBusy(true); setMsg('The Scout is reading the feeds. This can take a minute…')
    try { const r = await api.admin.scout(key); setMsg(`Scan done: ${r.headlines} headlines read, ${r.drafted.length} new draft(s).`); await load() }
    catch (e) { setMsg((e as Error).message) } finally { setBusy(false) }
  }
  const count = useMemo(() => {
    const n = { draft: 0, open: 0, closed: 0, all: rows?.length ?? 0 } as Record<Filter, number>
    rows?.forEach((r) => { const s = r.case.status as Filter; if (s in n) n[s]++ })
    return n
  }, [rows])
  const shown = rows?.filter((r) => filter === 'all' || r.case.status === filter) ?? []

  return (
    <div className="lite review">
      <header className="top"><h1>Teacher's desk</h1><a href="#/play">Back to the office</a></header>
      <main>
        <p>Every case the students can play, and every case the agents have drafted, with its full setup: the datasets, the role each one plays, the record held for it, and the answer key the code computed. Nothing reaches students until a person approves it.</p>
        <form className="slider-row" onSubmit={(e) => { e.preventDefault(); load() }}>
          <label>Editor's key <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" /></label>
          <button className="primary" type="submit" disabled={!key.trim()}>Open the desk</button>
          <button type="button" disabled={busy || !rows} onClick={scan}>Run the Scout now</button>
        </form>
        {msg && <p className={rows ? 'muted' : 'error'} role="status">{msg}</p>}
        {rows && (
          <nav className="desk-tabs" aria-label="Filter cases">
            {FILTERS.map(([f, label]) => (
              <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
                {label} <span className="desk-count">{count[f]}</span></button>
            ))}
          </nav>
        )}
        {rows && shown.length === 0 && <p className="muted">{filter === 'draft' ? 'Nothing is waiting for approval.' : 'No cases here.'}</p>}
        {shown.map((r) => <CaseCard key={r.case.id} r={r} busy={busy} decide={decide} />)}
        {rows && <p className="muted desk-foot">Hand-made cases are edited in the repository (<code>cases/*.json</code>); drafts from the agents are approved or rejected here.</p>}
      </main>
    </div>
  )
}
