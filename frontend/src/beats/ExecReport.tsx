// The executive report of a closed case: the agency's exemplar, told as a story. Header (topic, one line,
// prepared by Sarawak Earth Detectives), the issue, the response, key insights and impact / next steps.
// It charts every record that bears on the question, significant or not, and shows by which measures each
// is judged. It carries no marks, badges or verdict of the student: the case study has those.
// The prose comes from the Reporter agent (guarded) or the code template; every chart, number and
// caption comes from the statistics code (POST /sessions/{id}/summary, reports/insights.py).
// Charts use the SVG renderer so they stay sharp when printed or saved as PDF.
// AI-assisted: written with Claude Code.
import { useEffect, useRef, useSyncExternalStore } from 'react'
import * as echarts from 'echarts/core'
import { LineChart, ScatterChart } from 'echarts/charts'
import { GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import type { CaseFile, ExecSummary, Insight } from '../api/types'

echarts.use([LineChart, ScatterChart, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent, SVGRenderer])

const C = { ink: '#221a14', green: '#1f3a2c', brass: '#d2a94e', red: '#c8102e', grey: '#9a8f84', sig: '#2e7d32', teal: '#1f6f8b' }
const myt = (iso: string) => new Date(iso).toLocaleDateString('en-MY', { timeZone: 'Asia/Kuching', day: 'numeric', month: 'long', year: 'numeric' })

function Chart({ option, height }: { option: echarts.EChartsCoreOption; height: number }) {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const ch = echarts.init(el.current!, undefined, { renderer: 'svg' })
    ch.setOption(option)
    const ro = new ResizeObserver(() => ch.resize())
    ro.observe(el.current!)
    return () => { ro.disconnect(); ch.dispose() }
  }, [option])
  return <div ref={el} className="xr-chart" style={{ height }} />
}

