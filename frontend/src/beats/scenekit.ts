// What the map shows depends on the kind of case: fire and haze cases get the satellite's fire
// detections, flood cases get the day's rain, heat and drought cases get the plain map. And a
// land/sea mask on the picture's own pixel grid (sea.png, saved at build time) so a pin on the
// water is reported as sea, never as land.
// AI-assisted: written with Claude Code.
import { useEffect, useState } from 'react'
import type { CaseType, SceneManifest } from '../api/types'

export type SceneLayer = 'fires' | 'rain' | 'none'

export function sceneLayer(type: CaseType | undefined): SceneLayer {
  if (type === 'fire' || type === 'haze') return 'fires'
  if (type === 'flood') return 'rain'
  return 'none'
}

export interface SeaMask {
  isSea: (lon: number, lat: number) => boolean
  /** straight-line distance to the nearest land, in km (0 on land; null if further than ~90 km) */
  coastKm: (lon: number, lat: number) => number | null
}

const KM_PER_DEG = 111.32

/** Loads the scene's sea.png into memory. `dir` is the folder the manifest came from. */
export function useSeaMask(dir: string | undefined, m: SceneManifest | null): SeaMask | null {
  const [mask, setMask] = useState<SeaMask | null>(null)
  const file = m?.sea?.file
  useEffect(() => {
    if (!dir || !m || !file) return
    let live = true
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const g = c.getContext('2d', { willReadFrequently: true })
      if (!g || !live) return
      g.drawImage(img, 0, 0)
      const px = g.getImageData(0, 0, w, h).data
      const sea = new Uint8Array(w * h)
      for (let i = 0; i < w * h; i++) sea[i] = px[i * 4] > 127 ? 1 : 0
      const [W, S, E, N] = m.bbox
      const at = (lon: number, lat: number): [number, number] =>
        [Math.min(w - 1, Math.max(0, Math.floor(((lon - W) / (E - W)) * w))), Math.min(h - 1, Math.max(0, Math.floor(((N - lat) / (N - S)) * h)))]
      const kmX = ((E - W) / w) * KM_PER_DEG, kmY = ((N - S) / h) * KM_PER_DEG
      setMask({
        isSea: (lon, lat) => { const [x, y] = at(lon, lat); return sea[y * w + x] === 1 },
        coastKm: (lon, lat) => {
          const [x0, y0] = at(lon, lat)
          if (!sea[y0 * w + x0]) return 0
          let best = Infinity
          const R = 120   // pixels, about 90 km
          for (let r = 1; r <= R; r++) {
            if (r * Math.min(kmX, kmY) > best) break   // nothing nearer can be found further out
            for (let dy = -r; dy <= r; dy++) {
              for (const dx of Math.abs(dy) === r ? Array.from({ length: 2 * r + 1 }, (_, k) => k - r) : [-r, r]) {
                const x = x0 + dx, y = y0 + dy
                if (x < 0 || y < 0 || x >= w || y >= h || sea[y * w + x]) continue
                best = Math.min(best, Math.hypot(dx * kmX, dy * kmY))
              }
            }
          }
          return best === Infinity ? null : best
        },
      })
    }
    img.src = `${dir}/${file}`
    return () => { live = false }
  }, [dir, m, file])
  return mask
}
