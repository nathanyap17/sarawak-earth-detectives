// Beat 5, The Lab: desk tools on each record. Every number shown comes from the backend.
// AI-assisted: written with Claude Code.
import { useState } from 'react'
import { api } from '../api/client'
import type { AnalysisResult, EvidenceCard, Series, Tool } from '../api/types'
import { useSession } from '../state/session'
import { fmt, MissionBadge, pText, Stamp, TimeChart } from './shared'

const TOOLS: { id: Tool; name: string; icon: string; what: string }[] = [
  { id: 'magnifier', name: 'Magnifier', icon: '🔍', what: 'Zoom into the record in time.' },
  { id: 'season', name: 'Season filter', icon: '🟠', what: 'Remove the yearly cycle: each month minus its normal.' },
  { id: 'ruler', name: 'Ruler', icon: '📏', what: 'Lay a trend line and read the rate per decade.' },
  { id: 'scales', name: 'Scales', icon: '⚖️', what: 'Weigh the trend against the noise with two tests.' },
  { id: 'elnino', name: 'El Niño lamp', icon: '💡', what: 'Dim the El Niño effect and test again.' },
  { id: 'twin', name: 'Twin map', icon: '🗺️', what: 'Run the same test on a second region.' },
]

function trendLine(s: Series, rate: number): [number, number | null][] {
  const pts = s.yearly.filter((p) => p.v != null)
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length
  const mv = pts.reduce((a, p) => a + (p.v as number), 0) / pts.length
  return s.yearly.map((p) => [p.y, mv + (rate / 10) * (p.y - my)])
}

function Result({ r, card, s, region, twinName }: { r: AnalysisResult; card: EvidenceCard; s: Series; region: string; twinName?: string }) {
  const yearly = s.yearly.map((p) => [p.y, p.v] as [number, number | null])
  const nums = (
    <dl className="nums">
      {r.rate_per_decade != null && <><dt>Rate</dt><dd>{fmt(r.rate_per_decade)} {r.unit}</dd></>}
      {r.range && <><dt>Range (95%)</dt><dd>{fmt(r.range[0])} to {fmt(r.range[1])}</dd></>}
      {r.t_test_p != null && <><dt>Test 1: t-test p</dt><dd>{pText(r.t_test_p)}</dd></>}
      {r.mann_kendall_p != null && <><dt>Test 2: Mann-Kendall p</dt><dd>{pText(r.mann_kendall_p)}</dd></>}
      {r.sen_per_decade != null && <><dt>Sen's slope</dt><dd>{fmt(r.sen_per_decade)} {r.unit}</dd></>}
      {r.elnino_r != null && <><dt>Moves with El Niño (r)</dt><dd>{fmt(r.elnino_r, 2)}</dd></>}
      {r.n_years != null && <><dt>Years tested</dt><dd>{r.n_years}</dd></>}
    </dl>
  )
  let chart = null
  if (r.tool === 'magnifier') chart = <TimeChart unit={card.unit} zoom lines={[{ name: card.name, points: yearly }]} summary="Zoomable yearly record." />
  if (r.tool === 'season') chart = <TimeChart unit={card.unit} zoom zeroLine height={240}
    lines={[{ name: 'Difference from the normal for that month', points: r.monthly_out.map((p) => [p.t, p.v]) }]}
    summary="Monthly values with the seasonal cycle removed; zero is normal." />
  if ((r.tool === 'ruler' || r.tool === 'scales') && r.rate_per_decade != null) chart = <TimeChart unit={card.unit}
    lines={[{ name: card.name, points: yearly }, { name: 'Trend line', points: trendLine(s, r.rate_per_decade), dashed: true, color: '#c8102e' }]}
    summary={`Yearly record with a trend line of ${fmt(r.rate_per_decade)} ${r.unit}.`} />
  if (r.tool === 'elnino') chart = <TimeChart unit={card.unit}
    lines={[{ name: 'As measured', points: yearly }, { name: 'El Niño dimmed', points: r.series_out.map((p) => [p.y, p.v]), color: '#1f6f8b' }]}
    summary="Yearly record before and after removing the El Niño effect." />
  if (r.tool === 'twin' && r.twin) chart = <TimeChart unit={card.unit}
    lines={[{ name: region, points: r.series_out.map((p) => [p.y, p.v]) }, { name: twinName ?? r.twin.region_id, points: r.twin.series_out.map((p) => [p.y, p.v]), color: '#1f6f8b' }]}
    summary="The same record in two regions." />
  return (
    <div className="result">
      {chart}
      {r.stamp && <p><Stamp stamp={r.stamp} yearsNeeded={r.years_needed} />{r.tool === 'twin' && ` ${region}`}</p>}
      {r.tool === 'twin' && r.twin?.stamp && (
        <p><Stamp stamp={r.twin.stamp} yearsNeeded={r.twin.years_needed} /> {twinName}
          {r.opposite_trends ? ' — opposite trends!' : ''}</p>
      )}
      {r.tool !== 'magnifier' && r.tool !== 'season' && nums}
      <MissionBadge mission={r.mission} asOf={r.data_as_of} definition={card.definition} />
    </div>
  )
}

export function LabBeat({ onDone }: { onDone: () => void }) {
  const { activeCase: c, sessionId, chosen, series, results, putResult } = useSession()
  const cards = c!.evidence.filter((e) => chosen.includes(e.id))
  const [cardId, setCardId] = useState(cards[0]?.id)
  const [tool, setTool] = useState<Tool | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const card = cards.find((e) => e.id === cardId)!

  async function use(t: Tool) {
    setTool(t); setErr(null)
    if (results[cardId]?.[t]) return
    setBusy(true)
    try { putResult(await api.analyse(sessionId!, cardId, t)) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const stamped = (id: string) => !!(results[id]?.scales?.stamp || results[id]?.elnino?.stamp)
  const r = tool ? results[cardId]?.[tool] : undefined
  return (
    <section className="beat">
      <h2>The Lab</h2>
      <div className="seg wrap">
        {cards.map((e) => (
          <button key={e.id} className={e.id === cardId ? 'on' : ''} onClick={() => { setCardId(e.id); setTool(null) }}>
            {stamped(e.id) ? '✔ ' : ''}{e.name}
          </button>
        ))}
      </div>
      <div className="tools">
        {TOOLS.filter((t) => t.id !== 'twin' || c!.twin_region).map((t) => (
          <button key={t.id} className={`tool ${tool === t.id ? 'on' : ''}`} onClick={() => use(t.id)} title={t.what} disabled={busy}>
            <span aria-hidden>{t.icon}</span> {t.name}
            {results[cardId]?.[t.id] && <small> ✔</small>}
          </button>
        ))}
      </div>
      {tool && <p className="muted">{TOOLS.find((t) => t.id === tool)!.what}</p>}
      {busy && <p className="muted">Working…</p>}
      {err && <p className="error">{err}</p>}
      {r && series[cardId] && <Result r={r} card={card} s={series[cardId]} region={c!.region.name} twinName={c!.twin_region?.name} />}
      <p className="muted">Each record needs a stamp from the Scales or the El Niño lamp before you write your verdict.</p>
      <button className="primary" disabled={!cards.every((e) => stamped(e.id))} onClick={onDone}>Go to the typewriter</button>
    </section>
  )
}
