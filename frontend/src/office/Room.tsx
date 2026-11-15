// The detective office, built from primitives in code (no model downloads): walls, window to the
// rainforest, desk with case folder, phone and typewriter, evidence cabinet, corkboard, lab bench
// with the six tools, case shelf, rattan rug, Sarawak flag. Highlights follow the current beat.
// AI-assisted: written with Claude Code.
import { useMemo } from 'react'
import { useSession } from '../state/session'
import { flagTexture, noteTexture, stampTexture, windowViewTexture } from './paint'
import { LabBench } from './LabBench'
import { Spot } from './Spot'

const WOOD = '#7a5536', DARK = '#4a3322', BRASS = '#c8a24a'

function Box({ p, s, c, r = 0.8 }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: number }) {
  return <mesh position={p} castShadow receiveShadow><boxGeometry args={s} /><meshStandardMaterial color={c} roughness={r} /></mesh>
}

function Shell() {
  const view = useMemo(() => windowViewTexture(), [])
  const flag = useMemo(() => flagTexture(), [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[10, 8]} /><meshStandardMaterial color="#5b4030" roughness={0.9} /></mesh>
      <mesh position={[0, 1.75, -4]} receiveShadow><planeGeometry args={[10, 3.5]} /><meshStandardMaterial color="#d8c3a0" /></mesh>
      <mesh position={[-5, 1.75, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[8, 3.5]} /><meshStandardMaterial color="#cdb593" /></mesh>
      <mesh position={[5, 1.75, 0]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[8, 3.5]} /><meshStandardMaterial color="#cdb593" /></mesh>
      <mesh position={[0, 3.5, 0]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[10, 8]} /><meshStandardMaterial color="#3a2a20" /></mesh>
      {/* window with the rainforest at dusk */}
      <mesh position={[0, 1.95, -3.99]}><planeGeometry args={[2.6, 1.4]} /><meshBasicMaterial map={view} toneMapped={false} /></mesh>
      <Box p={[0, 1.95, -3.97]} s={[0.05, 1.4, 0.04]} c={DARK} />
      <Box p={[0, 1.95, -3.97]} s={[2.6, 0.05, 0.04]} c={DARK} />
      <Box p={[0, 1.22, -3.93]} s={[2.8, 0.06, 0.14]} c={DARK} />
      {/* Sarawak flag */}
      <mesh position={[2.2, 2.2, -3.98]}><planeGeometry args={[0.9, 0.6]} /><meshStandardMaterial map={flag} /></mesh>
      {/* rattan rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0.2]}><circleGeometry args={[2.1, 48]} /><meshStandardMaterial color="#b88a4e" roughness={1} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0.2]}><ringGeometry args={[1.85, 1.95, 48]} /><meshStandardMaterial color="#7a3b1f" /></mesh>
    </group>
  )
}

function Desk() {
  return (
    <group position={[0, 0, -2.8]}>
      <Box p={[0, 0.75, 0]} s={[2.2, 0.06, 0.9]} c={WOOD} />
      <Box p={[-0.85, 0.37, 0]} s={[0.45, 0.72, 0.85]} c={DARK} />
      <Box p={[0.85, 0.37, 0]} s={[0.45, 0.72, 0.85]} c={DARK} />
      {/* case folder */}
      <Spot id="call" at={[0.75, 0.85, 0.05]}>
        <group position={[0.15, 0.79, 0.05]} rotation={[0, 0.12, 0]}>
          <Box p={[0, 0, 0]} s={[0.42, 0.015, 0.3]} c="#e0bf7a" />
          <Box p={[-0.12, 0.009, -0.16]} s={[0.14, 0.012, 0.03]} c="#c9a86a" />
          <Box p={[0.02, 0.012, 0.02]} s={[0.3, 0.003, 0.2]} c="#fffaf0" />
        </group>
      </Spot>
      {/* rotary phone */}
      <group position={[0.7, 0.8, -0.15]}>
        <Box p={[0, 0.03, 0]} s={[0.2, 0.08, 0.16]} c="#1a1a1a" r={0.4} />
        <Box p={[0, 0.09, 0]} s={[0.24, 0.035, 0.05]} c="#1a1a1a" r={0.4} />
      </group>
      {/* typewriter */}
      <Spot id="deduction" at={[-0.95, 0.4, 0.05]}>
        <group position={[-0.75, 0.78, 0.05]}>
          <Box p={[0, 0.05, 0]} s={[0.42, 0.1, 0.3]} c="#2f3a33" r={0.5} />
          <Box p={[0, 0.12, -0.08]} s={[0.46, 0.05, 0.08]} c="#1f2622" r={0.4} />
          <Box p={[0, 0.2, -0.1]} s={[0.3, 0.16, 0.005]} c="#fffaf0" />
          {Array.from({ length: 12 }).map((_, i) => (
            <mesh key={i} position={[-0.15 + (i % 6) * 0.06, 0.105, 0.06 + Math.floor(i / 6) * 0.05]}>
              <cylinderGeometry args={[0.012, 0.012, 0.012, 10]} /><meshStandardMaterial color="#e8e0cc" />
            </mesh>
          ))}
        </group>
      </Spot>
      {/* desk lamp */}
      <group position={[-0.25, 0.78, -0.3]}>
        <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.01, 0.01, 0.4, 6]} /><meshStandardMaterial color={BRASS} metalness={0.6} roughness={0.3} /></mesh>
        <mesh position={[0, 0.42, 0.04]} rotation={[0.5, 0, 0]}><coneGeometry args={[0.09, 0.12, 16, 1, true]} /><meshStandardMaterial color="#1f6f8b" side={2} /></mesh>
        <pointLight position={[0, 0.36, 0.08]} intensity={1.1} distance={2.2} color="#ffcf8a" />
      </group>
    </group>
  )
}

