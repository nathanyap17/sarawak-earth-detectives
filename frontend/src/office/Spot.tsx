// A clickable object in the office, plus the label layer.
// - <Spot> wraps a 3D object: click opens its window, hover shows its label, and each frame it
//   projects its label anchor to the screen.
// - <Labels> is plain DOM above the canvas. The object to go to next keeps its label and a
//   bouncing marker; when the student is idle every label appears. Labels are real buttons, so
//   the office also works by keyboard (Tab, Enter).
// AI-assisted: written with Claude Code.
import { useFrame, useThree } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import { Vector3, type Group } from 'three'
import { BEATS, useSession, type Beat } from '../state/session'
import { sfx } from '../sound/audio'
import { SPOT, target } from './script'
import { useGuideState } from './useGuideState'
import { useUI, type SpotId } from './ui'

const IDS = Object.keys(SPOT) as SpotId[]

function useEnabled() {
  const { reached, activeCase } = useSession()
  return (id: SpotId) => id === 'inbox' || id === 'agency' || id === 'call' || (!!activeCase && BEATS.indexOf(id as Beat) <= reached)
}

function useOpen() {
  const setBeat = useSession((s) => s.setBeat)
  const setWin = useUI((u) => u.setWin)
  const enabled = useEnabled()
  return (id: SpotId) => {
    if (!enabled(id)) return
    if (id !== 'inbox' && id !== 'agency') setBeat(id)
    setWin(id)
  }
}

export function Spot({ id, at, children, clickThrough = false }: {
  id: SpotId; at: [number, number, number]; children: ReactNode; clickThrough?: boolean
}) {
  const { win, setHover } = useUI()
  const enabled = useEnabled()
  const open = useOpen()
  const next = target(useGuideState()) === id
  const anchor = useRef<Group>(null)
  const marker = useRef<Group>(null)
  const v = useRef(new Vector3())
  const { camera, size } = useThree()
  useFrame(({ clock }) => {
    if (marker.current) {
      marker.current.position.y = at[1] + 0.3 + Math.abs(Math.sin(clock.elapsedTime * 2.6)) * 0.12
      marker.current.rotation.y = clock.elapsedTime * 1.5
    }
    const el = document.getElementById(`spot-${id}`)
    if (!el || !anchor.current) return
    anchor.current.getWorldPosition(v.current).project(camera)
    const x = (v.current.x * 0.5 + 0.5) * size.width, y = (-v.current.y * 0.5 + 0.5) * size.height
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`
    el.style.visibility = v.current.z < 1 ? 'visible' : 'hidden'
  })
  return (
    <group
      onClick={(e) => { if (clickThrough && win === id) return; e.stopPropagation(); if (enabled(id) && win !== id) sfx('open'); open(id) }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(id); if (win === null) document.body.style.cursor = enabled(id) ? 'pointer' : 'not-allowed' }}
      onPointerOut={() => { setHover(null); document.body.style.cursor = '' }}>
      {children}
      <group ref={anchor} position={at} />
      {next && win === null && (
        <group ref={marker} position={at}>
          <mesh rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.07, 0.16, 4]} /><meshBasicMaterial color="#f6c700" toneMapped={false} /></mesh>
          <pointLight intensity={0.8} distance={1.8} color="#ffd27a" />
        </group>
      )}
    </group>
  )
}

export function Labels() {
  const { win, hover, idle, setHover, moving } = useUI()
  const enabled = useEnabled()
  const open = useOpen()
  const next = target(useGuideState())
  if (win !== null) return null
  return (
    <nav className={`labels ${moving ? 'moving' : ''}`} aria-label="Things in the office">
      {IDS.map((id) => {
        const on = enabled(id), isNext = next === id
        const show = isNext || hover === id || idle
        return (
          <button key={id} id={`spot-${id}`} className={`spot-label ${show ? 'show' : ''} ${isNext ? 'next' : ''} ${on ? '' : 'locked'}`}
            tabIndex={on ? 0 : -1} style={{ pointerEvents: show ? 'auto' : 'none' }}
            onClick={() => open(id)} onFocus={() => setHover(id)} onBlur={() => setHover(null)}
            aria-label={on ? `${SPOT[id].name}: ${SPOT[id].todo}` : `${SPOT[id].name} (locked for now)`}>
            <strong>{SPOT[id].name}</strong>
            <span>{on ? (isNext ? `▶ ${SPOT[id].todo}` : SPOT[id].todo) : '🔒 Later in the case'}</span>
          </button>
        )
      })}
    </nav>
  )
}
