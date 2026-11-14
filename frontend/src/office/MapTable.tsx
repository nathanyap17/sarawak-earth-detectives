// The 3D map table: Sarawak relief (SRTM-derived heights) draped with NASA GIBS imagery,
// VIIRS fire detections as rising embers for the chosen day, the case region and clue pins.
// All files were saved at build time (rule 7); nothing is fetched from NASA here.
// AI-assisted: written with Claude Code.
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BoxGeometry, BufferAttribute, Color, InstancedMesh, Object3D, PlaneGeometry, SRGBColorSpace, TextureLoader, type Texture } from 'three'
import { logQuiet } from '../api/client'
import type { SceneManifest } from '../api/types'
import { useSession } from '../state/session'

export const TABLE_W = 2.4
const LIFT = 0.92          // tabletop height
const RELIEF = 0.16        // exaggerated height of the tallest peak, in metres of room
const MAX_EMBERS = 400

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
  const { activeCase: c, beat, sceneDay, cluePins, addPin, sessionId } = useSession()
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
    if (beat !== 'scene' || !m || !e.uv || cluePins.length >= 3) return
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
          onPointerOver={() => { if (beat === 'scene') document.body.style.cursor = 'crosshair' }}
          onPointerOut={() => { document.body.style.cursor = '' }}>
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
        {cluePins.map(([lon, lat], i) => {
          const [x, y, z] = toLocal(lon, lat)
          return (
            <group key={i} position={[x, y, z]}>
              <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.004, 0.004, 0.12, 6]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
              <mesh position={[0, 0.125, 0]}><sphereGeometry args={[0.02, 12, 12]} /><meshStandardMaterial color="#c8102e" emissive="#5a0010" /></mesh>
            </group>
          )
        })}
      </group>
    </group>
  )
}
