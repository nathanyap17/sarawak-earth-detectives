// Beat 2, The Scene: Sarawak from space, a time slider of satellite fire detections,
// and up to three clue pins. Imagery is saved NASA GIBS files (never fetched live).
// AI-assisted: written with Claude Code.
import { useEffect, useRef, useState } from 'react'
import type { Region, SceneManifest } from '../api/types'
import { useSession } from '../state/session'
import { firesNote, PinReports, TownLabels, useFires } from './PinReport'
import { loadManifest, placePin } from './pins'
import { fiveDay, RainDays, useRain } from './RainScene'
import { sceneLayer, useSeaMask } from './scenekit'

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
  const rain = useRain(c?.id, c?.type)
  const sea = useSeaMask(base, m)
  const layer = sceneLayer(c?.type)
  const wet = rain && rain.days.length ? Math.min(day, rain.days.length - 1) : -1
  const mm = wet >= 0 ? rain!.days[wet].mm : 0, five = wet >= 0 ? fiveDay(rain!.days, wet) : 0

  useEffect(() => { loadManifest(c!.id).then((x) => { setBase(x.dir); setM(x.m) }).catch(() => setM(null)) }, [c])
  useEffect(() => {
    if (!playing || !m || !m.fire_days.length) return
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
  const hasDays = layer === 'fires' && m.fire_days.length > 0
  return (
    <section className="beat">
      <h2>The Scene</h2>
      {rain ? <p>This is Sarawak seen from space. Over the yellow box, the sky follows NASA's daily rain record, {c!.scene.from} to {c!.scene.to}:
        heavier rain, darker cloud. The blue tint rises with the rain of the last five days. Press <strong>Play</strong>, then <strong>tap the map</strong> to
        pin up to three places: low ground by a river, the coast, the hills.</p>
      : hasDays ? <p>This is Sarawak seen from space, {c!.scene.from} to {c!.scene.to}. Every red dot is a fire a NASA satellite spotted from
        about 830 km up. Press <strong>Play</strong> to watch the season, then <strong>tap the map</strong> to pin up to three places
        that puzzle you. Each pin gives you a clue report.</p>
        : <p>This is Sarawak seen from space. The yellow box is the region this case is about: every record you test is an average
          over that box. <strong>Tap the map</strong> to pin up to three places and compare them. You can move or remove a pin at any time.</p>}
      <div className="map" ref={mapRef} onClick={drop} style={{ aspectRatio: `${m.width} / ${m.height}` }}
        role="img" aria-label={hasDays ? `Satellite map of Sarawak with fire detections for ${m.fire_days[day]}` : 'Satellite map of Sarawak with the case region'}>
        <img src={`${base}/${m.base}`} alt="" draggable={false} />
        {/* the fires come from the same cleaned point list as the 3D map: hot spots on the sea are left out */}
        {hasDays && fires.filter((f) => f[0] === day).map((f, k) => (
          <i key={k} className="fire-dot" style={{ left: `${((f[1] - W) / (E - W)) * 100}%`, top: `${((N - f[2]) / (N - S)) * 100}%` }} />
        ))}
        <TownLabels m={m} />
        <div className="region-box" style={boxStyle(c!.region, m)}>
          {wet >= 0 && <i className="wx" aria-hidden="true" style={{ ['--rain' as string]: Math.min(1, Math.pow(mm / 120, 0.7)), ['--cloud' as string]: Math.min(1, mm / 35), ['--water' as string]: Math.min(1, five / 450) }} />}
          <span>{c!.region.name}</span></div>
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
      {rain && <RainDays rain={rain} day={day} setDay={setDay} playing={playing} setPlaying={setPlaying} />}
      <p className="source">Imagery: {m.base_source}.{hasDays && ` Fires: ${m.fires_source}.${firesNote(m)}`}
        {hasDays && m.missing_days.length > 0 && ` No fire image for ${m.missing_days.join(', ')}.`}</p>
      <p><strong>Clue pins: {cluePins.length}/3</strong></p>
      <PinReports pins={cluePins} fires={fires} m={m} region={c!.region} day={day} onJump={(d) => { setPlaying(false); setDay(d) }} layer={layer} sea={sea} />
      <button className="primary" disabled={cluePins.length < 1} onClick={onDone}>Go to the Evidence Locker</button>
    </section>
  )
}
