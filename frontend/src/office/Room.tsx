// The detective office, built from primitives and painted textures in code (no model or image
// downloads). A tall teak-panelled room at dusk: low sun through the window throws real shadows
// across a woven rug, a ceiling fan turns, dust drifts in the light. Stations: desk with case
// folder, phone and typewriter; evidence cabinet; corkboard; lab bench; case shelf; inbox stand;
// and the wire desk, where the agency's agents report what they are doing.
// AI-assisted: written with Claude Code.
import { Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, DoubleSide, type Group, type MeshStandardMaterial, type Texture } from 'three'
import { useSession } from '../state/session'
import { crestTexture, flagTexture, noteTexture, panelTexture, plankTexture, plasterTexture, rugTexture, shaftTexture, stampTexture, windowViewTexture, wireTexture, woodTexture } from './paint'
import { LabBench } from './LabBench'
import { Spot } from './Spot'
import { useUI } from './ui'

const WOOD = '#8a5a2b', DARK = '#4a2f1a', BRASS = '#d2a94e', GREEN = '#3d5c4b', LEATHER = '#3b1f17'
const H = 4.4                      // ceiling height: a tall, grand room
const WIN = { w: 3.2, h: 2.0, y: 2.45 }   // the window opening in the back wall

type V = [number, number, number]

function Box({ p, s, c, r = 0.75, map, metal = 0, rot }: { p: V; s: V; c: string; r?: number; map?: Texture; metal?: number; rot?: V }) {
  return (
    <mesh position={p} rotation={rot} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={map ? '#ffffff' : c} map={map} roughness={r} metalness={metal} />
    </mesh>
  )
}
function Brass({ p, s, rot }: { p: V; s: V; rot?: V }) { return <Box p={p} s={s} c={BRASS} r={0.28} metal={0.85} rot={rot} /> }

function useWoods() {
  return useMemo(() => ({ teak: woodTexture('#8a5a2b', 5), dark: woodTexture('#55341c', 9), planks: plankTexture(), panel: panelTexture(), plaster: plasterTexture(GREEN) }), [])
}

/** Dusk light: a low sun through the window (the only shadow caster), warm fills, and haze. */
function Lights() {
  return (
    <>
      <fog attach="fog" args={['#1c130c', 11, 26]} />
      <hemisphereLight args={['#ffe0bc', '#3a281c', 0.85]} />
      <directionalLight castShadow position={[1.6, 4.8, -9]} intensity={2.3} color="#ffab5e"
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0005} shadow-normalBias={0.02}
        shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-camera-near={1} shadow-camera-far={22} />
      {/* warm room fill from the open side, and a cool bounce so shadows are not black */}
      <directionalLight position={[2, 4.5, 8]} intensity={1.25} color="#ffe6c8" />
      <directionalLight position={[-6, 3, 4]} intensity={0.3} color="#9fb7d8" />
      <pointLight position={[0, 3.2, 0.2]} intensity={3} distance={9} decay={1.6} color="#ffd9a0" />
    </>
  )
}

