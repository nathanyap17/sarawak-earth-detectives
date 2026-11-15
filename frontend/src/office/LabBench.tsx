// The lab bench: a real-looking workbench built from primitives. Each of the six desk tools is a
// recognisable object in its own spot (left to right, in the order a detective uses them), with
// a pegboard behind, drawers below, a stool, and a chart sheet under the ruler. A tool glows once
// it has been used, and name tags appear while the lab window is open.
// AI-assisted: written with Claude Code.
import { useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import type { Tool } from '../api/types'
import { useSession } from '../state/session'
import { Tag } from './MapTable'
import { Spot } from './Spot'
import { useUI } from './ui'

const WOOD = '#7a5536', DARK = '#4a3322', BRASS = '#c8a24a', STEEL = '#9aa3ad'

/** A sheet of graph paper with a wobbly record and a red trend line (a drawing, not data). */
function chartTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160
  const g = c.getContext('2d')!
  g.fillStyle = '#f6f0e2'; g.fillRect(0, 0, 256, 160)
  g.strokeStyle = '#d9cdb4'; g.lineWidth = 1
  for (let x = 0; x <= 256; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 160); g.stroke() }
  for (let y = 0; y <= 160; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke() }
  g.strokeStyle = '#7a3e1d'; g.lineWidth = 2.5; g.beginPath()
  let s = 7
  for (let i = 0; i <= 30; i++) { s = (s * 16807) % 2147483647; const y = 110 - i * 1.6 + ((s / 2147483647) - 0.5) * 46; if (i) g.lineTo(12 + i * 7.7, y); else g.moveTo(12, y) }
  g.stroke()
  g.strokeStyle = '#c8102e'; g.setLineDash([8, 5]); g.beginPath(); g.moveTo(12, 110); g.lineTo(244, 62); g.stroke()
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace
  return t
}

/** Pegboard with painted tool outlines. */
function pegTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#b89468'; g.fillRect(0, 0, 512, 256)
  g.fillStyle = '#8a6a45'
  for (let x = 12; x < 512; x += 20) for (let y = 12; y < 256; y += 20) { g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill() }
  g.fillStyle = '#f6f0e2'; g.fillRect(150, 40, 212, 60)
  g.fillStyle = '#1a1a1a'; g.font = '700 30px Georgia, serif'; g.textAlign = 'center'; g.fillText('THE LAB', 256, 68)
  g.font = '15px Georgia, serif'; g.fillText('look · filter · measure · weigh · check', 256, 90)
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace
  return t
}

function M({ c, glow = 0, metal = 0.2, rough = 0.6, op }: { c: string; glow?: number; metal?: number; rough?: number; op?: number }) {
  return <meshStandardMaterial color={c} emissive={glow ? c : '#000'} emissiveIntensity={glow} metalness={metal} roughness={rough}
    transparent={op != null} opacity={op ?? 1} />
}

