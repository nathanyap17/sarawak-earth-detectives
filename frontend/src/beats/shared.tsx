// Shared beat pieces: mission badge, result stamp, time-series chart.
// AI-assisted: written with Claude Code.
import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, HeatmapChart, LineChart, ScatterChart } from 'echarts/charts'
import { DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { Stamp as StampT } from '../api/types'

echarts.use([BarChart, HeatmapChart, ScatterChart, VisualMapComponent, LineChart, GridComponent, TooltipComponent, DataZoomComponent, MarkLineComponent, LegendComponent, CanvasRenderer])

/** Minimal ECharts host: init once, replace the option on change, resize with the box. */
function EChart({ option, height }: { option: echarts.EChartsCoreOption; height: number }) {
  const el = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)
  useEffect(() => {
    chart.current = echarts.init(el.current!)
    const ro = new ResizeObserver(() => chart.current?.resize())
    ro.observe(el.current!)
    return () => { ro.disconnect(); chart.current?.dispose(); chart.current = null }
  }, [])
  useEffect(() => { chart.current?.setOption(option, true) }, [option])
  return <div ref={el} style={{ height, width: '100%' }} />
}

/** Rule 6: every number carries its mission and date. Tap for a plain definition. */
export function MissionBadge({ mission, asOf, definition }: { mission: string; asOf: string; definition?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="badge-wrap">
      <button type="button" className="mission" onClick={() => setOpen(!open)} aria-expanded={open}>
        {mission} · data to {asOf}
      </button>
      {open && definition && <span className="mission-def" role="note">{definition}</span>}
    </span>
  )
}

const STAMP_TEXT: Record<StampT, string> = {
  significant: 'Significant',
  not_significant: 'Not significant',
  needs_more_years: 'Not clear yet',
  record_too_short: 'Record too short',
}

/** The stamp, plus what it means here: for "Not clear yet", about how many more years would settle it
 *  (only when the tilt so far is big enough to matter); for "Significant", whether it is too small to matter. */
export function Stamp({ stamp, yearsNeeded, small }: { stamp: StampT; yearsNeeded?: number | null; small?: boolean }) {
  const extra = stamp === 'needs_more_years'
    ? (yearsNeeded ? ` · ${yearsNeeded >= 51 ? 'more than 50' : `about ${yearsNeeded}`} more years would settle it`
      : ' · the tilt so far is too small to matter, but the wobble leaves room for one that does')
    : stamp === 'significant' && small ? ' · but too small to matter' : ''
  return <span className={`stamp stamp-${stamp}`} role="status">{STAMP_TEXT[stamp]}{extra}</span>
}

export interface Line { name: string; points: [string | number, number | null][]; dashed?: boolean; color?: string }

export function TimeChart({ lines, unit, height = 220, zoom = false, zeroLine = false, summary, band }: {
  lines: Line[]; unit: string; height?: number; zoom?: boolean; zeroLine?: boolean; summary: string
  /** a shaded range between two lines (same x values as lines[0]), e.g. where the trend line could lie */
  band?: { name: string; lo: (number | null)[]; hi: (number | null)[] }
}) {
  const bandSeries = band ? [
    { name: band.name, type: 'line', stack: 'band', symbol: 'none', silent: true, data: band.lo, lineStyle: { opacity: 0 }, tooltip: { show: false } },
    { name: band.name, type: 'line', stack: 'band', symbol: 'none', silent: true, lineStyle: { opacity: 0 }, tooltip: { show: false },
      data: band.hi.map((h, i) => (h == null || band.lo[i] == null ? null : h - (band.lo[i] as number))), areaStyle: { color: 'rgba(200,16,46,.16)' }, color: 'rgba(200,16,46,.35)' },
  ] : []
  const option = {
    animationDuration: 400,
    grid: { left: 48, right: 12, top: lines.length > 1 ? 28 : 12, bottom: zoom ? 56 : 28 },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => (v == null ? '—' : `${(+v).toFixed(2)} ${unit}`) },
    legend: lines.length > 1 ? { top: 0, textStyle: { fontSize: 11 }, data: [...lines.map((l) => l.name), ...(band ? [band.name] : [])] } : undefined,
    xAxis: { type: 'category', data: lines[0]?.points.map((p) => p[0]) ?? [], axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', scale: true, name: lines.length > 1 ? undefined : unit, nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 } },
    dataZoom: zoom ? [{ type: 'slider', height: 18, bottom: 8 }, { type: 'inside' }] : undefined,
    series: lines.map((l, i) => ({
      name: l.name, type: 'line', showSymbol: false, connectNulls: false,
      data: l.points.map((p) => p[1]),
      lineStyle: { width: l.dashed ? 2 : 1.6, type: l.dashed ? 'dashed' : 'solid' },
      color: l.color ?? ['#7a3e1d', '#c8102e', '#1f6f8b', '#6b8e23'][i % 4],
      markLine: zeroLine && i === 0
        ? { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: '#999' } } : undefined,
    })).concat(bandSeries as never[]),
  }
  return (
    <figure className="chart">
      <EChart option={option} height={height} />
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  )
}