function Shell({ w }: { w: ReturnType<typeof useWoods> }) {
  const view = useMemo(() => windowViewTexture(), [])
  const flag = useMemo(() => flagTexture(), [])
  const rug = useMemo(() => rugTexture(), [])
  const shaft = useMemo(() => shaftTexture(), [])
  const crest = useMemo(() => crestTexture(), [])
  const fan = useRef<Group>(null)
  useFrame((_, dt) => { if (fan.current) fan.current.rotation.y += dt * 1.6 })
  const wl = -WIN.w / 2, wr = WIN.w / 2, wb = WIN.y - WIN.h / 2, wt = WIN.y + WIN.h / 2
  const plaster = <meshStandardMaterial map={w.plaster} roughness={0.95} />
  return (
    <group>
      {/* floor of teak boards, with a soft sheen */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[10, 8]} /><meshStandardMaterial map={w.planks} roughness={0.42} metalness={0.05} /></mesh>
      {/* back wall, built around the window opening so the sun really comes through it */}
      <mesh position={[(-5 + wl) / 2, H / 2, -4.05]} castShadow receiveShadow><boxGeometry args={[wl + 5, H, 0.1]} />{plaster}</mesh>
      <mesh position={[(5 + wr) / 2, H / 2, -4.05]} castShadow receiveShadow><boxGeometry args={[5 - wr, H, 0.1]} />{plaster}</mesh>
      <mesh position={[0, (H + wt) / 2, -4.05]} castShadow receiveShadow><boxGeometry args={[WIN.w, H - wt, 0.1]} />{plaster}</mesh>
      <mesh position={[0, wb / 2, -4.05]} castShadow receiveShadow><boxGeometry args={[WIN.w, wb, 0.1]} />{plaster}</mesh>
      {/* side walls */}
      <mesh position={[-5, H / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow><planeGeometry args={[8, H]} />{plaster}</mesh>
      <mesh position={[5, H / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow><planeGeometry args={[8, H]} />{plaster}</mesh>
      {/* teak panelling to chair-rail height, all round */}
      <mesh position={[(-5 + wl) / 2, 0.6, -3.99]} receiveShadow><planeGeometry args={[wl + 5, 1.2]} /><meshStandardMaterial map={w.panel} roughness={0.55} /></mesh>
      <mesh position={[(5 + wr) / 2, 0.6, -3.99]} receiveShadow><planeGeometry args={[5 - wr, 1.2]} /><meshStandardMaterial map={w.panel} roughness={0.55} /></mesh>
      <mesh position={[0, 0.6, -3.99]} receiveShadow><planeGeometry args={[WIN.w, 1.2]} /><meshStandardMaterial map={w.panel} roughness={0.55} /></mesh>
      <mesh position={[-4.99, 0.6, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow><planeGeometry args={[8, 1.2]} /><meshStandardMaterial map={w.panel} roughness={0.55} /></mesh>
      <mesh position={[4.99, 0.6, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow><planeGeometry args={[8, 1.2]} /><meshStandardMaterial map={w.panel} roughness={0.55} /></mesh>
      <Box p={[0, 1.22, -3.96]} s={[10, 0.07, 0.06]} c={DARK} map={w.dark} />
      <Box p={[-4.96, 1.22, 0]} s={[0.06, 0.07, 8]} c={DARK} map={w.dark} />
      <Box p={[4.96, 1.22, 0]} s={[0.06, 0.07, 8]} c={DARK} map={w.dark} />
      <Box p={[0, 0.07, -3.95]} s={[10, 0.14, 0.05]} c={DARK} map={w.dark} />
      {/* cornice and ceiling with exposed beams */}
      <Box p={[0, H - 0.09, -3.94]} s={[10, 0.18, 0.12]} c={DARK} map={w.dark} />
      <Box p={[-4.94, H - 0.09, 0]} s={[0.12, 0.18, 8]} c={DARK} map={w.dark} />
      <Box p={[4.94, H - 0.09, 0]} s={[0.12, 0.18, 8]} c={DARK} map={w.dark} />
      <mesh position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[10, 8]} /><meshStandardMaterial color="#2a1b12" roughness={1} /></mesh>
      {[-3, -1, 1, 3].map((z) => <Box key={z} p={[0, H - 0.13, z]} s={[10, 0.26, 0.22]} c={DARK} map={w.dark} />)}

      {/* the window: rainforest at dusk, deep teak frame, glazing bars, sill, heavy curtains */}
      <mesh position={[0, WIN.y, -4.12]}><planeGeometry args={[WIN.w + 0.2, WIN.h + 0.2]} /><meshBasicMaterial map={view} toneMapped={false} /></mesh>
      <Box p={[wl - 0.06, WIN.y, -4.0]} s={[0.12, WIN.h + 0.24, 0.2]} c={DARK} map={w.dark} />
      <Box p={[wr + 0.06, WIN.y, -4.0]} s={[0.12, WIN.h + 0.24, 0.2]} c={DARK} map={w.dark} />
      <Box p={[0, wt + 0.06, -4.0]} s={[WIN.w + 0.24, 0.12, 0.2]} c={DARK} map={w.dark} />
      <Box p={[0, wb - 0.05, -3.92]} s={[WIN.w + 0.4, 0.1, 0.34]} c={DARK} map={w.dark} />
      {[-WIN.w / 4, 0, WIN.w / 4].map((x) => <Box key={x} p={[x, WIN.y, -4.02]} s={[0.045, WIN.h, 0.05]} c={DARK} />)}
      <Box p={[0, WIN.y + 0.25, -4.02]} s={[WIN.w, 0.045, 0.05]} c={DARK} />
      {[wl - 0.42, wr + 0.42].map((x) => (
        <group key={x} position={[x, WIN.y - 0.25, -3.86]}>
          {[-0.18, -0.06, 0.06, 0.18].map((dx, i) => <Box key={i} p={[dx, 0, (i % 2) * 0.03]} s={[0.13, WIN.h + 0.9, 0.08]} c="#5e1a1a" r={0.95} />)}
        </group>
      ))}
      <Brass p={[0, wt + 0.3, -3.84]} s={[WIN.w + 1.5, 0.035, 0.035]} />
      {/* beams of dusty light from the window to the floor */}
      {[-1.05, 0, 1.05].map((x, i) => (
        <mesh key={i} position={[x * 0.9 + 0.25, 1.35, -1.6]} rotation={[-1.03, 0, 0]}>
          <planeGeometry args={[0.85, 5.4]} />
          <meshBasicMaterial map={shaft} transparent opacity={0.11} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
        </mesh>
      ))}
      <Sparkles count={70} scale={[5, 2.6, 5]} position={[0.3, 1.6, -1.2]} size={2.2} speed={0.25} opacity={0.5} color="#ffd9a0" />

      {/* agency crest, Sarawak flag, framed chart */}
      <mesh position={[0, wt + 0.72, -3.98]}><circleGeometry args={[0.36, 40]} /><meshStandardMaterial map={crest} roughness={0.5} /></mesh>
      <group position={[2.55, 2.75, -3.98]}>
        <Box p={[0, 0, -0.01]} s={[1.14, 0.8, 0.03]} c={DARK} map={w.dark} />
        <mesh position={[0, 0, 0.012]}><planeGeometry args={[1.0, 0.66]} /><meshStandardMaterial map={flag} roughness={0.8} /></mesh>
      </group>
      {/* brass wall lamps either side of the window */}
      {[-2.25, 2.25].map((x) => (
        <group key={x} position={[x, 3.45, -3.9]}>
          <Brass p={[0, 0, 0]} s={[0.06, 0.2, 0.06]} />
          <mesh position={[0, 0.16, 0.06]}><sphereGeometry args={[0.09, 16, 12]} /><meshStandardMaterial color="#fff2d0" emissive="#ffc46b" emissiveIntensity={2.2} toneMapped={false} /></mesh>
        </group>
      ))}

      {/* woven rug under the map table */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0.25]} receiveShadow><planeGeometry args={[5.4, 3.6]} /><meshStandardMaterial map={rug} roughness={1} /></mesh>

      {/* ceiling fan, turning slowly */}
      <group position={[0, H - 0.26, -1.6]}>
        <mesh position={[0, -0.18, 0]}><cylinderGeometry args={[0.025, 0.025, 0.4, 8]} /><meshStandardMaterial color={BRASS} metalness={0.8} roughness={0.3} /></mesh>
        <group ref={fan} position={[0, -0.4, 0]}>
          <mesh castShadow><cylinderGeometry args={[0.12, 0.14, 0.12, 16]} /><meshStandardMaterial color={BRASS} metalness={0.8} roughness={0.3} /></mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} rotation={[0.12, (i * Math.PI) / 2, 0]} position={[Math.cos((i * Math.PI) / 2) * 0.62, 0, -Math.sin((i * Math.PI) / 2) * 0.62]} castShadow>
              <boxGeometry args={[1.0, 0.018, 0.2]} /><meshStandardMaterial map={w.dark} roughness={0.6} />
            </mesh>
          ))}
        </group>
      </group>
      {/* brass pendant lamp over the map table */}
      <group position={[0, 0, 0.15]}>
        <mesh position={[0, (H + 2.75) / 2, 0]}><cylinderGeometry args={[0.008, 0.008, H - 2.75, 6]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
        <mesh position={[0, 2.66, 0]}><coneGeometry args={[0.48, 0.3, 32, 1, true]} /><meshStandardMaterial color={BRASS} metalness={0.85} roughness={0.3} side={DoubleSide} /></mesh>
        <mesh position={[0, 2.58, 0]}><sphereGeometry args={[0.08, 16, 12]} /><meshStandardMaterial color="#fff2d0" emissive="#ffd58a" emissiveIntensity={3} toneMapped={false} /></mesh>
      </group>
    </group>
  )
}

function Desk({ w }: { w: ReturnType<typeof useWoods> }) {
  return (
    <group position={[0, 0, -2.8]}>
      <Box p={[0, 0.76, 0]} s={[2.5, 0.07, 1.0]} c={WOOD} map={w.teak} r={0.38} />
      <Box p={[0, 0.799, 0.02]} s={[1.5, 0.006, 0.66]} c="#22392d" r={0.7} />
      {[-0.95, 0.95].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <Box p={[0, 0.37, 0]} s={[0.56, 0.72, 0.94]} c={DARK} map={w.dark} r={0.5} />
          {[0.58, 0.36, 0.14].map((y) => (
            <group key={y} position={[0, y, 0.475]}>
              <Box p={[0, 0, 0]} s={[0.48, 0.18, 0.012]} c={WOOD} map={w.teak} r={0.45} />
              <Brass p={[0, 0, 0.012]} s={[0.12, 0.02, 0.02]} />
            </group>
          ))}
        </group>
      ))}
      <Box p={[0, 0.5, -0.46]} s={[1.34, 0.46, 0.03]} c={DARK} map={w.dark} />
      {/* leather chair behind the desk */}
      <group position={[0, 0, -0.78]}>
        <Box p={[0, 0.48, 0]} s={[0.62, 0.1, 0.56]} c={LEATHER} r={0.5} />
        <Box p={[0, 1.0, -0.26]} s={[0.62, 1.0, 0.1]} c={LEATHER} r={0.5} />
        <Box p={[-0.33, 0.66, -0.02]} s={[0.06, 0.26, 0.5]} c={DARK} />
        <Box p={[0.33, 0.66, -0.02]} s={[0.06, 0.26, 0.5]} c={DARK} />
        <mesh position={[0, 0.22, 0]}><cylinderGeometry args={[0.04, 0.2, 0.44, 10]} /><meshStandardMaterial color="#222" metalness={0.6} roughness={0.4} /></mesh>
      </group>
      {/* case folder */}
      <Spot id="call" at={[0.75, 0.9, 0.05]}>
        <group position={[0.15, 0.81, 0.08]} rotation={[0, 0.12, 0]}>
          <Box p={[0, 0, 0]} s={[0.44, 0.016, 0.32]} c="#d9b266" />
          <Box p={[-0.12, 0.009, -0.17]} s={[0.14, 0.012, 0.03]} c="#c29a52" />
          <Box p={[0.02, 0.012, 0.02]} s={[0.3, 0.003, 0.2]} c="#fffaf0" />
          <Box p={[0.12, 0.016, -0.06]} s={[0.1, 0.002, 0.05]} c="#c8102e" />
        </group>
      </Spot>
      {/* rotary phone */}
      <group position={[0.78, 0.8, -0.2]}>
        <Box p={[0, 0.035, 0]} s={[0.22, 0.09, 0.18]} c="#141414" r={0.25} />
        <Box p={[0, 0.1, 0]} s={[0.27, 0.04, 0.055]} c="#141414" r={0.25} />
        <mesh position={[0, 0.082, 0.05]} rotation={[-0.5, 0, 0]}><cylinderGeometry args={[0.05, 0.05, 0.008, 20]} /><meshStandardMaterial color="#d8d2c2" roughness={0.3} /></mesh>
      </group>
      {/* typewriter */}
      <Spot id="deduction" at={[-0.95, 0.42, 0.05]}>
        <group position={[-0.75, 0.8, 0.08]}>
          <Box p={[0, 0.05, 0]} s={[0.44, 0.1, 0.32]} c="#24332b" r={0.35} metal={0.3} />
          <Box p={[0, 0.12, -0.09]} s={[0.48, 0.05, 0.09]} c="#161d19" r={0.3} metal={0.4} />
          <mesh position={[0, 0.15, -0.09]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.028, 0.028, 0.5, 14]} /><meshStandardMaterial color="#0e0e0e" roughness={0.5} /></mesh>
          <Box p={[0, 0.24, -0.11]} s={[0.3, 0.2, 0.004]} c="#fffaf0" rot={[-0.12, 0, 0]} />
          {Array.from({ length: 21 }).map((_, i) => (
            <mesh key={i} position={[-0.18 + (i % 7) * 0.06, 0.106, 0.03 + Math.floor(i / 7) * 0.045]}>
              <cylinderGeometry args={[0.013, 0.013, 0.012, 10]} /><meshStandardMaterial color="#efe6cf" roughness={0.4} />
            </mesh>
          ))}
        </group>
      </Spot>
      {/* banker's lamp: brass stem, green glass shade */}
      <group position={[-0.2, 0.8, -0.3]}>
        <mesh position={[0, 0.01, 0]}><cylinderGeometry args={[0.08, 0.09, 0.02, 20]} /><meshStandardMaterial color={BRASS} metalness={0.85} roughness={0.3} /></mesh>
        <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[0.012, 0.012, 0.3, 8]} /><meshStandardMaterial color={BRASS} metalness={0.85} roughness={0.3} /></mesh>
        <mesh position={[0, 0.32, 0.04]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.07, 0.07, 0.3, 20, 1, false, 0, Math.PI]} /><meshStandardMaterial color="#1f6b45" emissive="#2fa56a" emissiveIntensity={0.9} roughness={0.25} side={DoubleSide} /></mesh>
        <pointLight position={[0, 0.26, 0.1]} intensity={2.4} distance={2.6} decay={1.8} color="#ffcf8a" />
      </group>
      {/* a stack of books and an ink stamp */}
      {[['#7a1f1f', 0], ['#22392d', 0.04], ['#c9a35a', 0.08]].map(([c, y], i) => <Box key={i} p={[1.0, 0.82 + (y as number), 0.2]} s={[0.26, 0.04, 0.18]} c={c as string} rot={[0, i * 0.2, 0]} />)}
      <group position={[0.5, 0.8, 0.3]}>
        <Box p={[0, 0.02, 0]} s={[0.07, 0.04, 0.05]} c="#111" />
        <mesh position={[0, 0.075, 0]}><cylinderGeometry args={[0.012, 0.02, 0.08, 10]} /><meshStandardMaterial map={w.teak} /></mesh>
      </group>
    </group>
  )
}

