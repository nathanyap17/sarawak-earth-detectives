// The 3D office (PLAN Phase 3.5): the same seven beats and store as lite mode, with the camera
// gliding between stations and the beat's controls on a paper panel beside the object.
// Keyboard: 1–7 (or the station buttons, reachable with Tab) jump to any beat already reached.
// AI-assisted: written with Claude Code.
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { Vector3, type PerspectiveCamera } from 'three'
import { logQuiet } from '../api/client'
import { BoardBeat } from '../beats/BoardBeat'
import { CallBeat } from '../beats/CallBeat'
import { ClosedBeat } from '../beats/ClosedBeat'
import { DeductionBeat } from '../beats/DeductionBeat'
import { LabBeat } from '../beats/LabBeat'
import { LockerBeat } from '../beats/LockerBeat'
import { Partner } from '../beats/Partner'
import { BEAT_LABEL, BEATS, useSession, type Beat } from '../state/session'
import { Hornbill } from './Hornbill'
import { MapTable, useScene } from './MapTable'
import { Room } from './Room'
import { STATIONS } from './stations'

/** Pixel width the paper panel covers on the right (matches .office-panel in index.css). */
function panelPx(w: number) { return Math.min(500, 0.42 * w) + 24 }

function CameraRig() {
  const beat = useSession((s) => s.beat)
  const { camera, size } = useThree()
  const look = useRef(new Vector3(...STATIONS.call.look))
  const goalP = useRef(new Vector3()), goalL = useRef(new Vector3())
  useFrame((_, dt) => {
    // shift the projection so the station's object sits in the middle of the area the panel leaves free
    const cam = camera as PerspectiveCamera
    const p = panelPx(size.width), full = size.width + p
    if (cam.view?.offsetX !== p || cam.view?.fullWidth !== full || cam.view?.height !== size.height || Math.abs(cam.aspect - full / size.height) > 1e-6) {
      cam.aspect = full / size.height
      cam.setViewOffset(full, size.height, p, 0, size.width, size.height)
      cam.updateProjectionMatrix()
    }
    const st = STATIONS[beat]
    goalL.current.set(...st.look)
    // stations are framed for a free area about as wide as it is tall; step back on narrower ones
    const back = Math.min(1.6, Math.max(1, size.height / Math.max(1, size.width - p)))
    goalP.current.set(...st.pos).sub(goalL.current).multiplyScalar(back).add(goalL.current)
    const k = 1 - Math.exp(-dt * 2.5)        // smooth glide, frame-rate independent
    camera.position.lerp(goalP.current, k)
    look.current.lerp(goalL.current, k)
    camera.lookAt(look.current)
  })
  return null
}

function FpsProbe({ onLow }: { onLow: () => void }) {
  const acc = useRef({ t: 0, n: 0, bad: 0, skip: 3 })
  useFrame((_, dt) => {
    const a = acc.current
    if (dt > 0.5 || document.visibilityState !== 'visible') { a.t = 0; a.n = 0; return }  // throttled/hidden tab: not the device's fault
    a.t += dt; a.n++
    if (a.t >= 2) {
      const fps = a.n / a.t
      if (a.skip > 0) a.skip--                   // ignore the first seconds while textures upload
      else a.bad = fps < 20 ? a.bad + 1 : 0
      if (a.bad >= 4) onLow()                    // eight seconds under 20 fps → offer lite
      ;(window as Window & { __sedFps?: number }).__sedFps = Math.round(fps)
      a.t = 0; a.n = 0
    }
  })
  return null
}

