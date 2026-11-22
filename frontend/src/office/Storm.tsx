// Weather over the case region on the map table, for flood and heavy-rain cases: rain streaks as
// dense as the day's NASA rain, a cloud deck that darkens with it, lightning on the heaviest days,
// and water that rises in the low ground with the rain of the last five days. Every amount follows
// the day's number from the vault; the look is an illustration, not a flood map.
// AI-assisted: written with Claude Code.
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, type LineSegments, type Mesh, type MeshStandardMaterial,
  type MeshBasicMaterial, type PointLight, RepeatWrapping, SRGBColorSpace,
} from 'three'
import { isHandheld } from './orientation'
import { useUI } from './ui'

export interface Box { x: number; z: number; w: number; d: number }

const CLOUD_Y = 0.34          // cloud base above the tabletop (below the camera at full zoom)
const DARK = '#1f242b', LIGHT = '#c9d0d6'
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Soft cloud puffs drawn once to a canvas: no image files. */
function cloudTexture(seed: number) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512
  const g = c.getContext('2d')!
  let r = seed
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647)
  for (let k = 0; k < 140; k++) {
    const x = rnd() * 512, y = rnd() * 512, rad = 30 + rnd() * 90
    for (const [dx, dy] of [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]]) {   // tile seamlessly
      const grd = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad)
      grd.addColorStop(0, `rgba(255,255,255,${0.22 + rnd() * 0.25})`); grd.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grd; g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2)
    }
  }
  const t = new CanvasTexture(c); t.wrapS = t.wrapT = RepeatWrapping; t.colorSpace = SRGBColorSpace
  return t
}

/** A soft oval that fades to nothing at the edges: the cloud deck has no hard rim. */
function vignetteTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(128, 128, 20, 128, 128, 128)
  grd.addColorStop(0, '#fff'); grd.addColorStop(0.55, '#ddd'); grd.addColorStop(1, '#000')
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256)
  return new CanvasTexture(c)
}

/** Fine ripples for the water surface. */
function rippleTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d')!, img = g.createImageData(128, 128)
  for (let i = 0; i < img.data.length; i += 4) {
    const p = i / 4, x = p % 128, y = Math.floor(p / 128)
    const v = 128 + 60 * Math.sin(x * 0.29 + Math.sin(y * 0.17) * 2) * Math.cos(y * 0.23 + Math.sin(x * 0.11) * 2) + (Math.random() - 0.5) * 40
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const t = new CanvasTexture(c); t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(9, 6)
  return t
}