function Cabinet() {
  const { activeCase: c, chosen } = useSession()
  const n = c?.evidence.length ?? 5
  return (
    <Spot id="locker" at={[4.3, 2.0, -1.2]}>
      <group position={[4.55, 0, -1.2]}>
        <Box p={[0, 0.82, 0]} s={[0.62, 1.64, 1.04]} c="#3d5547" r={0.42} metal={0.35} />
        <Box p={[0, 1.66, 0]} s={[0.66, 0.04, 1.08]} c="#2c3f34" r={0.4} metal={0.4} />
        {Array.from({ length: Math.min(n, 6) }).map((_, i) => {
          const id = c?.evidence[i]?.id
          const out = id && chosen.includes(id)
          return (
            <group key={i} position={[out ? -0.46 : -0.32, 1.47 - i * 0.25, 0]}>
              <Box p={[0, 0, 0]} s={[0.04, 0.21, 0.92]} c={out ? '#5f8069' : '#34493d'} r={0.4} metal={0.35} />
              <Brass p={[-0.03, 0.02, 0]} s={[0.02, 0.03, 0.2]} />
              <Box p={[-0.022, -0.05, 0]} s={[0.004, 0.05, 0.16]} c="#f4ead8" />
            </group>
          )
        })}
      </group>
    </Spot>
  )
}