function ScenePanel({ scene, onDone }: { scene: ReturnType<typeof useScene>; onDone: () => void }) {
  const { activeCase: c, cluePins, sceneDay, setSceneDay } = useSession()
  const [playing, setPlaying] = useState(false)
  const m = scene.m
  useEffect(() => {
    if (!playing || !m) return
    const t = setInterval(() => setSceneDay((useSession.getState().sceneDay + 1) % m.fire_days.length), 180)
    return () => clearInterval(t)
  }, [playing, m, setSceneDay])
  if (!m) return <p className="muted">Flying to the scene…</p>
  const count = scene.fires.filter((f) => f[0] === sceneDay).length
  return (
    <section className="beat">
      <h2>The Scene</h2>
      <p>The map table shows Sarawak in relief. Glowing embers are fires seen by satellite on the chosen day.
        Scrub {c!.scene.from} to {c!.scene.to}, then <strong>click the map</strong> to drop up to three clue pins.</p>
      <div className="slider-row">
        <button onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play'}</button>
        <input type="range" min={0} max={m.fire_days.length - 1} value={sceneDay}
          onChange={(e) => { setPlaying(false); setSceneDay(+e.target.value) }} aria-label="Day" />
        <output>{m.fire_days[sceneDay]}</output>
      </div>
      <p className="muted">{count} fire detections that day. Yellow box: {c!.region.name}.</p>
      <p className="source">Imagery: {m.base_source}. Fires: {m.fires_source}. Relief: {m.terrain?.source ?? 'flat'}, height exaggerated.
        {m.missing_days.length > 0 && ` No fire image for ${m.missing_days.join(', ')}.`}</p>
      <p>Clue pins: {cluePins.length}/3</p>
      <button className="primary" disabled={cluePins.length < 1} onClick={onDone}>Go to the Evidence Locker</button>
    </section>
  )
}

export function OfficeApp({ onLite, note }: { onLite: () => void; note?: string | null }) {
  const { beat, setBeat, sessionId, activeCase, reached, reset } = useSession()
  const scene = useScene(activeCase?.id)
  const [slow, setSlow] = useState(false)
  const panel = useRef<HTMLElement>(null)
  const go = (b: Beat) => { setBeat(b); panel.current?.scrollTo({ top: 0 }) }
  useEffect(() => { logQuiet(sessionId, { kind: 'beat', beat }) }, [beat, sessionId])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable]')) return
      const i = Number(e.key) - 1
      if (i >= 0 && i < BEATS.length && i <= reached && activeCase) go(BEATS[i])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="office">
      <div className="stage" aria-hidden="true">
        <Canvas shadows={false} dpr={[1, 1.5]} camera={{ fov: 50, position: STATIONS.call.pos, near: 0.05, far: 40 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}>
          <color attach="background" args={['#1d1612']} />
          <hemisphereLight args={['#ffd9a8', '#3a2a20', 0.9]} />
          <directionalLight position={[0, 3, -3.5]} intensity={0.9} color="#ffb070" />
          <pointLight position={[0, 3.1, 0]} intensity={2.2} distance={8} color="#ffe2b8" />
          <Room />
          <Hornbill />
          <MapTable scene={scene} />
          <CameraRig />
          <FpsProbe onLow={() => setSlow(true)} />
        </Canvas>
      </div>
      <header className="office-top">
        <h1>Sarawak Earth Detectives</h1>
        {activeCase && <span className="case-chip">Case {activeCase.id}</span>}
        <button className="mode" onClick={onLite} aria-label="Switch to the 2D lite mode">2D</button>
      </header>
      <nav className="stations" aria-label="Office stations">
        {BEATS.map((b, i) => (
          <button key={b} disabled={!activeCase || i > reached} className={b === beat ? 'on' : ''}
            aria-current={b === beat ? 'step' : undefined} onClick={() => go(b)} title={`${i + 1} · ${STATIONS[b].object}`}>
            <span>{i + 1}</span><em>{BEAT_LABEL[b]}</em>
          </button>
        ))}
      </nav>
      {(note || slow) && (
        <p className="office-note" role="status">{slow ? 'The office is running slowly on this device. ' : note}
          {slow && <button onClick={onLite}>Switch to 2D</button>}</p>
      )}
      <aside className="office-panel" ref={panel} aria-label={`${BEAT_LABEL[beat]}: ${STATIONS[beat].object}`}>
        {beat === 'call' && <CallBeat />}
        {beat === 'scene' && <ScenePanel scene={scene} onDone={() => go('locker')} />}
        {beat === 'locker' && <LockerBeat onDone={() => go('board')} />}
        {beat === 'board' && <BoardBeat onDone={() => go('lab')} />}
        {beat === 'lab' && <LabBeat onDone={() => go('deduction')} />}
        {beat === 'deduction' && <DeductionBeat onDone={() => go('closed')} />}
        {beat === 'closed' && <ClosedBeat onRetry={() => go('deduction')} onShelf={() => { reset(); go('call') }} />}
        <Partner />
        <p className="source foot-note">Data: NASA POWER (MERRA-2), NASA GIBS (VIIRS), NOAA RONI. Numbers come from statistics code, not AI.</p>
      </aside>
    </div>
  )
}