/** Phones: the charts stack their legends and thin their axis labels so nothing overlaps. */
const NARROW = '(max-width: 560px)'
const useNarrow = () => useSyncExternalStore(
  (cb) => { const m = window.matchMedia(NARROW); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
  () => window.matchMedia(NARROW).matches)

const base = { animation: false, textStyle: { fontFamily: 'Atkinson Hyperlegible, system-ui, sans-serif', color: C.ink } }

/** One record: the yearly dots, the regression line, its illustrative extension and the El Niño re-test. */
function trendSeriesCount(i: Insight) {
  return 1 + (i.elnino_points ? 1 : 0) + (i.line ? 1 : 0) + (i.line && i.line.length === 3 ? 1 : 0)
}
/** Height of a trend chart: on phones the legend is a list under the plot, one row per series. */
const trendHeight = (i: Insight, narrow: boolean) => (narrow ? 210 + trendSeriesCount(i) * 18 + 14 : 260)

function trendOption(i: Insight, narrow = false): echarts.EChartsCoreOption {
  const solid = i.line ? i.line.slice(0, 2) : []
  const ext = i.line && i.line.length === 3 ? i.line.slice(1) : []
  const last = i.metrics.last + (ext.length ? i.extend_years : 0)
  return {
    ...base,
    grid: narrow ? { left: 44, right: 10, top: 26, bottom: 36 + trendSeriesCount(i) * 18 + 14 } : { left: 54, right: 16, top: 26, bottom: 64 },
    legend: narrow
      ? { bottom: 0, left: 0, orient: 'vertical', itemGap: 4, itemWidth: 14, itemHeight: 8, textStyle: { fontSize: 10, width: 250, overflow: 'break' } }
      : { bottom: 0, left: 0, itemWidth: 14, itemHeight: 8, textStyle: { fontSize: 10.5 } },
    tooltip: { trigger: 'item' },
    xAxis: { type: 'value', min: i.metrics.first - 1, max: last + 1, splitLine: { show: false },
      axisLabel: { formatter: (v: number) => String(v), hideOverlap: true, fontSize: narrow ? 10 : 12 } },
    yAxis: { type: 'value', name: i.unit, nameTextStyle: { fontSize: 10, align: 'left' }, scale: true, splitLine: { lineStyle: { color: '#eee4d2' } } },
    series: [
      { name: `${i.yearly_label} (each dot = one year)`, type: 'scatter', data: i.points, symbolSize: 7,
        itemStyle: { color: i.significant ? C.green : C.grey } },
      ...(i.elnino_points ? [{ name: 'With the El Niño effect removed', type: 'scatter', data: i.elnino_points, symbol: 'circle', symbolSize: 5,
        itemStyle: { color: 'transparent', borderColor: C.teal, borderWidth: 1 } }] : []),
      ...(solid.length ? [{ name: 'Trend line (linear regression)', type: 'line', data: solid, symbol: 'none',
        lineStyle: { color: i.significant ? C.red : C.grey, width: 2.5, type: i.significant ? 'solid' : 'dashed' } }] : []),
      ...(ext.length ? [{ name: `If the line simply continued ${i.extend_years} years (illustration, not a forecast)`, type: 'line', data: ext, symbol: 'none',
        lineStyle: { color: C.red, width: 2, type: 'dotted' } }] : []),
    ],
  }
}

/** Every tested record's two p-values on one log scale, against the 0.05 line. */
function pOption(items: Insight[], narrow = false): echarts.EChartsCoreOption {
  const ok = items.filter((i) => i.metrics.t_test_p_raw != null)
  const clamp = (p: number | null) => Math.max(p ?? 1, 0.0001)
  const color = (p: number | null) => ((p ?? 1) < 0.05 ? C.sig : C.grey)
  return {
    ...base,
    grid: narrow ? { left: 96, right: 14, top: 48, bottom: 40 } : { left: 150, right: 24, top: 30, bottom: 40 },
    legend: narrow ? { top: 0, left: 0, orient: 'vertical', itemGap: 4, textStyle: { fontSize: 10 } } : { top: 0, left: 150, textStyle: { fontSize: 10.5 } },
    tooltip: { trigger: 'item', formatter: (p: { seriesName: string; value: [number, string] }) => `${p.value[1]}<br/>${p.seriesName}: p ${p.value[0] <= 0.0001 ? '< 0.001' : p.value[0].toPrecision(2)}` },
    xAxis: { type: 'log', min: 0.0001, max: 1, name: 'p-value (log scale)', nameLocation: 'middle', nameGap: 22, nameTextStyle: { fontSize: 10.5 },
      axisLabel: { formatter: (v: number) => (v < 0.001 ? '<0.001' : String(v)), hideOverlap: true, fontSize: narrow ? 9.5 : 12 } },
    yAxis: { type: 'category', data: ok.map((i) => i.name), inverse: true, axisLabel: { width: narrow ? 88 : 140, overflow: narrow ? 'break' : 'truncate', fontSize: narrow ? 10 : 11 },
      splitLine: { show: true, lineStyle: { color: '#f0e8d8' } } },
    series: [
      { name: 'Linear regression t-test (●)', type: 'scatter', symbol: 'circle', symbolSize: 13, itemStyle: { color: C.green },
        data: ok.map((i) => ({ value: [clamp(i.metrics.t_test_p_raw), i.name], itemStyle: { color: color(i.metrics.t_test_p_raw) } })),
        markLine: { symbol: 'none', silent: true, lineStyle: { color: C.red, type: 'dashed', width: 2 },
          label: { formatter: '0.05', position: narrow ? 'start' : 'end', fontSize: 10.5, color: C.red }, data: [{ xAxis: 0.05 }] },
        markArea: { silent: true, itemStyle: { color: 'rgba(46,125,50,0.07)' }, label: { show: true, position: 'insideTopLeft', formatter: 'significant zone', fontSize: 10, color: C.sig },
          data: [[{ xAxis: 0.0001 }, { xAxis: 0.05 }]] } },
      { name: 'Mann-Kendall test (◆)', type: 'scatter', symbol: 'diamond', symbolSize: 14, itemStyle: { color: C.green },
        data: ok.map((i) => ({ value: [clamp(i.metrics.mann_kendall_p_raw), i.name], itemStyle: { color: color(i.metrics.mann_kendall_p_raw), opacity: 0.75 } })) },
      { name: 'Both tests again, El Niño removed (○ ◇)', type: 'scatter', symbol: 'circle', symbolSize: 11,
        itemStyle: { color: 'transparent', borderColor: C.teal, borderWidth: 2 },
        data: ok.filter((i) => i.metrics.after_elnino_t_p_raw != null).flatMap((i) => [
          { value: [clamp(i.metrics.after_elnino_t_p_raw), i.name], symbol: 'circle' },
          { value: [clamp(i.metrics.after_elnino_mk_p_raw), i.name], symbol: 'diamond' }]) },
    ],
  }
}

/** Every record against every measure, so the reader sees what makes each one significant or not. */
function Scoreboard({ items }: { items: Insight[] }) {
  const pass = (p: number | null) => p != null && p < 0.05
  const cell = (txt: string | null, p: number | null) => <td className={`mono ${pass(p) ? 'pass' : 'fail'}`}>{txt ?? '—'}</td>
  return (
    <div className="xr-board-wrap">
      <table className="xr-board">
        <thead><tr><th>Record</th><th>Linear regression t-test p</th><th>Mann-Kendall p</th><th>Sen's slope per decade</th><th>R²</th>
          <th>t-test p, El Niño removed</th><th>Mann-Kendall p, El Niño removed</th><th>Reading</th></tr></thead>
        <tbody>{items.map((i) => (
          <tr key={i.card_id}>
            <th>{i.name}</th>
            {cell(i.metrics.t_test_p, i.metrics.t_test_p_raw)}{cell(i.metrics.mann_kendall_p, i.metrics.mann_kendall_p_raw)}
            <td className="mono">{i.metrics.sen ? `${i.metrics.sen} ${i.unit}` : '—'}</td><td className="mono">{i.metrics.r2 ?? '—'}</td>
            {cell(i.metrics.after_elnino_t_p, i.metrics.after_elnino_t_p_raw)}{cell(i.metrics.after_elnino_mk_p, i.metrics.after_elnino_mk_p_raw)}
            <td><span className={`xr-group ${i.group}`}>{i.group_text}</span></td>
          </tr>
        ))}</tbody>
      </table>
      <p className="xr-caption">Green p-values are below the 0.05 line. A record counts as a trend only when both tests are green and agree on direction; it is robust only if both stay green once the El Niño effect is removed.</p>
    </div>
  )
}

function Metrics({ i }: { i: Insight }) {
  const m = i.metrics
  const rows: [string, string | number | null][] = [
    ['Years of record', `${m.n_years} (${m.first}–${m.last})`],
    ['Slope (linear regression)', m.rate ? `${m.rate} ${i.unit}/decade` : null],
    ['95% range of the slope', m.range ? `${m.range[0]} to ${m.range[1]}` : null],
    ['t-test p (HAC errors)', m.t_test_p],
    ['Mann-Kendall p', m.mann_kendall_p],
    ["Sen's slope", m.sen ? `${m.sen} ${i.unit}/decade` : null],
    ['R² of the line', m.r2],
    ['Correlation with El Niño (r)', m.elnino_r],
    ['After El Niño removed', m.after_elnino ? `${m.after_elnino}${m.after_elnino_t_p ? ` (t-test p ${m.after_elnino_t_p}, Mann-Kendall p ${m.after_elnino_mk_p})` : ''}` : null],
    ['“Too small to matter” band', `±${m.band} ${i.unit}/decade`],
  ]
  return (
    <table className="xr-metrics"><tbody>
      {rows.filter(([, v]) => v != null && v !== '').map(([k, v]) => <tr key={k}><th>{k}</th><td className="mono">{v}</td></tr>)}
    </tbody></table>
  )
}

function Figure({ i, n }: { i: Insight; n: number }) {
  const narrow = useNarrow()
  return (
    <figure className={`xr-fig ${i.group === 'robust' ? 'sig' : i.group === 'elnino' ? 'mid' : 'nsig'}`}>
      <figcaption className="xr-fig-head">
        <span className="xr-fig-n">Figure {n}</span>
        <strong>{i.name}</strong>
        <span className={`xr-stamp ${i.stamp}`}>{i.stamp_text}</span>
      </figcaption>
      <Chart option={trendOption(i, narrow)} height={trendHeight(i, narrow)} />
      <div className="xr-fig-body">
        <p className="xr-caption">{i.caption}</p>
        <Metrics i={i} />
      </div>
      <p className="xr-src">{i.mission} · data to {i.data_as_of} · {i.definition}</p>
    </figure>
  )
}

const GROUPS: { g: Insight['group']; title: string; cls: string; lede: string }[] = [
  { g: 'robust', title: 'Significant, and it holds with El Niño removed', cls: 'ok',
    lede: 'Both tests clear the 0.05 line, agree on direction, and still clear it once the El Niño years are accounted for.' },
  { g: 'elnino', title: 'Significant at first, but not once El Niño is removed', cls: 'mid',
    lede: 'Both tests clear the 0.05 line on the raw record, but the re-test with the El Niño effect removed does not: strong El Niño years may be making the trend.' },
  { g: 'not', title: 'Not significant, and why', cls: '',
    lede: 'The tilt of the line is within what year-to-year noise can produce: the tests stay above 0.05, or the 95% range of the slope includes zero.' },
]

export function ExecReport({ f, s }: { f: CaseFile; s: ExecSummary }) {
  const tested = s.insights.filter((i) => i.metrics.t_test_p_raw != null)
  const glance = tested.length > 1
  const narrow = useNarrow()
  const groups = GROUPS.map((x) => ({ ...x, items: s.insights.filter((i) => i.group === x.g) })).filter((x) => x.items.length)
  let fig = glance ? 2 : 1
  const years = s.insights.length ? `${Math.min(...s.insights.map((i) => i.metrics.first))}–${Math.max(...s.insights.map((i) => i.metrics.last))}` : '—'
  const asOf = s.insights.map((i) => i.data_as_of).sort().at(-1)
  return (
    <div className="xr">
      <header className="xr-head">
        <img src="/brand/logo-128.webp" width="72" height="72" alt="" />
        <div>
          <p className="doc-kicker">Executive summary · Case {f.case.id} · the agency's exemplar</p>
          <h1>{f.case.title}</h1>
          <p className="xr-lede">{s.sections.headline}</p>
          <p className="xr-by">Prepared by <strong>Sarawak Earth Detectives</strong> · {f.case.region} · {myt(f.finished)}</p>
        </div>
      </header>
      <p className="xr-note">This is the model report for the case: how every record that bears on the question reads under the tests.
        Your own marks, badges and verdict are in your case study.</p>

      <section>
        <h2><span>1</span> The issue</h2>
        <p>{s.sections.issue}</p>
        <p className="doc-q">“{f.case.question}”</p>
      </section>

      <section>
        <h2><span>2</span> The response</h2>
        <p>{s.sections.response}</p>
        <ul className="xr-chips">
          <li><strong>{s.insights.length}</strong> NASA records analysed</li>
          <li><strong>4</strong> checks on each record</li>
          <li><strong>{years}</strong> years covered</li>
          {asOf && <li>data to <strong>{asOf}</strong></li>}
        </ul>
        <div className="xr-method">
          <strong>How a trend is judged.</strong> Linear regression fits a straight line through the yearly values; its slope is the rate of
          change and its t-test (with errors widened for year-to-year memory) asks whether the slope could be zero. The Mann-Kendall
          test asks the same question without assuming a straight line, and Sen's slope is its median rate. A trend counts as
          significant only when <em>both</em> p-values fall below 0.05 and agree on direction. The El Niño re-test removes the part of each
          year explained by the El Niño index, then tests again. R² is the share of year-to-year variation the line explains.
        </div>
      </section>

      <section className="xr-insights">
        <h2><span>3</span> Key insights</h2>
        <p>{s.sections.insights}</p>
        {glance && (
          <figure className="xr-fig wide">
            <figcaption className="xr-fig-head"><span className="xr-fig-n">Figure 1</span><strong>Significance at a glance</strong></figcaption>
            <Chart option={pOption(tested, narrow)} height={(narrow ? 120 : 90) + tested.length * 46} />
            <p className="xr-caption">Each record's p-values on a log scale: the filled circle is the linear-regression t-test, the filled diamond the Mann-Kendall test, and the hollow teal marks are the same two tests with the El Niño effect removed. Marks left of the dashed 0.05 line are significant. A record is a trend only when both filled marks are green; it is robust only if the hollow marks stay left of the line too.</p>
          </figure>
        )}
        {s.insights.length > 0 && <Scoreboard items={s.insights} />}
        {groups.map((x) => (
          <div key={x.g} className="xr-group-block">
            <h3 className={`xr-sub ${x.cls}`}>{x.title}</h3>
            <p className="xr-group-lede">{x.lede}</p>
            {x.items.map((i) => <Figure key={i.card_id} i={i} n={fig++} />)}
          </div>
        ))}
        {s.insights.length === 0 && <p className="muted">No record could be tested, so there are no charts to show.</p>}
      </section>

      <section>
        <h2><span>4</span> Impact and next steps</h2>
        <p>{s.sections.impact}</p>
        <ul className="doc-small">{f.case.limits.map((l) => <li key={l}>{l}</li>)}</ul>
      </section>

      <p className="doc-small xr-prov">
        {s.source === 'ai'
          ? 'Story text written by the Reporter agent (AI) from the statistics code’s facts sheet; every figure was checked by the number guard.'
          : 'Story text written by the case desk’s code template.'} Charts, figures and captions are computed by the statistics code, not AI.
      </p>
    </div>
  )
}