function Corkboard() {
  const { activeCase: c, chosen, results } = useSession()
  const notes = useMemo(() => chosen.map((id) => {
    const card = c?.evidence.find((e) => e.id === id)
    const st = results[id]?.scales?.stamp
    return { id, tex: noteTexture(card?.name ?? id, st ? st.replace(/_/g, ' ') : card?.mission ?? '') }
  }), [chosen, c, results])
  const at = (i: number): V => [-0.7 + (i % 3) * 0.7, 0.3 - Math.floor(i / 3) * 0.6, 0.03]
  return (
    <Spot id="board" at={[-2.4, 2.55, -3.9]}>
      <group position={[-2.4, 1.85, -3.95]}>
        <Box p={[0, 0, 0]} s={[2.0, 1.3, 0.04]} c="#b98a5a" r={1} />
        <Box p={[0, 0, -0.005]} s={[2.14, 1.44, 0.035]} c={DARK} />
        {notes.map((n, i) => (
          <group key={n.id} position={at(i)} rotation={[0, 0, ((i * 7) % 5 - 2) * 0.03]}>
            <mesh castShadow><planeGeometry args={[0.55, 0.41]} /><meshStandardMaterial map={n.tex} /></mesh>
            <mesh position={[0, 0.18, 0.01]}><sphereGeometry args={[0.018, 10, 10]} /><meshStandardMaterial color="#c8102e" /></mesh>
          </group>
        ))}
        {/* red string from note to note */}
        {notes.slice(1).map((n, i) => {
          const a = at(i), b = at(i + 1), dx = b[0] - a[0], dy = b[1] - a[1]
          return (
            <mesh key={n.id} position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.18, 0.045]} rotation={[0, 0, Math.atan2(dy, dx)]}>
              <boxGeometry args={[Math.hypot(dx, dy), 0.006, 0.004]} /><meshBasicMaterial color="#c8102e" />
            </mesh>
          )
        })}
      </group>
    </Spot>
  )
}

