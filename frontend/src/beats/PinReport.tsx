// What a clue pin tells you. Dropping a pin is a question: "what did the satellite see here?"
// The answer is counted from the case's saved NASA VIIRS fire detections (the same file the
// map draws): how many fires within 25 km, on how many days, and when it was busiest.
// Shared by the 2D scene and the 3D map table. Counting only: no statistics, no AI.
// AI-assisted: written with Claude Code.
import { useEffect, useState } from 'react'
import type { Region, SceneManifest } from '../api/types'
import { useSession } from '../state/session'
import { MAX_PINS, removePin } from './pins'

export type Fire = [day: number, lon: number, lat: number]
export const NEAR_KM = 25

/** Towns for labels and "near …" (approximate centres). */
export const TOWNS: { name: string; lon: number; lat: number; major?: boolean }[] = [
  { name: 'Kuching', lon: 110.35, lat: 1.55, major: true }, { name: 'Sibu', lon: 111.83, lat: 2.29, major: true },
  { name: 'Bintulu', lon: 113.03, lat: 3.17, major: true }, { name: 'Miri', lon: 113.99, lat: 4.4, major: true },
  { name: 'Tatau', lon: 112.85, lat: 2.88 }, { name: 'Mukah', lon: 112.09, lat: 2.9 }, { name: 'Kapit', lon: 112.94, lat: 2.02 },
  { name: 'Belaga', lon: 113.78, lat: 2.7 }, { name: 'Marudi', lon: 114.32, lat: 4.18 }, { name: 'Limbang', lon: 115.0, lat: 4.75 },
  { name: 'Sri Aman', lon: 111.46, lat: 1.24 }, { name: 'Sarikei', lon: 111.52, lat: 2.13 }, { name: 'Batu Niah', lon: 113.72, lat: 3.87 },
]

function km(aLon: number, aLat: number, bLon: number, bLat: number) {
  const dy = (aLat - bLat) * 111, dx = (aLon - bLon) * 111 * Math.cos((aLat * Math.PI) / 180)
  return Math.hypot(dx, dy)
}

export interface Report {
  town: string; townKm: number; inRegion: boolean
  total: number; days: number; busiest: number; busiestCount: number; perDay: number[]; longestRun: number
}

export function pinReport([lon, lat]: [number, number], fires: Fire[], nDays: number, region: Region): Report {
  const t = TOWNS.map((x) => ({ x, d: km(lon, lat, x.lon, x.lat) })).sort((a, b) => a.d - b.d)[0]
  const perDay = new Array<number>(nDays).fill(0)
  for (const f of fires) if (km(lon, lat, f[1], f[2]) <= NEAR_KM) perDay[f[0]]++
  let busiest = 0, run = 0, longestRun = 0
  perDay.forEach((c, i) => { if (c > perDay[busiest]) busiest = i; run = c > 0 ? run + 1 : 0; longestRun = Math.max(longestRun, run) })
  const [w, s, e, n] = region.bbox
  return {
    town: t.x.name, townKm: Math.round(t.d), inRegion: lon >= w && lon <= e && lat >= s && lat <= n,
    total: perDay.reduce((a, b) => a + b, 0), days: perDay.filter((c) => c > 0).length,
    busiest, busiestCount: perDay[busiest], perDay, longestRun,
  }
}

/** A question for the detective, chosen from what the pin found. */
function question(r: Report): string {
  if (r.total === 0) return 'No fires were seen here all season. What is different about this spot? Higher ground, forest, or wetter soil? A quiet place is a clue too.'
  if (r.longestRun >= 5) return `Fires were seen here ${r.longestRun} days in a row. Ordinary fires burn out quickly. What kind of ground keeps burning for days? In the Evidence Locker, look for records about how dry the ground and the air were.`
  if (r.days >= 8) return 'Fires kept coming back here through the season. Does the ground dry out more in some months? Look for a record that measures dryness.'
  return 'Only a few fires here. Compare it with your other pins: why did one place burn more than another?'
}

export function useFires(dir: string | undefined, m: SceneManifest | null): Fire[] {
  const [fires, setFires] = useState<Fire[]>([])
  useEffect(() => {
    if (!dir || !m?.fire_points) return
    let live = true
    fetch(`${dir}/${m.fire_points.file}`).then((r) => r.json()).then((f) => { if (live) setFires(f) }).catch(() => undefined)
    return () => { live = false }
  }, [dir, m])
  return fires
}

function Spark({ perDay, day, busiest }: { perDay: number[]; day: number; busiest: number }) {
  const W = 220, H = 34, top = Math.max(1, ...perDay), bw = W / perDay.length
  return (
    <svg className="pin-spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Fires seen near this pin, day by day">
      {perDay.map((c, i) => c > 0 && (
        <rect key={i} x={i * bw} y={H - (c / top) * (H - 2)} width={Math.max(1, bw - 0.6)} height={(c / top) * (H - 2)} fill={i === busiest ? '#c8102e' : '#e08a4a'} />
      ))}
      <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} stroke="#bbb" />
      <line x1={(day + 0.5) * bw} x2={(day + 0.5) * bw} y1={0} y2={H} stroke="#1f6f8b" strokeDasharray="2 2" />
    </svg>
  )
}