export function Storm({ box, mm, five, groundAt }: {
  box: Box; mm: number; five: number; groundAt: (x: number, z: number) => number
}) {
  const N = isHandheld() ? 700 : 1800
  const calm = reduced()
  // how hard it rains, 0–1, from the day's regional mean (250 mm is the worst day in the record)
  const wet = Math.min(1, Math.pow(mm / 120, 0.7))
  const cloudy = Math.min(1, mm / 35)
  // water follows the last five days: the lowest few metres on a quiet week, up to ~45 m of low ground after 450 mm
  const level = 0.0004 + 0.003 * Math.min(1, five / 450)

  // rain streaks: one segment per drop, re-dropped at the top when it reaches the ground
  const drops = useMemo(() => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(N * 6), 3))
    const st = Array.from({ length: N }, () => ({ x: 0, z: 0, y: Math.random() * CLOUD_Y, g: 0, v: 1.2 + Math.random() * 0.6 }))
    return { geo, st }
  }, [N])
  useEffect(() => () => drops.geo.dispose(), [drops])
  const respawn = (s: { x: number; z: number; y: number; g: number }, top: boolean) => {
    s.x = box.x + (Math.random() - 0.5) * box.w
    s.z = box.z + (Math.random() - 0.5) * box.d
    s.g = groundAt(s.x, s.z)
    if (top) s.y = CLOUD_Y - Math.random() * 0.04
  }
  // a new box or new relief: scatter the drops over it again
  useEffect(() => { drops.st.forEach((s) => respawn(s, false)) }, [box.x, box.z, box.w, box.d, groundAt, drops])

  const clouds = useMemo(() => [cloudTexture(7), cloudTexture(4242)], [])
  const edge = useMemo(() => vignetteTexture(), [])
  const ripple = useMemo(() => rippleTexture(), [])
  useEffect(() => () => { clouds.forEach((t) => t.dispose()); ripple.dispose(); edge.dispose() }, [clouds, ripple, edge])

  const lines = useRef<LineSegments>(null)
  const deck = useRef<(Mesh | null)[]>([])
  const water = useRef<Mesh>(null)
  const shade = useRef<Mesh>(null)
  const flash = useRef<PointLight>(null)
  const bolt = useRef<LineSegments>(null)
  const boltGeo = useMemo(() => { const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(new Float32Array(16 * 6), 3)); return g }, [])
  useEffect(() => () => boltGeo.dispose(), [boltGeo])
  const fx = useRef({ next: 2, until: 0, lvl: level, wet, cloudy, flick: 0 })
  const dark = useMemo(() => new Color(DARK), []), light = useMemo(() => new Color(LIGHT), [])
  const tint = useMemo(() => new Color(), [])

  useFrame(({ clock }, dt) => {
    const f = fx.current, t = clock.elapsedTime, k = 1 - Math.exp(-dt * 2.5)
    f.wet += (wet - f.wet) * k; f.cloudy += (cloudy - f.cloudy) * k; f.lvl += (level - f.lvl) * (1 - Math.exp(-dt * 1.2))
    const zoom = useUI.getState().mapView.zoom
    // rain
    const n = Math.round(N * f.wet)
    const pos = drops.geo.getAttribute('position') as BufferAttribute
    const len = 0.03 + 0.025 * f.wet, slant = 0.35
    for (let i = 0; i < n; i++) {
      const s = drops.st[i]
      s.y -= s.v * dt * (calm ? 0.4 : 1)
      if (s.y <= s.g) respawn(s, true)
      const o = i * 6
      pos.array[o] = s.x; pos.array[o + 1] = s.y + len; pos.array[o + 2] = s.z - len * slant
      pos.array[o + 3] = s.x; pos.array[o + 4] = s.y; pos.array[o + 5] = s.z
    }
    pos.needsUpdate = true
    drops.geo.setDrawRange(0, n * 2)
    if (lines.current) (lines.current.material as MeshBasicMaterial).opacity = 0.16 + 0.26 * f.wet
    // the storm's shadow: the land under the cloud goes grey, lifted for a moment by lightning
    if (shade.current) (shade.current.material as MeshBasicMaterial).opacity = Math.max(0, 0.26 * f.cloudy * f.wet + 0.08 * f.cloudy - f.flick * 0.25)
    // clouds drift and darken; they thin out as the student zooms in under them
    deck.current.forEach((m, i) => {
      if (!m) return
      const mat = m.material as MeshBasicMaterial
      mat.map!.offset.set((t * (0.004 + i * 0.003)) % 1, (t * 0.0015 * (i + 1)) % 1)
      tint.copy(light).lerp(dark, Math.min(1, f.wet * 1.25)).lerp(light, f.flick * 0.8)   // lightning lights the cloud from inside
      mat.color.copy(tint)
      mat.opacity = (0.15 + 0.8 * f.cloudy) * (i === 0 ? 1 : 0.85) / Math.pow(zoom, 0.9)
    })
    // lightning on the heaviest days: a flash in the cloud and a short bolt to the ground
    const storming = mm >= 60 && !calm
    if (storming && t > f.next) {
      f.until = t + 0.22
      f.next = t + 1.2 + Math.random() * Math.max(1.5, 9 - (mm - 60) / 12)
      const bx = box.x + (Math.random() - 0.5) * box.w * 0.8, bz = box.z + (Math.random() - 0.5) * box.d * 0.8
      const g = groundAt(bx, bz), a = boltGeo.getAttribute('position') as BufferAttribute
      let px = bx, py = CLOUD_Y, pz = bz
      for (let s = 0; s < 16; s++) {
        const ny = CLOUD_Y - ((s + 1) / 16) * (CLOUD_Y - g)
        const nx = bx + (Math.random() - 0.5) * 0.05, nz = bz + (Math.random() - 0.5) * 0.05
        a.setXYZ(s * 2, px, py, pz); a.setXYZ(s * 2 + 1, nx, ny, nz)
        px = nx; py = ny; pz = nz
      }
      a.needsUpdate = true
      if (flash.current) flash.current.position.set(bx, CLOUD_Y - 0.02, bz)
    }
    const on = t < f.until, flick = on ? (Math.sin((f.until - t) * 70) > -0.3 ? 1 : 0.25) : 0
    f.flick = flick
    if (flash.current) flash.current.intensity = flick * 9
    if (bolt.current) bolt.current.visible = on && flick > 0.5
    // the water rises and ripples
    if (water.current) {
      water.current.position.y = f.lvl
      const mat = water.current.material as MeshStandardMaterial
      mat.bumpMap!.offset.set((t * 0.01) % 1, (t * 0.006) % 1)
      mat.opacity = 0.7 + 0.2 * Math.min(1, five / 300)
    }
  })

  return (
    <group>
      <lineSegments ref={lines} geometry={drops.geo} frustumCulled={false}>
        <lineBasicMaterial color="#b9cbe0" transparent opacity={0.3} depthWrite={false} />
      </lineSegments>
      <mesh ref={shade} position={[box.x, 0.17, box.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <planeGeometry args={[box.w * 1.5, box.d * 1.5]} />
        <meshBasicMaterial color="#0b0f14" alphaMap={edge} transparent depthWrite={false} opacity={0} />
      </mesh>
      {clouds.map((tex, i) => (
        <mesh key={i} ref={(m) => { deck.current[i] = m }} position={[box.x, CLOUD_Y + 0.025 * i, box.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
          <planeGeometry args={[box.w * 1.6, box.d * 1.6]} />
          <meshBasicMaterial map={tex} alphaMap={edge} transparent depthWrite={false} opacity={0.4} toneMapped={false} />
        </mesh>
      ))}
      <pointLight ref={flash} color="#dfe8ff" intensity={0} distance={1.6} decay={1.5} />
      <lineSegments ref={bolt} geometry={boltGeo} visible={false} frustumCulled={false}>
        <lineBasicMaterial color="#f4f7ff" transparent opacity={0.95} blending={AdditiveBlending} toneMapped={false} />
      </lineSegments>
      <mesh ref={water} position={[box.x, level, box.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <planeGeometry args={[box.w, box.d]} />
        <meshStandardMaterial color="#4a4a36" transparent opacity={0.75} roughness={0.5} metalness={0}
          bumpMap={ripple} bumpScale={0.35} depthWrite={false} />
      </mesh>
    </group>
  )
}