function Shelf({ w }: { w: ReturnType<typeof useWoods> }) {
  const { grade } = useSession()
  const stamp = useMemo(() => grade && stampTexture(grade.ending === 'sent_back' ? 'Sent back' : 'Solved',
    grade.ending === 'sent_back' ? '#b26a00' : '#2e7d32'), [grade])
  const spines = ['#7a1f1f', '#1a1a1a', '#c9a35a', '#22392d', '#4b2a1a']
  return (
    <Spot id="closed" at={[3.9, 2.75, -3.6]}>
      <group position={[3.9, 0, -3.75]}>
        <Box p={[0, 1.3, -0.19]} s={[1.7, 2.6, 0.03]} c={DARK} map={w.dark} />
        {[0.08, 0.7, 1.3, 1.9, 2.56].map((y) => <Box key={y} p={[0, y, 0]} s={[1.7, 0.05, 0.42]} c={WOOD} map={w.teak} r={0.45} />)}
        <Box p={[-0.85, 1.3, 0]} s={[0.05, 2.6, 0.42]} c={DARK} map={w.dark} />
        <Box p={[0.85, 1.3, 0]} s={[0.05, 2.6, 0.42]} c={DARK} map={w.dark} />
        {[1.3, 1.9].map((y, row) => Array.from({ length: 11 }).map((_, i) => (
          <Box key={`${row}-${i}`} p={[-0.7 + i * 0.135, y + 0.025 + (0.26 + ((i * 7 + row * 3) % 4) * 0.03) / 2, -0.02]}
            s={[0.11, 0.26 + ((i * 7 + row * 3) % 4) * 0.03, 0.3]} c={spines[(i + row * 2) % spines.length]} r={0.6}
            rot={[0, 0, i === 10 ? -0.14 : 0]} />
        )))}
        <mesh position={[-0.45, 0.93, 0]} castShadow><sphereGeometry args={[0.17, 24, 18]} /><meshStandardMaterial color="#3d6f8f" roughness={0.45} /></mesh>
        <Brass p={[-0.45, 0.76, 0]} s={[0.16, 0.03, 0.16]} />
        {stamp && <mesh position={[0.3, 0.92, 0.22]}><planeGeometry args={[0.6, 0.225]} /><meshBasicMaterial map={stamp} transparent /></mesh>}
      </group>
    </Spot>
  )
}