function Cabinet() {
  const { activeCase: c, chosen } = useSession()
  const n = c?.evidence.length ?? 5
  return (
    <Spot id="locker" at={[4.3, 1.95, -1.2]}>
      <group position={[4.55, 0, -1.2]}>
        <Box p={[0, 0.8, 0]} s={[0.6, 1.6, 1.0]} c="#556b5c" r={0.5} />
        {Array.from({ length: Math.min(n, 6) }).map((_, i) => {
          const id = c?.evidence[i]?.id
          const out = id && chosen.includes(id)
          return (
            <group key={i} position={[out ? -0.45 : -0.31, 1.45 - i * 0.24, 0]}>
              <Box p={[0, 0, 0]} s={[0.04, 0.2, 0.9]} c={out ? '#6f8a76' : '#4a5d50'} r={0.5} />
              <Box p={[-0.03, 0, 0]} s={[0.02, 0.03, 0.18]} c={BRASS} r={0.3} />
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
  return (
    <Spot id="board" at={[-2.4, 2.5, -3.9]}>
      <group position={[-2.4, 1.65, -3.97]}>
        <Box p={[0, 0, 0]} s={[2.0, 1.3, 0.04]} c="#c79a6b" r={1} />
        <Box p={[0, 0, -0.005]} s={[2.1, 1.4, 0.03]} c={DARK} />
        {notes.map((n, i) => (
          <group key={n.id} position={[-0.7 + (i % 3) * 0.7, 0.3 - Math.floor(i / 3) * 0.6, 0.03]} rotation={[0, 0, ((i * 7) % 5 - 2) * 0.03]}>
            <mesh><planeGeometry args={[0.55, 0.41]} /><meshStandardMaterial map={n.tex} /></mesh>
            <mesh position={[0, 0.18, 0.01]}><sphereGeometry args={[0.018, 10, 10]} /><meshStandardMaterial color="#c8102e" /></mesh>
          </group>
        ))}
      </group>
    </Spot>
  )
}

function Shelf() {
  const { grade } = useSession()
  const stamp = useMemo(() => grade && stampTexture(grade.ending === 'sent_back' ? 'Sent back' : 'Solved',
    grade.ending === 'sent_back' ? '#b26a00' : '#2e7d32'), [grade])
  return (
    <Spot id="closed" at={[3.9, 2.25, -3.6]}>
      <group position={[3.9, 0, -3.75]}>
        {[0.4, 1.0, 1.6].map((y) => <Box key={y} p={[0, y, 0]} s={[1.6, 0.04, 0.4]} c={WOOD} />)}
        <Box p={[-0.8, 1.0, 0]} s={[0.04, 2.0, 0.4]} c={DARK} />
        <Box p={[0.8, 1.0, 0]} s={[0.04, 2.0, 0.4]} c={DARK} />
        {Array.from({ length: 9 }).map((_, i) => (
          <Box key={i} p={[-0.6 + i * 0.13, 1.17, 0]} s={[0.1, 0.3, 0.3]} c={['#c8102e', '#1a1a1a', '#e0bf7a'][i % 3]} r={0.6} />
        ))}
        {stamp && <mesh position={[0, 0.65, 0.21]}><planeGeometry args={[0.6, 0.225]} /><meshBasicMaterial map={stamp} transparent /></mesh>}
      </group>
    </Spot>
  )
}

function InboxStand() {
  const { activeCase, grade } = useSession()
  const unread = !activeCase || !!grade
  return (
    <Spot id="inbox" at={[2.7, 1.3, 1.5]}>
      <group position={[2.7, 0, 1.5]} rotation={[0, -0.5, 0]}>
        <mesh position={[0, 0.4, 0]} castShadow><cylinderGeometry args={[0.06, 0.16, 0.8, 12]} /><meshStandardMaterial color={DARK} /></mesh>
        <Box p={[0, 0.82, 0]} s={[0.62, 0.04, 0.46]} c={WOOD} />
        <Box p={[0, 0.9, -0.21]} s={[0.62, 0.14, 0.03]} c={WOOD} />
        <Box p={[-0.3, 0.9, 0]} s={[0.03, 0.14, 0.46]} c={WOOD} />
        <Box p={[0.3, 0.9, 0]} s={[0.03, 0.14, 0.46]} c={WOOD} />
        {[0, 1, 2].map((i) => (
          <group key={i} position={[-0.04 + i * 0.03, 0.86 + i * 0.012, 0.02 - i * 0.03]} rotation={[0, (i - 1) * 0.18, 0]}>
            <Box p={[0, 0, 0]} s={[0.42, 0.008, 0.28]} c="#fffaf0" />
          </group>
        ))}
        {unread && (
          <mesh position={[0.22, 0.93, 0.12]}><sphereGeometry args={[0.045, 12, 12]} /><meshStandardMaterial color="#c8102e" emissive="#c8102e" emissiveIntensity={0.9} /></mesh>
        )}
      </group>
    </Spot>
  )
}

export function Room() {
  return (
    <group>
      <Shell />
      <InboxStand />
      <Desk />
      <Cabinet />
      <Corkboard />
      <LabBench />
      <Shelf />
    </group>
  )
}
