// The 3D map table: Sarawak relief (SRTM-derived heights) draped with NASA GIBS imagery,
// VIIRS fire detections as rising embers for the chosen day, the case region and clue pins.
// All files were saved at build time (rule 7); nothing is fetched from NASA here.
// AI-assisted: written with Claude Code.
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BoxGeometry, BufferAttribute, CanvasTexture, Color, InstancedMesh, Object3D, PlaneGeometry, SRGBColorSpace, TextureLoader, type Texture } from 'three'
import { logQuiet } from '../api/client'
import type { SceneManifest } from '../api/types'
import { TOWNS } from '../beats/PinReport'
import { useSession } from '../state/session'
import { Spot } from './Spot'
import { useUI } from './ui'

export const TABLE_W = 2.4
const LIFT = 0.92          // tabletop height
const RELIEF = 0.16        // exaggerated height of the tallest peak, in metres of room
const MAX_EMBERS = 400

/** A small text label drawn to a canvas (no font files, no DOM), used as a sprite. */
function textTexture(text: string, bg: string, fg: string) {
  const c = document.createElement('canvas')
  const g = c.getContext('2d')!
  g.font = '600 44px system-ui, sans-serif'
  c.width = Math.ceil(g.measureText(text).width) + 36; c.height = 64
  g.font = '600 44px system-ui, sans-serif'
  g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, c.width, c.height, 14); g.fill()
  g.fillStyle = fg; g.textBaseline = 'middle'; g.fillText(text, 18, 34)
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace
  return { t, aspect: c.width / c.height }
}

export function Tag({ text, at, h = 0.045, bg = 'rgba(20,16,12,.82)', fg = '#fff', lift = 0.05 }: {
  text: string; at: [number, number, number]; h?: number; bg?: string; fg?: string; lift?: number
}) {
  const { t, aspect } = useMemo(() => textTexture(text, bg, fg), [text, bg, fg])
  useEffect(() => () => t.dispose(), [t])
  return (
    <group position={at}>
      <mesh position={[0, lift / 2, 0]}><cylinderGeometry args={[0.002, 0.002, lift, 5]} /><meshBasicMaterial color="#fff" /></mesh>
      <sprite position={[0, lift + h / 2, 0]} scale={[h * aspect, h, 1]}><spriteMaterial map={t} depthTest={false} transparent /></sprite>
    </group>
  )
}

export function useScene(caseId: string | undefined) {
  const [m, setM] = useState<SceneManifest | null>(null)
  const [heights, setHeights] = useState<Uint16Array | null>(null)
  const [fires, setFires] = useState<[number, number, number][]>([])
  const [base, setBase] = useState<Texture | null>(null)
  useEffect(() => {
    if (!caseId) return
    const dir = `/scenes/${caseId}`
    let live = true
    fetch(`${dir}/manifest.json`).then((r) => r.json()).then(async (mm: SceneManifest) => {
      if (!live) return
      setM(mm)
      const t = await new TextureLoader().loadAsync(`${dir}/${mm.base}`)
      t.colorSpace = SRGBColorSpace
      if (live) setBase(t)
      if (mm.terrain) fetch(`${dir}/${mm.terrain.file}`).then((r) => r.arrayBuffer()).then((b) => live && setHeights(new Uint16Array(b)))
      if (mm.fire_points) fetch(`${dir}/${mm.fire_points.file}`).then((r) => r.json()).then((f) => live && setFires(f))
    }).catch(() => setM(null))
    return () => { live = false }
  }, [caseId])
  return { m, heights, fires, base }
}