function InboxStand({ w }: { w: ReturnType<typeof useWoods> }) {
  const { activeCase, grade } = useSession()
  const unread = !activeCase || !!grade
  return (
    <Spot id="inbox" at={[2.7, 1.3, 1.5]}>
      <group position={[2.7, 0, 1.5]} rotation={[0, -0.5, 0]}>
        <mesh position={[0, 0.4, 0]} castShadow><cylinderGeometry args={[0.05, 0.18, 0.8, 14]} /><meshStandardMaterial map={w.dark} roughness={0.5} /></mesh>
        <Box p={[0, 0.82, 0]} s={[0.62, 0.04, 0.46]} c={WOOD} map={w.teak} r={0.45} />
        <Box p={[0, 0.9, -0.21]} s={[0.62, 0.14, 0.03]} c={WOOD} map={w.teak} />
        <Box p={[-0.3, 0.9, 0]} s={[0.03, 0.14, 0.46]} c={WOOD} map={w.teak} />
        <Box p={[0.3, 0.9, 0]} s={[0.03, 0.14, 0.46]} c={WOOD} map={w.teak} />
        {[0, 1, 2].map((i) => (
          <group key={i} position={[-0.04 + i * 0.03, 0.86 + i * 0.012, 0.02 - i * 0.03]} rotation={[0, (i - 1) * 0.18, 0]}>
            <Box p={[0, 0, 0]} s={[0.42, 0.008, 0.28]} c="#fffaf0" />
          </group>
        ))}
        {unread && (
          <mesh position={[0.22, 0.93, 0.12]}><sphereGeometry args={[0.045, 12, 12]} /><meshStandardMaterial color="#c8102e" emissive="#c8102e" emissiveIntensity={1.6} toneMapped={false} /></mesh>
        )}
      </group>
    </Spot>
  )
}

