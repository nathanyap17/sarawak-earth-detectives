// Canvas-painted textures (labels, flag, window view). Painted locally: no font or image downloads.
// AI-assisted: written with Claude Code.
import { CanvasTexture, SRGBColorSpace } from 'three'

function tex(c: HTMLCanvasElement) {
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  return [c, c.getContext('2d')!] as const
}

/** A paper note with wrapped text. */
export function noteTexture(title: string, sub = '', bg = '#fffaf0', ink = '#2b211b') {
  const [c, g] = canvas(256, 192)
  g.fillStyle = bg; g.fillRect(0, 0, 256, 192)
  g.fillStyle = ink; g.font = 'bold 26px system-ui, sans-serif'
  wrap(g, title, 14, 40, 228, 30)
  if (sub) { g.font = '18px system-ui, sans-serif'; g.fillStyle = '#6b5d52'; wrap(g, sub, 14, 140, 228, 22) }
  return tex(c)
}

/** A rubber stamp. */
export function stampTexture(text: string, colour = '#c8102e') {
  const [c, g] = canvas(256, 96)
  g.strokeStyle = colour; g.lineWidth = 8; g.strokeRect(8, 8, 240, 80)
  g.fillStyle = colour; g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'center'
  g.fillText(text.toUpperCase().slice(0, 16), 128, 60)
  return tex(c)
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  let line = ''
  for (const w of text.split(' ')) {
    const t = line ? `${line} ${w}` : w
    if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); line = w; y += lh } else line = t
  }
  g.fillText(line, x, y)
}

/** Sarawak state flag: yellow field, red and black diagonal bands, nine-pointed yellow star. */
export function flagTexture() {
  const [c, g] = canvas(300, 200)
  g.fillStyle = '#f6c700'; g.fillRect(0, 0, 300, 200)
  const band = (off: number, col: string) => {
    g.fillStyle = col; g.beginPath()
    g.moveTo(0, 200 - off); g.lineTo(300 - off, 0); g.lineTo(300 - off + 45, 0); g.lineTo(0, 245 - off); g.closePath(); g.fill()
  }
  band(60, '#c8102e'); band(105, '#1a1a1a')
  g.fillStyle = '#f6c700'; g.beginPath()
  for (let i = 0; i < 18; i++) {
    const r = i % 2 ? 14 : 30, a = (i * Math.PI) / 9 - Math.PI / 2
    g.lineTo(72 + r * Math.cos(a), 112 + r * Math.sin(a))
  }
  g.closePath(); g.fill()
  return tex(c)
}

/** Rainforest at dusk seen through the window. */
export function windowViewTexture() {
  const [c, g] = canvas(512, 256)
  const sky = g.createLinearGradient(0, 0, 0, 256)
  sky.addColorStop(0, '#2c3e66'); sky.addColorStop(0.55, '#e88a4f'); sky.addColorStop(0.8, '#f5c27a')
  g.fillStyle = sky; g.fillRect(0, 0, 512, 256)
  const hills = (y: number, col: string, amp: number, f: number) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, 256)
    for (let x = 0; x <= 512; x += 8) g.lineTo(x, y + Math.sin(x * f) * amp + Math.sin(x * f * 2.7) * amp * 0.4)
    g.lineTo(512, 256); g.closePath(); g.fill()
  }
  hills(150, '#3b4d3a', 14, 0.012); hills(180, '#24362a', 10, 0.02)
  g.fillStyle = '#16241b'
  for (let x = 0; x < 512; x += 14) {               // canopy crowns
    const h = 30 + ((x * 37) % 23)
    g.beginPath(); g.arc(x, 256 - h, 12 + ((x * 13) % 7), 0, Math.PI * 2); g.fill()
    g.fillRect(x - 2, 256 - h, 4, h)
  }
  return tex(c)
}
