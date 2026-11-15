// Beat 2, The Scene: Sarawak from space, a time slider of satellite fire detections,
// and up to three clue pins. Imagery is saved NASA GIBS files (never fetched live).
// AI-assisted: written with Claude Code.
import { useEffect, useRef, useState } from 'react'
import type { Region, SceneManifest } from '../api/types'
import { useSession } from '../state/session'
import { PinReports, TownLabels, useFires } from './PinReport'
import { loadManifest, placePin } from './pins'

function boxStyle(r: Region, m: SceneManifest) {
  const [W, S, E, N] = m.bbox
  const [w, s, e, n] = r.bbox
  return {
    left: `${((w - W) / (E - W)) * 100}%`, top: `${((N - n) / (N - S)) * 100}%`,
    width: `${((e - w) / (E - W)) * 100}%`, height: `${((n - s) / (N - S)) * 100}%`,
  }
}

export function SceneBeat({ onDone }: { onDone: () => void }) {
  const { activeCase: c, cluePins, movingPin } = useSession()
  const [m, setM] = useState<SceneManifest | null>(null)
  const [day, setDay] = useState(0)
  const [playing, setPlaying] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const [base, setBase] = useState<string>()
  const fires = useFires(base, m)

  useEffect(() => { loadManifest(c!.id).then((x) => { setBase(x.dir); setM(x.m) }).catch(() => setM(null)) }, [c])
  useEffect(() => {
    if (!playing || !m) return
    const t = setInterval(() => setDay((d) => (d + 1) % m.fire_days.length), 180)
    return () => clearInterval(t)
  }, [playing, m])

  function drop(e: React.MouseEvent<HTMLDivElement>) {
    if (!m) return
    const rect = mapRef.current!.getBoundingClientRect()
    const [W, S, E, N] = m.bbox
    const lon = W + ((e.clientX - rect.left) / rect.width) * (E - W)
    const lat = N - ((e.clientY - rect.top) / rect.height) * (N - S)
    const p: [number, number] = [+lon.toFixed(3), +lat.toFixed(3)]
    placePin(p)
  }

  if (!m) return <p className="muted">Flying to the scene…</p>
  const [W, S, E, N] = m.bbox
  const hasDays = m.fire_days.length > 0
  return (
    <section className="beat">
      <h2>The Scene</h2>
      {hasDays ? <p>This is Sarawak seen from space, {c!.scene.from} to {c!.scene.to}. Every red dot is a fire a NASA satellite spotted from
        about 830 km up. Press <strong>Play</strong> to watch the season, then <strong>tap the map</strong> to pin up to three places
        that puzzle you. Each pin gives you a clue report.</p>
        : <p>This is Sarawak seen from space. The yellow box is the region this case is about: every record you test is an average
          over that box. <strong>Tap the map</strong> to pin up to three places and compare them. You can move or remove a pin at any time.</p>}
      <div className="map" ref={mapRef} onClick={drop} style={{ aspectRatio: `${m.width} / ${m.height}` }}
        role="img" aria-label={hasDays ? `Satellite map of Sarawak with fire detections for ${m.fire_days[day]}` : 'Satellite map of Sarawak with the case region'}>
        <img src={`${base}/${m.base}`} alt="" draggable={false} />
        {hasDays && <img src={`${base}/fires_${m.fire_days[day]}.png`} alt="" draggable={false} className="overlay" />}
        <TownLabels m={m} />
        <div className="region-box" style={boxStyle(c!.region, m)}><span>{c!.region.name}</span></div>
        {cluePins.map(([lon, lat], i) => (
          <span key={i} className={`pin ${movingPin === i ? 'moving' : ''}`} style={{ left: `${((lon - W) / (E - W)) * 100}%`, top: `${((N - lat) / (N - S)) * 100}%` }}>{i + 1}</span>
        ))}
      </div>
      {hasDays && <div className="slider-row">
        <button onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play'}</button>
        <input type="range" min={0} max={m.fire_days.length - 1} value={day}
          onChange={(e) => { setPlaying(false); setDay(+e.target.value) }} aria-label="Day" />
        <output>{m.fire_days[day]}</output>
      </div>}
      <p className="source">Imagery: {m.base_source}.{hasDays && ` Fires: ${m.fires_source}.`}
        {m.missing_days.length > 0 && ` No fire image for ${m.missing_days.join(', ')}.`}</p>
      <p><strong>Clue pins: {cluePins.length}/3</strong></p>
      <PinReports pins={cluePins} fires={fires} m={m} region={c!.region} day={day} onJump={(d) => { setPlaying(false); setDay(d) }} />
      <button className="primary" disabled={cluePins.length < 1} onClick={onDone}>Go to the Evidence Locker</button>
    </section>
  )
}