/** The wire desk: a teleprinter under a board of five lamps, one for each step of the agency's
 *  pipeline. The lamps light in turn; the paper creeps out of the machine. */
function WireDesk({ w }: { w: ReturnType<typeof useWoods> }) {
  const board = useMemo(() => wireTexture(), [])
  const lamps = useRef<(MeshStandardMaterial | null)[]>([])
  const paper = useRef<Group>(null)
  const open = useUI((u) => u.win === 'agency')
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * (open ? 1.6 : 0.8)
    lamps.current.forEach((m, i) => { if (m) m.emissiveIntensity = 0.25 + 2.6 * Math.max(0, Math.sin(t - i * 0.9)) ** 6 })
    if (paper.current) paper.current.position.y = 1.02 + (Math.sin(clock.elapsedTime * 1.3) * 0.5 + 0.5) * 0.02
  })
  const colours = ['#ffb84a', '#ffb84a', '#58c7e0', '#ff5a4a', '#58c7e0']   // amber: code · blue: AI · red: a person
  return (
    <Spot id="agency" at={[-4.45, 2.75, 1.25]}>
      <group position={[-4.62, 0, 1.25]}>
        {/* side table */}
        <Box p={[0, 0.8, 0]} s={[0.62, 0.05, 1.3]} c={WOOD} map={w.teak} r={0.4} />
        {[[-0.25, -0.58], [0.25, -0.58], [-0.25, 0.58], [0.25, 0.58]].map(([x, z], i) => <Box key={i} p={[x, 0.4, z]} s={[0.06, 0.8, 0.06]} c={DARK} map={w.dark} />)}
        <Box p={[0, 0.25, 0]} s={[0.54, 0.03, 1.2]} c={DARK} map={w.dark} />
        {/* teleprinter */}
        <Box p={[0, 0.9, 0.1]} s={[0.44, 0.16, 0.56]} c="#1d2a23" r={0.35} metal={0.35} />
        <Box p={[-0.08, 1.0, 0.1]} s={[0.24, 0.07, 0.5]} c="#141c18" r={0.3} metal={0.4} />
        <mesh position={[-0.08, 1.05, 0.1]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.03, 0.03, 0.52, 14]} /><meshStandardMaterial color="#0c0c0c" roughness={0.5} /></mesh>
        {Array.from({ length: 18 }).map((_, i) => (
          <mesh key={i} position={[0.1 + Math.floor(i / 9) * 0.05, 0.99, -0.1 + (i % 9) * 0.05]}>
            <cylinderGeometry args={[0.014, 0.014, 0.014, 10]} /><meshStandardMaterial color="#efe6cf" roughness={0.4} />
          </mesh>
        ))}
        <group ref={paper} position={[-0.1, 1.02, 0.1]}>
          <Box p={[0, 0.16, 0]} s={[0.004, 0.34, 0.3]} c="#fffaf0" rot={[0, 0, 0.1]} />
        </group>
        <Box p={[0.02, 0.83, -0.42]} s={[0.3, 0.012, 0.24]} c="#fffaf0" rot={[0, 0.2, 0]} />
        {/* the wire board on the wall */}
        <group position={[-0.33, 2.05, 0]} rotation={[0, Math.PI / 2, 0]}>
          <Box p={[0, 0, -0.01]} s={[1.66, 0.86, 0.04]} c={DARK} map={w.dark} />
          <mesh position={[0, 0, 0.012]}><planeGeometry args={[1.56, 0.78]} /><meshStandardMaterial map={board} roughness={0.7} /></mesh>
          {colours.map((c, i) => (
            <mesh key={i} position={[-0.585 + i * 0.2925, -0.065, 0.04]}>
              <sphereGeometry args={[0.05, 16, 12]} />
              <meshStandardMaterial ref={(m) => { lamps.current[i] = m }} color={c} emissive={c} emissiveIntensity={0.3} toneMapped={false} />
            </mesh>
          ))}
        </group>
      </group>
    </Spot>
  )
}