export function MapTable({ scene }: { scene: ReturnType<typeof useScene> }) {
  const { m, heights, fires, base } = scene
  const { activeCase: c, sceneDay, cluePins, addPin, sessionId } = useSession()
  const win = useUI((u) => u.win)
  const D = m ? TABLE_W * (m.bbox[3] - m.bbox[1]) / (m.bbox[2] - m.bbox[0]) : TABLE_W * 0.7
  const size = m?.terrain?.size ?? 2
  const maxM = m?.terrain?.max_m ?? 1

  const geom = useMemo(() => {
    const g = new PlaneGeometry(TABLE_W, D, size - 1, size - 1)
    g.rotateX(-Math.PI / 2)
    if (heights) {
      const pos = g.getAttribute('position') as BufferAttribute
      for (let i = 0; i < pos.count; i++) pos.setY(i, (heights[i] / maxM) * RELIEF)
      pos.needsUpdate = true
      g.computeVertexNormals()
    }
    return g
  }, [D, size, heights, maxM])

  // lon/lat → table-local x, y, z (y follows the relief)
  const toLocal = useMemo(() => (lon: number, lat: number): [number, number, number] => {
    if (!m) return [0, 0, 0]
    const [W, S, E, N] = m.bbox
    const u = (lon - W) / (E - W), v = (N - lat) / (N - S)
    let y = 0
    if (heights) {
      const j = Math.min(size - 1, Math.max(0, Math.round(u * (size - 1))))
      const i = Math.min(size - 1, Math.max(0, Math.round(v * (size - 1))))
      y = (heights[i * size + j] / maxM) * RELIEF
    }
    return [(u - 0.5) * TABLE_W, y, (v - 0.5) * D]
  }, [m, heights, size, maxM, D])

  // embers for the chosen day plus a fading tail of the two days before
  const embers = useRef<InstancedMesh>(null)
  const today = useMemo(() => fires.filter((f) => f[0] <= sceneDay && f[0] >= sceneDay - 2)
    .map((f) => ({ age: sceneDay - f[0], at: toLocal(f[1], f[2]), seed: (f[1] * 97 + f[2] * 31) % 1 })), [fires, sceneDay, toLocal])
  const dummy = useMemo(() => new Object3D(), [])
  const hot = useMemo(() => new Color('#ffb02e'), [])
  const cool = useMemo(() => new Color('#a1281c'), [])
  useFrame(({ clock }) => {
    const im = embers.current
    if (!im) return
    const t = clock.elapsedTime
    const n = Math.min(today.length, MAX_EMBERS)
    for (let k = 0; k < n; k++) {
      const e = today[k]
      const rise = ((t * 0.35 + e.seed) % 1) * 0.06
      const s = (e.age === 0 ? 0.018 : 0.011) * (1 - rise * 6)
      dummy.position.set(e.at[0], e.at[1] + 0.006 + rise, e.at[2])
      dummy.scale.setScalar(Math.max(s, 0.002))
      dummy.updateMatrix()
      im.setMatrixAt(k, dummy.matrix)
      im.setColorAt(k, e.age === 0 ? hot : cool)
    }
    im.count = n
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
  })

  function drop(e: ThreeEvent<MouseEvent>) {
    if (win !== 'scene' || !m || !e.uv || cluePins.length >= 3) return
    e.stopPropagation()
    const [W, S, E, N] = m.bbox
    const p: [number, number] = [+(W + e.uv.x * (E - W)).toFixed(3), +(S + e.uv.y * (N - S)).toFixed(3)]
    addPin(p)
    logQuiet(sessionId, { kind: 'clue', lonlat: p })
  }

  const region = c && m ? (() => {
    const [w, s, e, n] = c.region.bbox
    const a = toLocal(w, n), b = toLocal(e, s)
    return { x: (a[0] + b[0]) / 2, z: (a[2] + b[2]) / 2, w: b[0] - a[0], d: b[2] - a[2] }
  })() : null

  return (
    <Spot id="scene" at={[0, 1.02, 1.1]} clickThrough>
    <group position={[0, 0, 0.15]}>
      {/* table: rattan-brown frame on four legs */}
      <mesh position={[0, LIFT - 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[TABLE_W + 0.2, 0.08, D + 0.2]} />
        <meshStandardMaterial color="#6b4a2f" roughness={0.8} />
      </mesh>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * (TABLE_W / 2), (LIFT - 0.08) / 2, sz * (D / 2)]}>
          <cylinderGeometry args={[0.04, 0.05, LIFT - 0.08, 8]} />
          <meshStandardMaterial color="#5a3d26" />
        </mesh>
      ))}
      <spotLight position={[0, 2.6, 0.4]} angle={0.75} penumbra={0.6} intensity={9} distance={4} color="#fff1dc" />
      <group position={[0, LIFT, 0]}>
        <mesh geometry={geom} onClick={drop} receiveShadow
          onPointerMove={() => { if (win === 'scene') document.body.style.cursor = 'crosshair' }}>
          <meshStandardMaterial map={base ?? undefined} emissiveMap={base ?? undefined} emissive={base ? '#ffffff' : '#000000'} emissiveIntensity={0.45}
            color={base ? '#ffffff' : '#3d6b4f'} roughness={0.9} />
        </mesh>
        <instancedMesh ref={embers} args={[undefined, undefined, MAX_EMBERS]} frustumCulled={false}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
        {region && (
          <mesh position={[region.x, RELIEF * 0.6, region.z]}>
            <boxGeometry args={[region.w, RELIEF * 1.2, region.d]} />
            <meshBasicMaterial color="#f6c700" transparent opacity={0.13} depthWrite={false} />
          </mesh>
        )}
        {region && (
          <lineSegments position={[region.x, RELIEF * 0.6, region.z]}>
            <edgesGeometry args={[new BoxGeometry(region.w, RELIEF * 1.2, region.d)]} />
            <lineBasicMaterial color="#f6c700" />
          </lineSegments>
        )}
        {m && win === 'scene' && TOWNS.filter((t) => t.lon > m.bbox[0] && t.lon < m.bbox[2] && t.lat > m.bbox[1] && t.lat < m.bbox[3])
          .map((t) => <Tag key={t.name} text={t.name} at={toLocal(t.lon, t.lat)} h={t.major ? 0.05 : 0.036} />)}
        {region && win === 'scene' && <Tag text="Case region" at={[region.x - region.w / 2 + 0.02, RELIEF * 1.2, region.z - region.d / 2 + 0.02]} bg="#f6c700" fg="#1a1a1a" lift={0.02} h={0.04} />}
        {cluePins.map(([lon, lat], i) => {
          const [x, y, z] = toLocal(lon, lat)
          return (
            <group key={i} position={[x, y, z]}>
              <Tag text={`Pin ${i + 1}`} at={[0, 0.13, 0]} bg="#c8102e" lift={0.02} h={0.04} />
              <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.004, 0.004, 0.12, 6]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
              <mesh position={[0, 0.125, 0]}><sphereGeometry args={[0.02, 12, 12]} /><meshStandardMaterial color="#c8102e" emissive="#5a0010" /></mesh>
            </group>
          )
        })}
      </group>
    </group>
    </Spot>
  )
}
