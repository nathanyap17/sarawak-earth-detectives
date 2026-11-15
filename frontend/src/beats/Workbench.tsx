// The lab's hands-on tools. Students lay their own trend line (and have it scored against the
// best one), and shuffle the years to see what luck alone can do. The scoring and the shuffling
// are done by the backend statistics code; this file draws and explains.
// AI-assisted: written with Claude Code.
import { useMemo, useState } from 'react'
import { api } from '../api/client'
import type { EvidenceCard, MyLineResult, Series, ShuffleResult } from '../api/types'
import { useSession } from '../state/session'
import { explainMyLine, explainShuffle } from './explain'
import { Samples } from './Samples'
import { fmt, MissionBadge, TimeChart } from './shared'

/** Kenyalang's step-by-step explanation box. */
export function Explain({ title = 'Kenyalang explains', steps }: { title?: string; steps: string[] }) {
  return (
    <div className="explain">
      <p className="explain-head"><span aria-hidden="true">🐦</span> {title}</p>
      <ol>{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
    </div>
  )
}

const cache = { line: new Map<string, MyLineResult>(), shuffle: new Map<string, ShuffleResult>() }

/** Lay your own line: two sliders, then the backend scores it. */
export function MyLine({ card, s, onBest }: { card: EvidenceCard; s: Series; onBest: () => void }) {
  const sessionId = useSession((x) => x.sessionId)
  const pts = useMemo(() => s.yearly.filter((p) => p.v != null) as { y: number; v: number }[], [s])
  const dims = useMemo(() => {
    const vs = pts.map((p) => p.v), ys = pts.map((p) => p.y)
    const lo = Math.min(...vs), hi = Math.max(...vs)
    const mid = ys.reduce((a, b) => a + b, 0) / ys.length
    const span = (hi - lo) || 1, decades = Math.max(1, (ys[ys.length - 1] - ys[0]) / 10)
    return { lo, hi, mid, span, maxTilt: (2 * span) / decades, mean: vs.reduce((a, b) => a + b, 0) / vs.length }
  }, [pts])
  const key = `${sessionId}:${card.id}`
  const [tilt, setTilt] = useState(0)
  const [level, setLevel] = useState(dims.mean)
  const [res, setRes] = useState<MyLineResult | null>(cache.line.get(key) ?? null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [tries, setTries] = useState(0)

  const mine = s.yearly.map((p) => [p.y, level + (tilt / 10) * (p.y - dims.mid)] as [number, number])
  const best = res && s.yearly.map((p) => [p.y, res.best_level + (res.best_rate_per_decade / 10) * (p.y - res.mid_year)] as [number, number])
  const showBest = !!res && (res.score >= 90 || tries >= 3)

  async function check() {
    setBusy(true); setErr('')
    try {
      const r = await api.myLine(sessionId!, card.id, tilt, level)
      cache.line.set(key, r); setRes(r); setTries((t) => t + 1)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="result workbench">
      <h3>Lay your own line</h3>
      <p>Before the computer does it, you try. Slide <strong>Tilt</strong> and <strong>Height</strong> until the blue line
        runs through the middle of the dots, with about as many dots above it as below.</p>
      <TimeChart unit={card.unit} height={230} lines={[
        { name: card.name, points: s.yearly.map((p) => [p.y, p.v]) },
        { name: 'Your line', points: mine, color: '#1f6f8b' },
        ...(showBest && best ? [{ name: 'Best line', points: best, dashed: true, color: '#c8102e' }] : []),
      ]} summary="The yearly record with the line you are laying by hand." />
      <label className="slide">Tilt <small>(left = falling, right = rising)</small>
        <input type="range" min={-dims.maxTilt} max={dims.maxTilt} step={dims.maxTilt / 100} value={tilt}
          onChange={(e) => setTilt(+e.target.value)} aria-valuetext={`${fmt(tilt)} ${card.unit} per decade`} />
        <output>{fmt(tilt)} {card.unit} per decade</output>
      </label>
      <label className="slide">Height <small>(moves the whole line up or down)</small>
        <input type="range" min={dims.lo} max={dims.hi} step={dims.span / 200} value={level} onChange={(e) => setLevel(+e.target.value)} />
        <output>{fmt(level)} {card.unit}</output>
      </label>
      <div className="row">
        <button className="primary" onClick={check} disabled={busy}>{busy ? 'Measuring…' : res ? 'Check again' : 'Check my line'}</button>
        <button onClick={onBest}>Use the Ruler (best line)</button>
      </div>
      {err && <p className="error">{err}</p>}
      {res && (
        <>
          <div className="scorebar" role="img" aria-label={`Your line scores ${res.score} out of 100`}>
            <span style={{ width: `${res.score}%` }} /><b>{res.score}/100</b>
          </div>
          <Explain steps={[...explainMyLine(res), ...(showBest ? ['The red dashed line is the best line. See how yours compares, then press "Use the Ruler" to read its exact tilt and range.'] : [])]} />
          <MissionBadge mission={res.mission} asOf={res.data_as_of} definition={card.definition} />
        </>
      )}
      <Samples tool="myline" />
    </div>
  )
}

/** Shuffle the years: a picture of what luck alone can do. */
export function Shuffle({ card }: { card: EvidenceCard }) {
  const sessionId = useSession((x) => x.sessionId)
  const key = `${sessionId}:${card.id}`
  const [res, setRes] = useState<ShuffleResult | null>(cache.shuffle.get(key) ?? null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function run() {
    setBusy(true); setErr('')
    try { const r = await api.shuffle(sessionId!, card.id); cache.shuffle.set(key, r); setRes(r) }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  if (!res) {
    return (
      <div className="workbench-cta">
        <p><strong>Could luck have done this?</strong> Shuffle the years like a deck of cards and see how often a
          tilt this big turns up by accident.</p>
        <button onClick={run} disabled={busy}>{busy ? 'Shuffling…' : '🔀 Shuffle the years 1,000 times'}</button>
        {err && <p className="error">{err}</p>}
      </div>
    )
  }
  const W = 320, H = 120, pad = 14
  const lo = res.edges[0], hi = res.edges[res.edges.length - 1], top = Math.max(...res.counts)
  const x = (v: number) => pad + ((v - lo) / (hi - lo)) * (W - 2 * pad)
  const bw = (W - 2 * pad) / res.counts.length
  const real = res.real_rate_per_decade
  return (
    <div className="workbench">
      <h3>The shuffle test</h3>
      <svg className="histo" viewBox={`0 0 ${W} ${H + 22}`} role="img"
        aria-label={`${res.as_steep} of ${res.n} shuffled records tilted at least as much as the real one.`}>
        {res.counts.map((c, i) => {
          const mid = (res.edges[i] + res.edges[i + 1]) / 2, h = (c / top) * (H - pad)
          return <rect key={i} x={pad + i * bw + 1} y={H - h} width={bw - 2} height={h} fill={Math.abs(mid) >= Math.abs(real) ? '#e3a59c' : '#b9b0a2'} />
        })}
        <line x1={pad} x2={W - pad} y1={H} y2={H} stroke="#555" />
        <line x1={x(0)} x2={x(0)} y1={H} y2={H + 4} stroke="#555" />
        <text x={x(0)} y={H + 16} textAnchor="middle" fontSize="10" fill="#555">no tilt</text>
        <line x1={x(real)} x2={x(real)} y1={6} y2={H} stroke="#c8102e" strokeWidth="2" />
        <text x={x(real)} y={H + 16} textAnchor={real > 0 ? 'end' : 'start'} fontSize="10" fill="#c8102e" fontWeight="700">the real record</text>
      </svg>
      <Explain steps={explainShuffle(res)} />
      <MissionBadge mission={res.mission} asOf={res.data_as_of} definition={card.definition} />
    </div>
  )
}
