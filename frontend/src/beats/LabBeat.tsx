// Beat 5, The Lab: desk tools on each record. Every number shown comes from the backend.
// Each tool says what it is in plain words, each result is explained step by step and shown next
// to made-up sample pictures, and the Ruler starts with the student laying their own line.
// AI-assisted: written with Claude Code.
import { useState } from 'react'
import { api } from '../api/client'
import type { AnalysisResult, EvidenceCard, Series, Tool } from '../api/types'
import { useSession } from '../state/session'
import { explain, TOOL_INFO } from './explain'
import { Samples } from './Samples'
import { fmt, HeatChart, MissionBadge, PBar, pText, ScatterDots, SeasonBars, Stamp, TimeChart } from './shared'
import { Explain, MyLine, Shuffle } from './Workbench'

function trendLine(s: Series, rate: number): [number, number | null][] {
  const pts = s.yearly.filter((p) => p.v != null)
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length
  const mv = pts.reduce((a, p) => a + (p.v as number), 0) / pts.length
  return s.yearly.map((p) => [p.y, mv + (rate / 10) * (p.y - my)])
}

function Result({ r, card, s, region, twinName, before }: { r: AnalysisResult; card: EvidenceCard; s: Series; region: string; twinName?: string; before?: AnalysisResult }) {
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
  if (r.tool === 'season') chart = <>
    <SeasonBars normal={s.normal} unit={card.unit} summary="The average value for each month of the year, 1991 to 2020." />
    <HeatChart diverging unit={card.unit} monthly={r.monthly_out.map((p) => [p.t, p.v])}
      summary="Heatmap of each month's difference from normal: rows are months, columns are years, blue is below normal and red is above." />
    <TimeChart unit={card.unit} zoom zeroLine height={220}
      lines={[{ name: 'Difference from the normal for that month', points: r.monthly_out.map((p) => [p.t, p.v]) }]}
      summary="Monthly values with the seasonal cycle removed; zero is normal." />
  </>
  if ((r.tool === 'ruler' || r.tool === 'scales') && r.rate_per_decade != null) chart = <>
    <TimeChart unit={card.unit}
      lines={[{ name: card.name, points: yearly }, { name: 'Trend line', points: trendLine(s, r.rate_per_decade), dashed: true, color: '#c8102e' }]}
      band={r.range ? { name: 'Where the line could lie (95% range)',
        lo: trendLine(s, r.range[0]).map((p, i) => Math.min(p[1] as number, trendLine(s, r.range![1])[i][1] as number)),
        hi: trendLine(s, r.range[0]).map((p, i) => Math.max(p[1] as number, trendLine(s, r.range![1])[i][1] as number)) } : undefined}
      summary={`Yearly record with a trend line of ${fmt(r.rate_per_decade)} ${r.unit}${r.range ? ` and a shaded 95% range from ${fmt(r.range[0])} to ${fmt(r.range[1])}` : ''}.`} />
    {r.range && <p className="chart-note">The pink fan shows every tilt the line could have, from {fmt(r.range[0])} to {fmt(r.range[1])} {r.unit}.{' '}
      {r.range[0] <= 0 && r.range[1] >= 0 ? 'A flat line fits inside the fan, so "no change" is still possible.' : 'A flat line does not fit inside the fan.'}</p>}
    {r.tool === 'scales' && r.t_test_p != null && r.mann_kendall_p != null &&
      <PBar tests={[{ name: 't-test', p: r.t_test_p }, { name: 'Mann-Kendall', p: r.mann_kendall_p }]} />}
  </>
  if (r.tool === 'elnino') {
    const idx = new Map(r.enso_out.map((p) => [p.y, p.v]))
    const pairs = s.yearly.filter((p) => p.v != null && idx.get(p.y) != null).map((p) => [idx.get(p.y) as number, p.v as number, p.y] as [number, number, number])
    chart = <>
      {pairs.length > 0 && <ScatterDots pairs={pairs} xName="El Niño index (NOAA RONI)" yName={card.unit}
        summary="Scatter chart: each year's El Niño index against the record's value that year." />}
      <TimeChart unit={card.unit}
        lines={[{ name: 'As measured', points: yearly }, { name: 'El Niño dimmed', points: r.series_out.map((p) => [p.y, p.v]), color: '#1f6f8b' }]}
        summary="Yearly record before and after removing the El Niño effect." />
    </>
  }
  if (r.tool === 'twin' && r.twin) chart = <TimeChart unit={card.unit}
    lines={[{ name: region, points: r.series_out.map((p) => [p.y, p.v]) }, { name: twinName ?? r.twin.region_id, points: r.twin.series_out.map((p) => [p.y, p.v]), color: '#1f6f8b' }]}
    summary="The same record in two regions." />
  return (
    <div className="result">
      {chart}
      {r.stamp && <p><Stamp stamp={r.stamp} yearsNeeded={r.years_needed} small={r.small} />{r.tool === 'twin' && ` ${region}`}</p>}
      {r.tool === 'twin' && r.twin?.stamp && (
        <p><Stamp stamp={r.twin.stamp} yearsNeeded={r.twin.years_needed} small={r.twin.small} /> {twinName}
          {r.opposite_trends ? ' — opposite trends!' : ''}</p>
      )}
      {r.tool !== 'magnifier' && r.tool !== 'season' && nums}
      <MissionBadge mission={r.mission} asOf={r.data_as_of} definition={card.definition} />
      <Explain steps={explain(r, before)} />
      <Samples tool={r.tool} stamp={r.stamp} />
      {r.tool === 'scales' && r.stamp !== 'record_too_short' && <Shuffle card={card} />}
    </div>
  )
}