/** Things that make it a lived-in office: plants, a hat stand with the detective's coat, a globe. */
function Decor({ w }: { w: ReturnType<typeof useWoods> }) {
  const palm = (p: V, s = 1) => (
    <group position={p} scale={s}>
      <mesh position={[0, 0.22, 0]} castShadow><cylinderGeometry args={[0.24, 0.17, 0.44, 16]} /><meshStandardMaterial color="#8c4a2f" roughness={0.8} /></mesh>
      <mesh position={[0, 0.75, 0]} castShadow><cylinderGeometry args={[0.025, 0.035, 0.7, 8]} /><meshStandardMaterial color="#4a3a22" /></mesh>
      {Array.from({ length: 9 }).map((_, i) => {
        const a = (i / 9) * Math.PI * 2, tilt = 0.75 + (i % 3) * 0.18
        return (
          <mesh key={i} position={[Math.cos(a) * 0.3, 1.2 + (i % 3) * 0.1, Math.sin(a) * 0.3]} rotation={[0, -a, -tilt]} castShadow>
            <coneGeometry args={[0.13, 0.95, 4]} /><meshStandardMaterial color={i % 2 ? '#2f6b3a' : '#3f8348'} roughness={0.7} flatShading />
          </mesh>
        )
      })}
    </group>
  )
  return (
    <group>
      {palm([-4.35, 0, -3.35], 1.15)}
      {palm([4.4, 0, 0.75])}
      {/* hat stand: trench coat and fedora */}
      <group position={[4.35, 0, 3.0]}>
        <mesh position={[0, 0.95, 0]} castShadow><cylinderGeometry args={[0.03, 0.04, 1.9, 10]} /><meshStandardMaterial map={w.dark} /></mesh>
        <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.26, 0.3, 0.06, 18]} /><meshStandardMaterial map={w.dark} /></mesh>
        <mesh position={[-0.02, 1.25, 0.1]} castShadow><cylinderGeometry args={[0.14, 0.26, 1.0, 12]} /><meshStandardMaterial color="#8b7350" roughness={0.9} /></mesh>
        <mesh position={[0, 1.93, 0]} castShadow><cylinderGeometry args={[0.2, 0.2, 0.02, 20]} /><meshStandardMaterial color="#3a2a1d" roughness={0.8} /></mesh>
        <mesh position={[0, 2.0, 0]} castShadow><cylinderGeometry args={[0.1, 0.12, 0.13, 18]} /><meshStandardMaterial color="#3a2a1d" roughness={0.8} /></mesh>
      </group>
      {/* floor globe beside the desk */}
      <group position={[1.85, 0, -2.5]}>
        <mesh position={[0, 0.35, 0]} castShadow><cylinderGeometry args={[0.03, 0.2, 0.7, 12]} /><meshStandardMaterial map={w.dark} /></mesh>
        <mesh position={[0, 0.92, 0]} rotation={[0.4, 0, 0]} castShadow><sphereGeometry args={[0.28, 28, 20]} /><meshStandardMaterial color="#2f6f8f" roughness={0.35} metalness={0.1} /></mesh>
        <mesh position={[0, 0.92, 0]} rotation={[Math.PI / 2 + 0.4, 0, 0]}><torusGeometry args={[0.31, 0.012, 8, 40]} /><meshStandardMaterial color={BRASS} metalness={0.85} roughness={0.3} /></mesh>
      </group>
      {/* framed survey sheets on the right wall */}
      {[[-2.6, '#efe3c6'], [-0.2, '#e6dcc0']].map(([z, c], i) => (
        <group key={i} position={[4.96, 2.55, z as number]} rotation={[0, -Math.PI / 2, 0]}>
          <Box p={[0, 0, -0.01]} s={[1.0, 0.74, 0.03]} c={DARK} map={w.dark} />
          <mesh position={[0, 0, 0.012]}><planeGeometry args={[0.86, 0.6]} /><meshStandardMaterial color={c as string} roughness={0.9} /></mesh>
          <mesh position={[0.05, -0.02, 0.014]} rotation={[0, 0, 0.3]}><planeGeometry args={[0.5, 0.26]} /><meshStandardMaterial color="#7fa37a" roughness={0.9} /></mesh>
        </group>
      ))}
    </group>
  )
}

export function Room() {
  const w = useWoods()
  return (
    <group>
      <Lights />
      <Shell w={w} />
      <InboxStand w={w} />
      <Desk w={w} />
      <Cabinet />
      <Corkboard />
      <LabBench />
      <Shelf w={w} />
      <WireDesk w={w} />
      <Decor w={w} />
    </group>
  )
}
