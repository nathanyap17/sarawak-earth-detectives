// The executive report of a closed case, told as a story: header, the issue, the detective's
// response, key insights (charts with their statistics) and impact / next steps.
// The prose comes from the Reporter agent (guarded) or the code template; every chart, number and
// caption comes from the statistics code (POST /sessions/{id}/summary, reports/insights.py).
// Charts use the SVG renderer so they stay sharp when printed or saved as PDF.
// AI-assisted: written with Claude Code.
import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { LineChart, ScatterChart } from 'echarts/charts'
import { GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import type { CaseFile, ExecSummary, Insight } from '../api/types'

echarts.use([LineChart, ScatterChart, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent, SVGRenderer])

const C = { ink: '#221a14', green: '#1f3a2c', brass: '#d2a94e', red: '#c8102e', grey: '#9a8f84', sig: '#2e7d32', teal: '#1f6f8b' }
const myt = (iso: string) => new Date(iso).toLocaleDateString('en-MY', { timeZone: 'Asia/Kuching', day: 'numeric', month: 'long', year: 'numeric' })
const words = (s: string) => s.replace(/_/g, ' ')

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

const base = { animation: false, textStyle: { fontFamily: 'Atkinson Hyperlegible, system-ui, sans-serif', color: C.ink } }

/** One record: the yearly dots, the regression line, its illustrative extension and the El Niño re-test. */
function trendOption(i: Insight): echarts.EChartsCoreOption {
  const solid = i.line ? i.line.slice(0, 2) : []
  const ext = i.line && i.line.length === 3 ? i.line.slice(1) : []
  const last = i.metrics.last + (ext.length ? i.extend_years : 0)
  return {
    ...base,
    grid: { left: 54, right: 16, top: 26, bottom: 64 },
    legend: { bottom: 0, left: 0, itemWidth: 14, itemHeight: 8, textStyle: { fontSize: 10.5 } },
    tooltip: { trigger: 'item' },
    xAxis: { type: 'value', min: i.metrics.first - 1, max: last + 1, axisLabel: { formatter: (v: number) => String(v) }, splitLine: { show: false } },
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
function pOption(items: Insight[]): echarts.EChartsCoreOption {
  const ok = items.filter((i) => i.metrics.t_test_p_raw != null)
  const clamp = (p: number | null) => Math.max(p ?? 1, 0.0001)
  const color = (p: number | null) => ((p ?? 1) < 0.05 ? C.sig : C.grey)
  return {
    ...base,
    grid: { left: 150, right: 24, top: 30, bottom: 40 },
    legend: { top: 0, left: 150, textStyle: { fontSize: 10.5 } },
    tooltip: { trigger: 'item', formatter: (p: { seriesName: string; value: [number, string] }) => `${p.value[1]}<br/>${p.seriesName}: p ${p.value[0] <= 0.0001 ? '< 0.001' : p.value[0].toPrecision(2)}` },
    xAxis: { type: 'log', min: 0.0001, max: 1, name: 'p-value (log scale)', nameLocation: 'middle', nameGap: 22, nameTextStyle: { fontSize: 10.5 },
      axisLabel: { formatter: (v: number) => (v < 0.001 ? '<0.001' : String(v)) } },
    yAxis: { type: 'category', data: ok.map((i) => i.name), inverse: true, axisLabel: { width: 140, overflow: 'truncate', fontSize: 11 },
      splitLine: { show: true, lineStyle: { color: '#f0e8d8' } } },
    series: [
      { name: 'Linear regression t-test (●)', type: 'scatter', symbol: 'circle', symbolSize: 13, itemStyle: { color: C.green },
        data: ok.map((i) => ({ value: [clamp(i.metrics.t_test_p_raw), i.name], itemStyle: { color: color(i.metrics.t_test_p_raw) } })),
        markLine: { symbol: 'none', silent: true, lineStyle: { color: C.red, type: 'dashed', width: 2 },
          label: { formatter: '0.05', fontSize: 10.5, color: C.red }, data: [{ xAxis: 0.05 }] },
        markArea: { silent: true, itemStyle: { color: 'rgba(46,125,50,0.07)' }, label: { show: true, position: 'insideTopLeft', formatter: 'significant zone', fontSize: 10, color: C.sig },
          data: [[{ xAxis: 0.0001 }, { xAxis: 0.05 }]] } },
      { name: 'Mann-Kendall test (◆)', type: 'scatter', symbol: 'diamond', symbolSize: 14, itemStyle: { color: C.green },
        data: ok.map((i) => ({ value: [clamp(i.metrics.mann_kendall_p_raw), i.name], itemStyle: { color: color(i.metrics.mann_kendall_p_raw), opacity: 0.75 } })) },
    ],
  }
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
    ['After El Niño removed', m.after_elnino],
    ['“Too small to matter” band', `±${m.band} ${i.unit}/decade`],
  ]
  return (
    <table className="xr-metrics"><tbody>
      {rows.filter(([, v]) => v != null && v !== '').map(([k, v]) => <tr key={k}><th>{k}</th><td className="mono">{v}</td></tr>)}
    </tbody></table>
  )
}

function Figure({ i, n }: { i: Insight; n: number }) {
  return (
    <figure className={`xr-fig ${i.significant ? 'sig' : 'nsig'}`}>
      <figcaption className="xr-fig-head">
        <span className="xr-fig-n">Figure {n}</span>
        <strong>{i.name}</strong>
        <span className={`xr-stamp ${i.stamp}`}>{i.stamp_text}</span>
      </figcaption>
      <Chart option={trendOption(i)} height={260} />
      <div className="xr-fig-body">
        <p className="xr-caption">{i.caption}</p>
        <Metrics i={i} />
      </div>
      <p className="xr-src">{i.mission} · data to {i.data_as_of} · {i.definition}</p>
    </figure>
  )
}

export function ExecReport({ f, s }: { f: CaseFile; s: ExecSummary }) {
  const sig = s.insights.filter((i) => i.significant)
  const rest = s.insights.filter((i) => !i.significant)
  const tested = s.insights.filter((i) => i.metrics.t_test_p_raw != null)
  const glance = tested.length > 1
  const figNo = (k: number) => k + (glance ? 2 : 1)   // figure numbers, in reading order
  return (
    <div className="xr">
      <header className="xr-head">
        <img src="/brand/logo-128.webp" width="72" height="72" alt="" />
        <div>
          <p className="doc-kicker">Executive summary · Case {f.case.id}</p>
          <h1>{f.case.title}</h1>
          <p className="xr-lede">{s.sections.headline}</p>
          <p className="xr-by">Prepared by <strong>Sarawak Earth Detectives</strong> · Detective {f.detective} · {f.case.region} · {myt(f.finished)}</p>
        </div>
        <div className={`xr-outcome ${f.grade.ending.startsWith('Sent') ? 'back' : ''}`}><span>{f.grade.ending}</span><strong>{f.grade.score}</strong><small>of 100</small></div>
      </header>

      <section>
        <h2><span>1</span> The issue</h2>
        <p>{s.sections.issue}</p>
        <p className="doc-q">“{f.case.question}”</p>
      </section>

      <section>
        <h2><span>2</span> The response</h2>
        <p>{s.sections.response}</p>
        <ul className="xr-chips">
          <li><strong>{f.evidence.length}</strong> NASA records chosen</li>
          <li><strong>{f.tests.length}</strong> lab tests run</li>
          <li><strong>{f.pins}</strong> map pins</li>
          <li><strong>{f.attempts}</strong> verdict attempt{f.attempts > 1 ? 's' : ''}</li>
        </ul>
        <div className="xr-method">
          <strong>How a trend is judged.</strong> Linear regression fits a straight line through the yearly values; its slope is the rate of
          change and its t-test (with errors widened for year-to-year memory) asks whether the slope could be zero. The Mann-Kendall
          test asks the same question without assuming a straight line, and Sen's slope is its median rate. A trend counts as
          significant only when <em>both</em> p-values fall below 0.05 and agree on direction. The El Niño lamp removes the part of each
          year explained by the El Niño index, then tests again. R² is the share of year-to-year variation the line explains.
        </div>
      </section>

      <section className="xr-insights">
        <h2><span>3</span> Key insights</h2>
        <p>{s.sections.insights}</p>
        {glance && (
          <figure className="xr-fig wide">
            <figcaption className="xr-fig-head"><span className="xr-fig-n">Figure 1</span><strong>Significance at a glance</strong></figcaption>
            <Chart option={pOption(tested)} height={80 + tested.length * 42} />
            <p className="xr-caption">Each record's two p-values on a log scale: the circle is the linear-regression t-test, the diamond the Mann-Kendall test. Marks left of the dashed 0.05 line (green) are significant; grey marks are not. A record counts as a trend only when both of its marks are green and the two tests agree on direction.</p>
          </figure>
        )}
        {sig.length > 0 && <h3 className="xr-sub ok">Significant trends</h3>}
        {sig.map((i, k) => <Figure key={i.card_id} i={i} n={figNo(k)} />)}
        {rest.length > 0 && <h3 className="xr-sub">Not significant, and why</h3>}
        {rest.map((i, k) => <Figure key={i.card_id} i={i} n={figNo(sig.length + k)} />)}
        {s.insights.length === 0 && <p className="muted">The detective ran no tests, so there are no charts to show.</p>}
        {f.verdict && (
          <div className="xr-verdict">
            <strong>The detective's verdict:</strong> {f.verdict.what} ({f.verdict.where}) · direction {words(f.verdict.direction)} ·
            is it real? {words(f.verdict.is_it_real)} · confidence {f.verdict.confidence} of 3.
          </div>
        )}
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