const ORDER: Tool[] = ['magnifier', 'season', 'ruler', 'scales', 'elnino']

export function LabBeat({ onDone }: { onDone: () => void }) {
  const { activeCase: c, sessionId, chosen, series, results, putResult } = useSession()
  const cards = c!.evidence.filter((e) => chosen.includes(e.id))
  const [cardId, setCardId] = useState(cards[0]?.id)
  const [tool, setTool] = useState<Tool | null>(null)
  const [handLine, setHandLine] = useState(false)   // the Ruler starts with "lay your own line"
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const card = cards.find((e) => e.id === cardId)!

  async function run(t: Tool) {
    setTool(t); setErr(null); setHandLine(false)
    if (results[cardId]?.[t]) return
    setBusy(true)
    try { putResult(await api.analyse(sessionId!, cardId, t)) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  function use(t: Tool) {
    if (t === 'ruler' && !results[cardId]?.ruler && series[cardId]) { setTool('ruler'); setErr(null); setHandLine(true); return }
    run(t)
  }

  const stamped = (id: string) => !!(results[id]?.scales?.stamp || results[id]?.elnino?.stamp)
  const r = tool && !handLine ? results[cardId]?.[tool] : undefined
  const info = TOOL_INFO.find((t) => t.id === tool)
  const nextTool = ORDER.find((t) => !results[cardId]?.[t])
  return (
    <section className="beat">
      <h2>The Lab</h2>
      <p>This is where a detective tests a hunch. Pick a record, then pick a tool from the bench.
        A good order is left to right: <strong>look, filter, measure, weigh, check for El Niño</strong>.</p>
      <div className="seg wrap" role="tablist" aria-label="Records to test">
        {cards.map((e) => (
          <button key={e.id} role="tab" aria-selected={e.id === cardId} className={e.id === cardId ? 'on' : ''} onClick={() => { setCardId(e.id); setTool(null); setHandLine(false) }}>
            {stamped(e.id) ? '✔ ' : ''}{e.name}
          </button>
        ))}
      </div>
      <div className="tools">
        {TOOL_INFO.filter((t) => t.id !== 'twin' || c!.twin_region).map((t) => (
          <button key={t.id} className={`tool ${tool === t.id ? 'on' : ''} ${nextTool === t.id && tool !== t.id ? 'suggest' : ''}`} onClick={() => use(t.id)} disabled={busy}>
            <span className="tool-icon" aria-hidden>{t.icon}</span>
            <strong>{t.name}{results[cardId]?.[t.id] && ' ✔'}</strong>
            <small>{t.what}</small>
            {nextTool === t.id && tool !== t.id && <em>Try this next</em>}
          </button>
        ))}
      </div>
      {info && <p className="tool-like"><strong>{info.name}.</strong> {info.like} {info.when}</p>}
      {busy && <p className="muted">Working…</p>}
      {err && <p className="error">{err}</p>}
      {handLine && series[cardId] && <MyLine key={cardId} card={card} s={series[cardId]} onBest={() => run('ruler')} />}
      {r && series[cardId] && <Result r={r} card={card} s={series[cardId]} region={c!.region.name} twinName={c!.twin_region?.name}
        before={r.tool === 'elnino' ? results[cardId]?.scales : undefined} />}
      {tool === 'ruler' && r && <p><button onClick={() => setHandLine(true)}>✏️ Try laying the line by hand</button></p>}
      <p className="muted">Each record needs a stamp from the Scales or the El Niño lamp before you write your verdict.
        ({cards.filter((e) => stamped(e.id)).length} of {cards.length} stamped.)</p>
      <button className="primary" disabled={!cards.every((e) => stamped(e.id))} onClick={onDone}>Go to the typewriter</button>
    </section>
  )
}
