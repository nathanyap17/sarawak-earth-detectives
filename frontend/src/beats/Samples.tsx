// Side-by-side sample pictures: small made-up charts that show what each lab result looks like,
// so a student can compare their own chart with a textbook case. They are drawings, not data:
// no numbers are shown and every panel is labelled as made up.
// AI-assisted: written with Claude Code.
import type { Stamp, Tool } from '../api/types'

/** Repeatable wobble, so the pictures never change between visits. */
function wobble(seed: number, n: number) {
  let s = seed
  return Array.from({ length: n }, () => { s = (s * 16807) % 2147483647; return (s / 2147483647) * 2 - 1 })
}

interface Sample { key: string; title: string; note: string; ys: number[]; line?: [number, number]; zero?: boolean }

const N = 36
const mk = (seed: number, f: (i: number, w: number) => number) => wobble(seed, N).map((w, i) => f(i, w))

const SCALES: Sample[] = [
  { key: 'significant', title: 'Significant', note: 'The climb is much bigger than the wobble.', ys: mk(11, (i, w) => i * 0.045 + w * 0.22), line: [0, 0.045 * (N - 1)] },
  { key: 'needs_more_years', title: 'Needs more years', note: 'Maybe a climb, but the wobble hides it.', ys: mk(23, (i, w) => i * 0.012 + w * 0.6), line: [0.1, 0.012 * (N - 1)] },
  { key: 'not_significant', title: 'Not significant', note: 'Flat. Just wobble around a level line.', ys: mk(37, (_i, w) => w * 0.35), line: [0, 0] },
]
const SEASON: Sample[] = [
  { key: 'raw', title: 'Before the filter', note: 'The yearly wave is so big it hides everything else.', ys: mk(5, (i, w) => Math.sin(i * 1.05) * 0.9 + i * 0.012 + w * 0.12) },
  { key: 'filtered', title: 'After the filter', note: 'Wave removed. A slow drift away from zero shows up.', ys: mk(5, (i, w) => (i - N / 2) * 0.03 + w * 0.25), zero: true },
]
const LAMP: Sample[] = [
  { key: 'spiky', title: 'El Niño did it', note: 'A few spike years made the tilt. Remove them and it goes flat.', ys: mk(9, (i, w) => (i % 9 === 7 || i === 33 ? 1.3 : 0) + w * 0.18) },
  { key: 'steady', title: 'El Niño did not do it', note: 'The climb is steady, spike years or not.', ys: mk(13, (i, w) => i * 0.04 + (i % 9 === 4 ? 0.4 : 0) + w * 0.15), line: [0, 0.04 * (N - 1)] },
]
const RULER: Sample[] = [
  { key: 'good', title: 'A good fit', note: 'About as many dots above the line as below, all along it.', ys: mk(17, (i, w) => i * 0.03 + w * 0.3), line: [0, 0.03 * (N - 1)] },
  { key: 'bad', title: 'A poor fit', note: 'The line leaves the dots behind at one end.', ys: mk(17, (i, w) => i * 0.03 + w * 0.3), line: [0.9, 0.2] },
]

function Mini({ s, on }: { s: Sample; on: boolean }) {
  const W = 150, H = 70, pad = 6
  const all = [...s.ys, ...(s.line ?? []), ...(s.zero ? [0] : [])]
  const lo = Math.min(...all), hi = Math.max(...all)
  const x = (i: number) => pad + (i / (N - 1)) * (W - 2 * pad)
  const y = (v: number) => H - pad - ((v - lo) / (hi - lo || 1)) * (H - 2 * pad)
  return (
    <figure className={`sample ${on ? 'on' : ''}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Made-up example: ${s.title}. ${s.note}`}>
        {s.zero && <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} stroke="#999" strokeDasharray="3 3" />}
        <polyline fill="none" stroke="#7a3e1d" strokeWidth="1.4" points={s.ys.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} />
        {s.line && <line x1={x(0)} y1={y(s.line[0])} x2={x(N - 1)} y2={y(s.line[1])} stroke="#c8102e" strokeWidth="1.6" strokeDasharray="5 3" />}
      </svg>
      <figcaption><strong>{s.title}</strong>{on && <em> ← yours looks most like this</em>}<span>{s.note}</span></figcaption>
    </figure>
  )
}

/** Sample pictures for a tool. `stamp` highlights the one that matches the student's result. */
export function Samples({ tool, stamp }: { tool: Tool | 'myline'; stamp?: Stamp | null }) {
  const set = tool === 'season' ? SEASON : tool === 'elnino' ? LAMP : tool === 'ruler' || tool === 'myline' ? RULER
    : tool === 'scales' || tool === 'twin' ? SCALES : null
  if (!set) return null
  return (
    <aside className="samples" aria-label="Sample pictures to compare with yours">
      <p className="samples-head">Compare with these <strong>made-up examples</strong> (not this case's data):</p>
      <div className="samples-row">{set.map((s) => <Mini key={s.key} s={s} on={!!stamp && s.key === stamp && set === SCALES} />)}</div>
    </aside>
  )
}
