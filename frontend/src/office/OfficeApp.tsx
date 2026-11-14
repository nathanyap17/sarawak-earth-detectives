// The 3D office, full screen. The student clicks objects (or their labels) to open that
// object's window; the camera glides in, and back out to the whole room when the window closes.
// Kenyalang the hornbill guides every step. Same seven beats and store as lite mode.
// Keyboard: Tab through labels, 1–7 to open a beat already reached, I for the inbox, Esc to close.
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
import { BEATS, useSession, type Beat } from '../state/session'
import { Guide } from './Guide'
import { SPOT } from './script'
import { Hornbill } from './Hornbill'
import { Inbox } from './Inbox'
import { saveLearnt } from './learnt'
import { MapTable, useScene } from './MapTable'
import { Room } from './Room'
import { Labels } from './Spot'
import { OVERVIEW, STATIONS } from './stations'
import { useUI } from './ui'

/** Pixel width the window covers on the right (matches .office-window in index.css). */
function windowPx(w: number) { return Math.min(540, 0.46 * w) + 24 }

function CameraRig() {
  const win = useUI((u) => u.win)
  const { camera, size } = useThree()
  const look = useRef(new Vector3(...OVERVIEW.look))
  const goalP = useRef(new Vector3()), goalL = useRef(new Vector3())
  const shift = useRef(0)
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 2.5)        // smooth glide, frame-rate independent
    // while a window is open, shift the projection so the object sits in the free area
    const cam = camera as PerspectiveCamera
    const want = win ? windowPx(size.width) : 0
    shift.current += (want - shift.current) * k
    const p = Math.round(shift.current), full = size.width + p
    if (cam.view?.offsetX !== p || cam.view?.fullWidth !== full || cam.view?.height !== size.height || Math.abs(cam.aspect - full / size.height) > 1e-6) {
      cam.aspect = full / size.height
      cam.setViewOffset(full, size.height, p, 0, size.width, size.height)
      cam.updateProjectionMatrix()
    }
    const st = win ? STATIONS[win] : OVERVIEW
    goalL.current.set(...st.look)
    // stations are framed for a free area about as wide as it is tall; step back on narrower ones
    const free = Math.max(1, size.width - want)
    const back = win ? Math.min(1.6, Math.max(1, size.height / free)) : Math.min(1.5, Math.max(1, (1.5 * size.height) / free))
    goalP.current.set(...st.pos).sub(goalL.current).multiplyScalar(back).add(goalL.current)
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
      <button className="primary" disabled={cluePins.length < 1} onClick={onDone}>Done here: back to the office</button>
    </section>
  )
}