export function LabBench() {
  const { results } = useSession()
  const win = useUI((u) => u.win)
  const used = useMemo(() => new Set(Object.values(results).flatMap((r) => Object.keys(r ?? {}))) as Set<Tool>, [results])
  const chart = useMemo(() => chartTexture(), [])
  const peg = useMemo(() => pegTexture(), [])
  const g = (t: Tool) => (used.has(t) ? 0.55 : 0)
  const TOP = 0.9
  const tag = (text: string, x: number, y = 0.34) => win === 'lab' && <Tag text={text} at={[x, y, 0.1]} lift={0.03} h={0.05} />
  return (
    <Spot id="lab" at={[-4.2, 1.55, -1.0]}>
      <group position={[-4.5, 0, -1.0]} rotation={[0, Math.PI / 2, 0]}>
        {/* bench: thick top, back rail, two drawer units, a shelf, a stool */}
        <mesh position={[0, TOP - 0.035, 0]} castShadow receiveShadow><boxGeometry args={[2.5, 0.07, 0.85]} /><M c={WOOD} rough={0.75} /></mesh>
        <mesh position={[0, TOP + 0.05, -0.4]}><boxGeometry args={[2.5, 0.1, 0.04]} /><M c={DARK} /></mesh>
        {[-0.95, 0.95].map((x) => (
          <group key={x} position={[x, 0.43, 0]}>
            <mesh castShadow><boxGeometry args={[0.55, 0.86, 0.75]} /><M c={DARK} /></mesh>
            {[0.25, 0, -0.25].map((y) => (
              <group key={y} position={[0, y, 0.38]}>
                <mesh><boxGeometry args={[0.47, 0.2, 0.02]} /><M c={WOOD} /></mesh>
                <mesh position={[0, 0, 0.02]}><boxGeometry args={[0.14, 0.02, 0.02]} /><M c={BRASS} metal={0.7} rough={0.3} /></mesh>
              </group>
            ))}
          </group>
        ))}
        <mesh position={[0, 0.3, -0.05]}><boxGeometry args={[1.36, 0.04, 0.7]} /><M c={WOOD} /></mesh>
        <group position={[0.1, 0, 0.75]}>
          <mesh position={[0, 0.5, 0]} castShadow><cylinderGeometry args={[0.17, 0.17, 0.05, 20]} /><M c="#8b2e22" /></mesh>
          {[0, 1, 2].map((i) => <mesh key={i} position={[Math.cos(i * 2.1) * 0.12, 0.25, Math.sin(i * 2.1) * 0.12]}><cylinderGeometry args={[0.012, 0.012, 0.5, 6]} /><M c={STEEL} metal={0.7} rough={0.35} /></mesh>)}
        </group>
        {/* pegboard on the wall */}
        <mesh position={[0, 1.72, -0.455]}><planeGeometry args={[2.4, 1.1]} /><meshStandardMaterial map={peg} roughness={0.9} emissiveMap={peg} emissive="#ffffff" emissiveIntensity={0.25} /></mesh>
        <mesh position={[0, 1.72, -0.48]}><boxGeometry args={[2.5, 1.2, 0.02]} /><M c={DARK} /></mesh>

        {/* 1 magnifier: a brass ring with a glass lens and a wooden handle, lying on a notebook */}
        <group position={[-1.02, TOP, 0.08]}>
          <mesh position={[0, 0.012, 0]} rotation={[0, 0.3, 0]}><boxGeometry args={[0.26, 0.022, 0.19]} /><M c="#2f4858" /></mesh>
          <group position={[0.02, 0.04, 0.02]} rotation={[-Math.PI / 2, 0, 0.7]}>
            <mesh castShadow><torusGeometry args={[0.07, 0.011, 10, 28]} /><M c={BRASS} glow={g('magnifier')} metal={0.8} rough={0.25} /></mesh>
            <mesh><circleGeometry args={[0.068, 24]} /><M c="#cfe9f5" op={0.45} rough={0.05} /></mesh>
            <mesh position={[0, -0.14, 0]}><cylinderGeometry args={[0.013, 0.016, 0.14, 10]} /><M c={DARK} /></mesh>
          </group>
          {tag('Magnifier', 0, 0.22)}
        </group>

        {/* 2 season filter: an orange lens in a ring on a retort stand, over a sample dish */}
        <group position={[-0.62, TOP, -0.08]}>
          <mesh position={[0, 0.012, 0]}><boxGeometry args={[0.2, 0.024, 0.14]} /><M c="#2b2b2b" metal={0.5} /></mesh>
          <mesh position={[-0.07, 0.19, 0]}><cylinderGeometry args={[0.008, 0.008, 0.36, 8]} /><M c={STEEL} metal={0.8} rough={0.3} /></mesh>
          <mesh position={[-0.01, 0.27, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.006, 0.006, 0.12, 6]} /><M c={STEEL} metal={0.8} /></mesh>
          <group position={[0.06, 0.27, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh><torusGeometry args={[0.06, 0.008, 8, 24]} /><M c={STEEL} metal={0.8} rough={0.3} /></mesh>
            <mesh><circleGeometry args={[0.058, 24]} /><meshStandardMaterial color="#ff8a1e" emissive="#ff8a1e" emissiveIntensity={used.has('season') ? 0.9 : 0.15} transparent opacity={0.7} side={2} /></mesh>
          </group>
          <mesh position={[0.06, 0.04, 0]}><cylinderGeometry args={[0.05, 0.04, 0.025, 20]} /><M c="#e8e0cc" /></mesh>
          {tag('Season filter', 0, 0.42)}
        </group>

        {/* 3 ruler: a wooden rule with tick marks, lying across a chart sheet */}
        <group position={[-0.16, TOP, 0.12]}>
          <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0.12]}><planeGeometry args={[0.42, 0.27]} /><meshStandardMaterial map={chart} roughness={0.9} /></mesh>
          <group position={[0, 0.012, 0.02]} rotation={[0, 0.32, 0]}>
            <mesh castShadow><boxGeometry args={[0.44, 0.012, 0.045]} /><M c="#e2c98f" glow={g('ruler') * 0.5} /></mesh>
            {Array.from({ length: 21 }, (_, i) => <mesh key={i} position={[-0.2 + i * 0.02, 0.007, -0.012 + (i % 5 === 0 ? 0.006 : 0)]}><boxGeometry args={[0.002, 0.002, i % 5 === 0 ? 0.022 : 0.012]} /><meshBasicMaterial color="#3a2a20" /></mesh>)}
          </group>
          <mesh position={[0.2, 0.01, 0.13]} rotation={[0, 0.5, Math.PI / 2]}><cylinderGeometry args={[0.006, 0.006, 0.16, 6]} /><M c="#f6c700" /></mesh>
          {tag('Ruler', 0, 0.18)}
        </group>

        {/* 4 scales: a brass balance with a beam and two hanging pans */}
        <group position={[0.36, TOP, -0.06]}>
          <mesh position={[0, 0.015, 0]}><cylinderGeometry args={[0.1, 0.12, 0.03, 24]} /><M c={DARK} /></mesh>
          <mesh position={[0, 0.2, 0]} castShadow><cylinderGeometry args={[0.012, 0.016, 0.36, 10]} /><M c={BRASS} glow={g('scales')} metal={0.8} rough={0.25} /></mesh>
          <mesh position={[0, 0.39, 0]}><sphereGeometry args={[0.02, 12, 12]} /><M c={BRASS} glow={g('scales')} metal={0.8} rough={0.25} /></mesh>
          <group position={[0, 0.37, 0]} rotation={[0, 0, used.has('scales') ? 0.14 : 0]}>
            <mesh><boxGeometry args={[0.44, 0.012, 0.016]} /><M c={BRASS} glow={g('scales')} metal={0.8} rough={0.25} /></mesh>
            {[-0.21, 0.21].map((x) => (
              <group key={x} position={[x, 0, 0]} rotation={[0, 0, used.has('scales') ? -0.14 : 0]}>
                {[-0.045, 0.045].map((dx) => <mesh key={dx} position={[dx / 2, -0.09, 0]} rotation={[0, 0, dx > 0 ? -0.24 : 0.24]}><cylinderGeometry args={[0.0018, 0.0018, 0.185, 4]} /><M c={STEEL} metal={0.8} /></mesh>)}
                <mesh position={[0, -0.185, 0]}><cylinderGeometry args={[0.065, 0.045, 0.014, 20]} /><M c={BRASS} metal={0.8} rough={0.3} /></mesh>
              </group>
            ))}
          </group>
          {tag('Scales', 0, 0.5)}
        </group>

        {/* 5 El Niño lamp: an angled desk lamp whose bulb lights once it has been used */}
        <group position={[0.82, TOP, -0.16]}>
          <mesh position={[0, 0.012, 0]}><cylinderGeometry args={[0.08, 0.09, 0.024, 20]} /><M c="#1f6f8b" metal={0.5} rough={0.4} /></mesh>
          <mesh position={[0.03, 0.14, 0]} rotation={[0, 0, -0.25]}><cylinderGeometry args={[0.008, 0.008, 0.27, 8]} /><M c={STEEL} metal={0.8} /></mesh>
          <mesh position={[0, 0.33, 0]} rotation={[0, 0, 0.75]}><cylinderGeometry args={[0.008, 0.008, 0.2, 8]} /><M c={STEEL} metal={0.8} /></mesh>
          <group position={[-0.09, 0.38, 0]} rotation={[0, 0, 0.9]}>
            <mesh castShadow><coneGeometry args={[0.075, 0.11, 20, 1, true]} /><meshStandardMaterial color="#1f6f8b" metalness={0.5} roughness={0.4} side={2} /></mesh>
            <mesh position={[0, -0.03, 0]}><sphereGeometry args={[0.028, 12, 12]} /><meshStandardMaterial color="#fff3c4" emissive="#ffd86b" emissiveIntensity={used.has('elnino') ? 2.2 : 0.1} /></mesh>
          </group>
          {used.has('elnino') && <pointLight position={[-0.13, 0.3, 0.05]} intensity={0.9} distance={1.2} color="#ffd86b" />}
          {tag('El Niño lamp', 0, 0.56)}
        </group>

        {/* 6 twin map: two small framed maps on a hinge, standing like an open book */}
        <group position={[1.08, TOP, 0.2]}>
          {[-1, 1].map((sgn) => (
            <group key={sgn} position={[sgn * 0.065, 0.085, 0]} rotation={[0, sgn * -0.45, 0]}>
              <mesh castShadow><boxGeometry args={[0.13, 0.17, 0.008]} /><M c={DARK} /></mesh>
              <mesh position={[0, 0, 0.005]}><planeGeometry args={[0.11, 0.15]} /><M c={sgn < 0 ? '#3f7d57' : '#8e5ea2'} glow={g('twin') * 0.8} rough={0.9} /></mesh>
            </group>
          ))}
          {tag('Twin map', 0, 0.26)}
        </group>

        {/* clutter that makes it a working desk: pencil pot, stamp pad, spare weights */}
        <group position={[-1.12, TOP, -0.25]}>
          <mesh position={[0, 0.05, 0]}><cylinderGeometry args={[0.04, 0.035, 0.1, 14]} /><M c="#8b2e22" /></mesh>
          {[0.3, -0.2, 0.05].map((r, i) => <mesh key={i} position={[r * 0.05, 0.12, i * 0.012 - 0.01]} rotation={[r * 0.5, 0, r]}><cylinderGeometry args={[0.005, 0.005, 0.15, 6]} /><M c={['#f6c700', '#c8102e', '#1a1a1a'][i]} /></mesh>)}
        </group>
        {[0, 1, 2].map((i) => <mesh key={i} position={[0.56 + i * 0.045, TOP + 0.012 + i * 0.004, 0.2]}><cylinderGeometry args={[0.016 + i * 0.004, 0.018 + i * 0.004, 0.024 + i * 0.008, 12]} /><M c={BRASS} metal={0.8} rough={0.3} /></mesh>)}
      </group>
    </Spot>
  )
}
