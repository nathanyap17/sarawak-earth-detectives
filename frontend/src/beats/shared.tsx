// Shared beat pieces: mission badge, result stamp, time-series chart.
// AI-assisted: written with Claude Code.
import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { Stamp as StampT } from '../api/types'

echarts.use([LineChart, GridComponent, TooltipComponent, DataZoomComponent, MarkLineComponent, LegendComponent, CanvasRenderer])

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
  needs_more_years: 'Needs more years',
  record_too_short: 'Record too short',
}

export function Stamp({ stamp, yearsNeeded }: { stamp: StampT; yearsNeeded?: number | null }) {
  const extra = stamp === 'needs_more_years' && yearsNeeded
    ? ` (about ${yearsNeeded >= 51 ? 'more than 50' : yearsNeeded} more)` : ''
  return <span className={`stamp stamp-${stamp}`} role="status">{STAMP_TEXT[stamp]}{extra}</span>
}

export interface Line { name: string; points: [string | number, number | null][]; dashed?: boolean; color?: string }

export function TimeChart({ lines, unit, height = 220, zoom = false, zeroLine = false, summary }: {
  lines: Line[]; unit: string; height?: number; zoom?: boolean; zeroLine?: boolean; summary: string
}) {
  const option = {
    animationDuration: 400,
    grid: { left: 48, right: 12, top: lines.length > 1 ? 28 : 12, bottom: zoom ? 56 : 28 },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => (v == null ? '—' : `${(+v).toFixed(2)} ${unit}`) },
    legend: lines.length > 1 ? { top: 0, textStyle: { fontSize: 11 } } : undefined,
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
    })),
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
