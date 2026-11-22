// Flood and heavy-rain cases: the scene's daily rain over the case region, read by code from the
// vault (GET /cases/{id}/rain, NASA POWER), and the Play/slider row that walks through it. The map's
// rain, clouds and rising water are drawn from these numbers; they are an illustration, not a flood map.
// AI-assisted: written with Claude Code.
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { CaseType, SceneRain } from '../api/types'

export const isWet = (t: CaseType | undefined) => t === 'flood'

export function useRain(caseId: string | undefined, type: CaseType | undefined) {
  const [rain, setRain] = useState<SceneRain | null>(null)
  useEffect(() => {
    setRain(null)
    if (!caseId || !isWet(type)) return
    let live = true
    api.rain(caseId).then((r) => { if (live) setRain(r) }).catch(() => undefined)
    return () => { live = false }
  }, [caseId, type])
  return rain
}

/** Rain over the five days ending on day i: what the rising water follows. */
export function fiveDay(days: { mm: number }[], i: number) {
  let s = 0
  for (let k = Math.max(0, i - 4); k <= i; k++) s += days[k]?.mm ?? 0
  return s
}

/** How the day's rain reads in words, from the day's regional average (code thresholds, not AI). */
export function rainWords(mm: number) {
  if (mm < 1) return 'dry'
  if (mm < 10) return 'light rain'
  if (mm < 30) return 'steady rain'
  if (mm < 60) return 'heavy rain'
  if (mm < 120) return 'very heavy rain'
  return 'extreme rain'
}

export function RainDays({ rain, day, setDay, playing, setPlaying }: {
  rain: SceneRain; day: number; setDay: (d: number) => void; playing: boolean; setPlaying: (p: boolean) => void
}) {
  const n = rain.days.length
  useEffect(() => {
    if (!playing || n === 0) return
    const t = setInterval(() => setDay((day + 1) % n), 220)
    return () => clearInterval(t)
  }, [playing, n, day, setDay])
  if (n === 0) return <p className="muted">No daily rain saved for this region.</p>
  const i = Math.min(day, n - 1)
  const d = rain.days[i], five = fiveDay(rain.days, i)
  const wettest = rain.days.reduce((b, x, k) => (x.mm > rain.days[b].mm ? k : b), 0)
  const max = Math.max(...rain.days.map((x) => x.mm), 1)
  return (
    <div className="rain-days">
      <div className="slider-row">
        <button onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play'}</button>
        <input type="range" min={0} max={n - 1} value={i} onChange={(e) => { setPlaying(false); setDay(+e.target.value) }} aria-label="Day" />
        <output>{d.d}</output>
      </div>
      <div className="rain-bars" aria-hidden="true">
        {rain.days.map((x, k) => (
          <button key={x.d} tabIndex={-1} className={k === i ? 'now' : k === wettest ? 'top' : ''} style={{ height: `${Math.max(2, (x.mm / max) * 100)}%` }}
            title={`${x.d}: ${x.mm.toFixed(1)} mm`} onClick={() => { setPlaying(false); setDay(k) }} />
        ))}
      </div>
      <p className="rain-today"><strong>{d.mm.toFixed(1)} mm</strong> of rain that day ({rainWords(d.mm)}), averaged over the yellow box.
        {' '}Five days to then: <strong>{five.toFixed(0)} mm</strong>.{' '}
        <button className="linkish" onClick={() => { setPlaying(false); setDay(wettest) }}>Show the wettest day</button></p>
      <p className="source">{rain.source}, as of {rain.data_as_of}. {rain.note} The rain, clouds and water on the map follow these numbers:
        they are an illustration, not a flood map.</p>
    </div>
  )
}