/** Why pins matter, the map key, and one report card per pin. */
export function PinReports({ pins, fires, m, region, day, onJump, heightAt }: {
  pins: [number, number][]; fires: Fire[]; m: SceneManifest; region: Region; day: number; onJump: (day: number) => void
  heightAt?: (lon: number, lat: number) => number | null
}) {
  const { movingPin, setMovingPin } = useSession()
  const hasFires = !!m.fire_points
  return (
    <div className="pin-reports">
      <ul className="map-key" aria-label="Map key">
        {hasFires && <li><i className="k-fire" /> A fire the satellite saw that day</li>}
        <li><i className="k-box" /> The case region: your records are averages of this box</li>
        <li><i className="k-pin" /> Your clue pins</li>
      </ul>
      {pins.length === 0 && (
        <p className="pin-why"><strong>Why drop pins?</strong> {hasFires
          ? <>A pin asks the satellite a question: <em>what did you see right here?</em> Press Play, watch where fires start and where they keep burning, then pin up to three places that puzzle you.</>
          : <>A pin asks: <em>what kind of place is this?</em> Pin up to three places: one inside the yellow box, one outside, one on high ground. Compare what each report says.</>}
          {' '}Each pin gives you a clue report, and you can move or remove a pin at any time.</p>
      )}
      {movingPin != null && <p className="pin-moving" role="status">Now tap the map where pin {movingPin + 1} should go. <button onClick={() => setMovingPin(null)}>Cancel</button></p>}
      {movingPin == null && pins.length >= MAX_PINS && <p className="muted">All three pins are placed. Want to look somewhere else? Press <strong>Move</strong> on a pin, then tap the map.</p>}
      {pins.map((p, i) => {
        const r = pinReport(p, fires, m.fire_days.length, region)
        const h = heightAt?.(p[0], p[1])
        return (
          <article key={i} className={`pin-card ${movingPin === i ? 'moving' : ''}`}>
            <header><span className="pin-no">{i + 1}</span>
              <strong>{r.townKm <= 5 ? `At ${r.town}` : `About ${r.townKm} km from ${r.town}`}</strong>
              <small>{p[1].toFixed(2)}°N, {p[0].toFixed(2)}°E</small>
              <span className="pin-actions">
                <button onClick={() => setMovingPin(movingPin === i ? null : i)} aria-pressed={movingPin === i}>{movingPin === i ? 'Cancel move' : 'Move'}</button>
                <button onClick={() => removePin(i)} aria-label={`Remove pin ${i + 1}`}>Remove</button>
              </span></header>
            {hasFires && fires.length === 0 ? <p className="muted">Reading the satellite log…</p> : !hasFires ? (
              <>
                {h != null && <p>The ground here is about <strong>{Math.round(h / 10) * 10} m</strong> above the sea.{' '}
                  {h < 40 ? 'Low, flat land near the coast: this is where most people in Sarawak live, and where the peat swamps are.' : h > 400 ? 'This is hill country. Hills are cooler and catch more rain than the coast.' : 'This is gently rising inland ground.'}</p>}
                <p className={r.inRegion ? 'pin-in' : 'pin-out'}>{r.inRegion
                  ? 'Inside the yellow box, so the records you test later include this place.'
                  : 'Outside the yellow box, so the records you test later do not include this place. Still a fair clue for comparing.'}</p>
                <p className="pin-q">🕵️ {r.inRegion
                  ? `Your records are one average for the whole yellow box, which is more than a hundred kilometres wide. Would ${r.town} feel the same as a hill village in that box? Keep that in mind when you write "where".`
                  : `This place is outside the case box. If the same thing is happening here too, is the change local or much wider? The twin map in the lab can help.`}</p>
              </>
            ) : (
              <>
                <p>{r.total === 0
                  ? <>The satellite saw <strong>no fires</strong> within {NEAR_KM} km of this pin, {m.fire_days[0]} to {m.fire_days[m.fire_days.length - 1]}.</>
                  : <>The satellite saw <strong>{r.total} fire detections</strong> within {NEAR_KM} km, on <strong>{r.days} {r.days === 1 ? 'day' : 'different days'}</strong>.
                    The busiest day was <strong>{m.fire_days[r.busiest]}</strong> ({r.busiestCount} detections).</>}</p>
                {r.total > 0 && <Spark perDay={r.perDay} day={day} busiest={r.busiest} />}
                {r.total > 0 && <p className="spark-note">Each bar is one day. Red is the busiest day. The dotted line is the day on the map.{' '}
                  <button onClick={() => onJump(r.busiest)}>Show the busiest day</button></p>}
                {h != null && <p>The ground here is about <strong>{Math.round(h / 10) * 10} m</strong> above the sea.{' '}
                  {h < 40 ? 'Low, flat land like this near the coast is where the peat swamps of Sarawak are found.' : h > 400 ? 'This is hill country, far from the coastal swamps.' : 'This is gently rising inland ground.'}</p>}
                <p className={r.inRegion ? 'pin-in' : 'pin-out'}>{r.inRegion
                  ? 'Inside the yellow box, so the records you test later include this place.'
                  : 'Outside the yellow box, so the records you test later do not include this place. Still a fair clue for comparing.'}</p>
                <p className="pin-q">🕵️ {question(r)}</p>
              </>
            )}
          </article>
        )
      })}
      {pins.length > 0 && hasFires && <p className="source">Pin reports count NASA VIIRS (Suomi NPP) 375 m fire detections saved for this case. One detection is one hot pixel on one day, not one separate fire.</p>}
    </div>
  )
}

/** Town labels placed over the 2D map (percent positions inside the map box). */
export function TownLabels({ m }: { m: SceneManifest }) {
  const [W, S, E, N] = m.bbox
  return (
    <>
      {TOWNS.filter((t) => t.lon > W && t.lon < E && t.lat > S && t.lat < N).map((t) => (
        <span key={t.name} className={`town ${t.major ? 'major' : ''}`} style={{ left: `${((t.lon - W) / (E - W)) * 100}%`, top: `${((N - t.lat) / (N - S)) * 100}%` }}>{t.name}</span>
      ))}
    </>
  )
}