export function OfficeApp({ onLite, onHome }: { onLite: () => void; onHome?: () => void }) {
  const { beat, setBeat, sessionId, activeCase, reached, reset, grade } = useSession()
  const { win, setWin, setIdle } = useUI()
  const scene = useScene(activeCase?.id)
  const [slow, setSlow] = useState(false)

  useEffect(() => { logQuiet(sessionId, { kind: 'beat', beat }) }, [beat, sessionId])

  // a beat finished: step to the next one and return to the whole office, where its object glows
  const finish = (next: Beat) => {
    const frontier = BEATS[Math.max(reached, BEATS.indexOf(next))]   // revisiting an earlier object never moves you back
    setBeat(frontier); setWin(frontier === 'closed' ? 'closed' : null)
  }
  const close = () => { if (activeCase) setBeat(BEATS[reached]); setWin(null) }
  // signing the folder starts the session (CallBeat sets the beat to 'scene'): back to the office
  const hadCase = useRef(!!activeCase)
  useEffect(() => {
    if (!hadCase.current && activeCase && win === 'call') setWin(null)
    hadCase.current = !!activeCase
  }, [activeCase, win, setWin])

  // file a solved case under "Learnt cases" (this browser only)
  useEffect(() => {
    if (!grade || grade.ending === 'sent_back' || !activeCase) return
    const st = useSession.getState()
    const TOOL: Record<string, string> = { magnifier: 'magnifier', season: 'season filter', ruler: 'ruler', scales: 'scales', elnino: 'El Niño lamp', twin: 'twin map' }
    const tools = [...new Set(Object.values(st.results).flatMap((r) => Object.keys(r ?? {})))].map((t) => TOOL[t] ?? t)
    saveLearnt({
      id: activeCase.id, title: activeCase.title, score: grade.score,
      ending: grade.ending === 'solved_not_enough' ? 'Solved: not enough evidence yet' : 'Solved',
      date: new Date().toISOString().slice(0, 10),
      variables: activeCase.evidence.filter((e) => st.chosen.includes(e.id)).map((e) => e.name), tools,
      verdict: st.draft ? `${st.draft.direction.replace('_', ' ')}; is it real: ${{ yes: 'yes', no: 'no', cant_tell: "can't tell" }[st.draft.is_it_real]}` : '',
    })
  }, [grade, activeCase])

  // idle → show every label and let the guide nudge
  useEffect(() => {
    let t = window.setTimeout(() => setIdle(true), 7000)
    const wake = () => { setIdle(false); clearTimeout(t); t = window.setTimeout(() => setIdle(true), 7000) }
    const evs = ['pointermove', 'keydown', 'pointerdown'] as const
    evs.forEach((e) => window.addEventListener(e, wake))
    return () => { clearTimeout(t); evs.forEach((e) => window.removeEventListener(e, wake)) }
  }, [setIdle])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); return }
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return
      if (e.key.toLowerCase() === 'i') { setWin('inbox'); return }
      const i = Number(e.key) - 1
      if (i >= 0 && i < BEATS.length && (i === 0 || (activeCase && i <= reached))) { setBeat(BEATS[i]); setWin(BEATS[i]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="office">
      <div className="stage">
        <Canvas dpr={[1, 1.5]} camera={{ fov: 50, position: OVERVIEW.pos, near: 0.05, far: 60 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}>
          <color attach="background" args={['#120d0a']} />
          <hemisphereLight args={['#ffd9a8', '#3a2a20', 0.9]} />
          <directionalLight position={[0, 3, -3.5]} intensity={0.9} color="#ffb070" />
          <directionalLight position={[2, 5, 7]} intensity={0.6} color="#ffe8cc" />
          <pointLight position={[0, 3.1, 0]} intensity={2.2} distance={8} color="#ffe2b8" />
          <Room />
          <Hornbill />
          <MapTable scene={scene} />
          <CameraRig />
          <FpsProbe onLow={() => setSlow(true)} />
        </Canvas>
      </div>
      <Labels />
      <header className="office-top">
        {onHome ? <button className="brand" onClick={onHome} title="Back to the front page">Sarawak Earth Detectives</button> : <h1>Sarawak Earth Detectives</h1>}
        {activeCase && <span className="case-chip">Case {activeCase.id}</span>}
        <button className="mode" onClick={() => setWin(win === 'inbox' ? null : 'inbox')}>✉ Inbox</button>
        <button className="mode" onClick={onLite} aria-label="Switch to the 2D lite mode">2D</button>
      </header>
      {slow && (
        <p className="office-note" role="status">The office is running slowly on this device.
          <button onClick={onLite}>Switch to 2D</button></p>
      )}
      {win && (
        <aside className="office-window" aria-label={SPOT[win].name}>
          <header className="win-bar">
            <strong>{SPOT[win].name}</strong>
            <button onClick={close} aria-label={`Close the ${SPOT[win].name.toLowerCase()} and go back to the office`}>✕</button>
          </header>
          <div className="win-body">
            {win === 'inbox' && <Inbox />}
            {win === 'call' && (!activeCase ? <CallBeat /> : (
              <article className="folder"><p className="folder-tab">Case {activeCase.id} · {activeCase.type}</p><h2>{activeCase.title}</h2>
                <blockquote className="brief">“{activeCase.brief}”<footer>— The Client</footer></blockquote>
                <p className="question"><strong>The question:</strong> {activeCase.question}</p></article>
            ))}
            {win === 'scene' && <ScenePanel scene={scene} onDone={() => finish('locker')} />}
            {win === 'locker' && <LockerBeat onDone={() => finish('board')} />}
            {win === 'board' && <BoardBeat onDone={() => finish('lab')} />}
            {win === 'lab' && <LabBeat onDone={() => finish('deduction')} />}
            {win === 'deduction' && <DeductionBeat onDone={() => finish('closed')} />}
            {win === 'closed' && (grade
              ? <ClosedBeat onRetry={() => { setBeat('deduction'); setWin('deduction') }} onShelf={() => { reset(); setWin('inbox') }} />
              : <p className="muted">Nothing filed yet. The Chief stamps your case after you write the verdict.</p>)}
            <p className="source foot-note">Data: NASA POWER (MERRA-2), NASA GIBS (VIIRS), NOAA RONI. Numbers come from statistics code, not AI.</p>
          </div>
        </aside>
      )}
      <Guide />
    </div>
  )
}