export function fmt(v: number | null | undefined, nd = 3) {
  if (v == null) return '—'
  const a = Math.abs(v)
  return a !== 0 && (a < 0.001 || a >= 10000) ? v.toExponential(2) : (+v.toFixed(nd)).toString()
}

export function pText(p: number | null | undefined) {
  if (p == null) return '—'
  return p < 0.001 ? '< 0.001' : p.toFixed(3)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DIVERGING = ['#2166ac', '#67a9cf', '#d1e5f0', '#f7f7f7', '#fddbc7', '#ef8a62', '#b2182b']
const SEQUENTIAL = ['#fde725', '#7ad151', '#22a884', '#2a788e', '#414487', '#440154']   // low to high; no colour here means good or bad

function Figure({ option, height, summary, note }: { option: echarts.EChartsCoreOption; height: number; summary: string; note?: string }) {
  return (
    <figure className="chart">
      <EChart option={option} height={height} />
      {note && <p className="chart-note">{note}</p>}
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  )
}

/** Year-by-month heatmap. `diverging`: values are differences from normal (blue below, red above). */
export function HeatChart({ monthly, unit, diverging = false, summary }: {
  monthly: [string, number | null][]; unit: string; diverging?: boolean; summary: string
}) {
  const pts = monthly.filter((p) => p[1] != null) as [string, number][]
  const years = [...new Set(pts.map((p) => p[0].slice(0, 4)))]
  const vals = pts.map((p) => p[1])
  const top = Math.max(...vals), bottom = Math.min(...vals), far = Math.max(Math.abs(top), Math.abs(bottom))
  const option = {
    animation: false,
    grid: { left: 40, right: 8, top: 8, bottom: 58 },
    tooltip: { formatter: (p: { value: [number, number, number] }) => `${MONTHS[p.value[1]]} ${years[p.value[0]]}: ${(+p.value[2]).toFixed(2)} ${unit}` },
    xAxis: { type: 'category', data: years, axisLabel: { fontSize: 10 }, splitArea: { show: false } },
    yAxis: { type: 'category', data: MONTHS, inverse: true, axisLabel: { fontSize: 10 } },
    visualMap: { min: diverging ? -far : bottom, max: diverging ? far : top, calculable: false, orient: 'horizontal', left: 'center', bottom: 4, itemHeight: 120, itemWidth: 10,
      text: diverging ? ['above normal', 'below normal'] : ['high', 'low'], textStyle: { fontSize: 10 }, inRange: { color: diverging ? DIVERGING : SEQUENTIAL } },
    series: [{ type: 'heatmap', data: pts.map((p) => [years.indexOf(p[0].slice(0, 4)), +p[0].slice(5, 7) - 1, p[1]]), emphasis: { itemStyle: { borderColor: '#000', borderWidth: 1 } } }],
  }
  return <Figure option={option} height={300} summary={summary}
    note={diverging ? 'Each square is one month. Read across a row to follow one month through the years. Blue is below normal for that month, red is above.'
      : 'Each square is one month. Read down a column to see one year, and across a row to follow one month through the years.'} />
}

/** One coloured stripe per year: the whole record at a glance. */
export function Stripes({ yearly, unit, summary }: { yearly: [number, number | null][]; unit: string; summary: string }) {
  const pts = yearly.filter((p) => p[1] != null) as [number, number][]
  const vals = pts.map((p) => p[1])
  const option = {
    animation: false,
    grid: { left: 8, right: 8, top: 6, bottom: 56 },
    tooltip: { formatter: (p: { value: [number, number, number] }) => `${pts[p.value[0]][0]}: ${(+p.value[2]).toFixed(2)} ${unit}` },
    xAxis: { type: 'category', data: pts.map((p) => p[0]), axisLabel: { fontSize: 10 }, axisTick: { show: false } },
    yAxis: { type: 'category', data: [''], show: false },
    visualMap: { min: Math.min(...vals), max: Math.max(...vals), calculable: false, orient: 'horizontal', left: 'center', bottom: 2, itemHeight: 120, itemWidth: 10,
      text: ['high', 'low'], textStyle: { fontSize: 10 }, inRange: { color: DIVERGING } },
    series: [{ type: 'heatmap', data: pts.map((p, i) => [i, 0, p[1]]) }],
  }
  return <Figure option={option} height={170} summary={summary}
    note="Each stripe is one year, oldest on the left. If the colours drift from one end to the other, something may be changing. If they are mixed up, it is mostly wobble." />
}

/** The normal year: one bar per month (the pattern the season filter removes). */
export function SeasonBars({ normal, unit, summary }: { normal: { m: number; v: number }[]; unit: string; summary: string }) {
  const option = {
    animationDuration: 300,
    grid: { left: 48, right: 8, top: 10, bottom: 26 },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${(+v).toFixed(2)} ${unit}` },
    xAxis: { type: 'category', data: normal.map((n) => MONTHS[n.m - 1]), axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', scale: true, axisLabel: { fontSize: 10 } },
    series: [{ type: 'bar', data: normal.map((n) => n.v), color: '#1f6f8b', barWidth: '62%' }],
  }
  return <Figure option={option} height={150} summary={summary}
    note="A normal year (the average for each month, 1991 to 2020). The season filter takes this pattern away, so only the unusual part is left." />
}

/** Scatter: does the record move with the El Niño index? One dot per year. */
export function ScatterDots({ pairs, xName, yName, summary }: { pairs: [number, number, number][]; xName: string; yName: string; summary: string }) {
  const option = {
    animationDuration: 300,
    grid: { left: 52, right: 12, top: 12, bottom: 40 },
    tooltip: { formatter: (p: { value: [number, number, number] }) => `${p.value[2]}: El Niño index ${(+p.value[0]).toFixed(2)}, record ${(+p.value[1]).toFixed(2)}` },
    xAxis: { type: 'value', name: xName, nameLocation: 'middle', nameGap: 24, nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 }, scale: true },
    yAxis: { type: 'value', name: yName, nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 }, scale: true },
    series: [{ type: 'scatter', symbolSize: 8, data: pairs, color: '#1f6f8b',
      markLine: { silent: true, symbol: 'none', data: [{ xAxis: 0 }], lineStyle: { color: '#999' }, label: { show: false } } }],
  }
  return <Figure option={option} height={220} summary={summary}
    note="One dot per year. Right of the grey line are El Niño years, left are La Niña years. If the dots climb or fall from left to right, the record moves with El Niño." />
}

/** Two p-values against the 0.05 line: the picture of "both tests must pass". */
export function PBar({ tests }: { tests: { name: string; p: number }[] }) {
  const W = 320, x = (p: number) => 96 + Math.min(1, Math.sqrt(p) / Math.sqrt(0.5)) * (W - 110)
  return (
    <svg className="pbar" viewBox={`0 0 ${W} ${22 + tests.length * 22}`} role="img"
      aria-label={tests.map((t) => `${t.name}: p ${t.p < 0.05 ? 'below' : 'above'} 0.05`).join('; ')}>
      <rect x={96} y={4} width={x(0.05) - 96} height={tests.length * 22 + 2} fill="#e3f1e5" />
      <line x1={x(0.05)} x2={x(0.05)} y1={2} y2={tests.length * 22 + 8} stroke="#2e7d32" strokeDasharray="3 3" />
      <text x={x(0.05) + 4} y={tests.length * 22 + 19} fontSize="10" fill="#2e7d32">0.05: the pass line</text>
      <text x={96} y={tests.length * 22 + 19} fontSize="10" fill="#666" textAnchor="end">luck unlikely ←</text>
      {tests.map((t, i) => (
        <g key={t.name}>
          <text x={90} y={20 + i * 22} fontSize="11" textAnchor="end" fill="#2b211b">{t.name}</text>
          <line x1={96} x2={W - 8} y1={16 + i * 22} y2={16 + i * 22} stroke="#ccc" />
          <circle cx={x(t.p)} cy={16 + i * 22} r={6} fill={t.p < 0.05 ? '#2e7d32' : '#b26a00'} stroke="#fff" strokeWidth={1.5} />
        </g>
      ))}
    </svg>
  )
}
