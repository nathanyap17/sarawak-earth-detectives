// Zoom and pan for the map table, with no on-screen +/- buttons: scroll or pinch to zoom (toward the
// pointer), drag to move, +/- and arrow keys on a keyboard. A small caption tells the student how,
// and shrinks once they have tried it. A click (or tap) still drops a clue pin.
// AI-assisted: written with Claude Code.
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import { STATIONS } from './stations'
import { MAX_ZOOM, useUI } from './ui'

/** The tabletop, in room coordinates (MapTable: LIFT plus a little relief). */
const TABLE = new Plane(new Vector3(0, 1, 0), -0.94)
const X_LIM = 1.1, Z_MIN = -0.85, Z_MAX = 0.75

/** When the last drag or pinch ended: a click right after one is the end of a gesture, not a pin. */
let lastGesture = 0
export const justGestured = () => performance.now() - lastGesture < 280

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export function MapGestures() {
  const win = useUI((u) => u.win)
  const { gl, camera } = useThree()
  useEffect(() => {
    if (win !== 'scene') return
    const el = gl.domElement
    const ray = new Raycaster(), ndc = new Vector2(), hit = new Vector3()
    const look = STATIONS.scene.look
    /** the point of the tabletop under a screen position, or null off the table plane */
    const under = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect()
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      return ray.ray.intersectPlane(TABLE, hit) ? hit.clone() : null
    }
    const set = (x: number, z: number, zoom: number, used: { zoom?: boolean; pan?: boolean }) =>
      useUI.getState().setMapView({ x: clamp(x, -X_LIM, X_LIM), z: clamp(z, Z_MIN, Z_MAX), zoom: clamp(zoom, 1, MAX_ZOOM), used })
    /** zoom by a factor, keeping the tabletop point under (cx, cy) where it is */
    const zoomAt = (factor: number, cx?: number, cy?: number) => {
      const v = useUI.getState().mapView
      const next = clamp(v.zoom * factor, 1, MAX_ZOOM)
      if (next === v.zoom) return
      const p = cx != null && cy != null ? under(cx, cy) : null
      let { x, z } = v
      if (p) {
        const r = v.zoom / next, lx = look[0] + x, lz = look[2] + z
        x = p.x - (p.x - lx) * r - look[0]
        z = p.z - (p.z - lz) * r - look[2]
      }
      if (next === 1) { x = 0; z = 0 }    // all the way out: the whole table again
      set(x, z, next, { zoom: true })
    }

    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const step = e.ctrlKey ? e.deltaY * 0.01 : e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018)   // ctrlKey: a trackpad pinch
      zoomAt(Math.exp(-step), e.clientX, e.clientY)
    }

    const pts = new Map<number, { x: number; y: number }>()
    let start: { x: number; y: number } | null = null, panning = false, pinch = 0
    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pts.size === 1) { start = { x: e.clientX, y: e.clientY }; panning = false }
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y) }
    }
    const move = (e: PointerEvent) => {
      const prev = pts.get(e.pointerId)
      if (!prev) return
      const cur = { x: e.clientX, y: e.clientY }
      if (pts.size >= 2) {
        const [a, b] = [...pts.values()]
        const ma = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        pts.set(e.pointerId, cur)
        const [c, d] = [...pts.values()]
        const dist = Math.hypot(c.x - d.x, c.y - d.y), mb = { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2 }
        if (pinch > 0 && dist > 0) zoomAt(dist / pinch, mb.x, mb.y)
        pinch = dist
        panBy(ma, mb)
        lastGesture = performance.now()
        return
      }
      pts.set(e.pointerId, cur)
      if (!panning && start && Math.hypot(cur.x - start.x, cur.y - start.y) > 5) { panning = true; el.style.cursor = 'grabbing' }
      if (panning) { panBy(prev, cur); lastGesture = performance.now() }
    }
    const panBy = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const p0 = under(from.x, from.y), p1 = under(to.x, to.y)
      if (!p0 || !p1) return
      const v = useUI.getState().mapView
      set(v.x + p0.x - p1.x, v.z + p0.z - p1.z, v.zoom, { pan: true })
    }
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId)
      if (panning || pts.size > 0) lastGesture = performance.now()
      if (pts.size === 0) { panning = false; start = null; el.style.cursor = '' }
      if (pts.size < 2) pinch = 0
    }
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.('input, textarea, select, button, [contenteditable]')) return
      const v = useUI.getState().mapView, s = 0.12 / v.zoom
      const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2
      if (e.key === '+' || e.key === '=') zoomAt(1.3, cx, cy)
      else if (e.key === '-' || e.key === '_') zoomAt(1 / 1.3, cx, cy)
      else if (e.key === '0') useUI.getState().resetMapView()
      else if (e.key === 'ArrowLeft') set(v.x - s, v.z, v.zoom, { pan: true })
      else if (e.key === 'ArrowRight') set(v.x + s, v.z, v.zoom, { pan: true })
      else if (e.key === 'ArrowUp') set(v.x, v.z - s, v.zoom, { pan: true })
      else if (e.key === 'ArrowDown') set(v.x, v.z + s, v.zoom, { pan: true })
      else return
      e.preventDefault()
    }
    const touch = el.style.touchAction
    el.style.touchAction = 'none'          // the page must not scroll or zoom while a finger works the map
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('keydown', key)
    return () => {
      el.style.touchAction = touch; el.style.cursor = ''
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('keydown', key)
    }
  }, [win, gl, camera])
  return null
}

const touchFirst = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

/** The caption over the map: what each gesture does, shorter once the student has used it. */
export function MapHint() {
  const { win, mapView: v, idle, moving, resetMapView } = useUI()
  if (win !== 'scene' || moving) return null
  const touch = touchFirst()
  const tips = [
    !v.used.zoom && (touch ? 'Pinch to zoom' : 'Scroll to zoom'),
    !v.used.pan && 'Drag to move',
    touch ? 'Tap to drop a pin' : 'Click to drop a pin',
  ].filter(Boolean) as string[]
  const zoomed = v.zoom > 1.02 || Math.abs(v.x) > 0.01 || Math.abs(v.z) > 0.01
  return (
    <div className={`map-hint ${idle ? 'quiet' : ''}`} role="note" aria-label="How to move the map">
      <span className="map-hint-ico" aria-hidden="true">{touch ? '✋' : '🖱'}</span>
      {tips.map((t, i) => <span key={t}>{i > 0 && <i aria-hidden="true">·</i>}{t}</span>)}
      {zoomed && <><i aria-hidden="true">·</i><span className="map-hint-zoom">{v.zoom.toFixed(1)}×</span>
        <button className="map-hint-reset" onClick={resetMapView}>Whole map{!touch && <kbd>0</kbd>}</button></>}
      {!touch && !zoomed && v.used.zoom && v.used.pan && <span className="map-hint-keys">or <kbd>+</kbd><kbd>−</kbd> and arrow keys</span>}
    </div>
  )
}
