// Canvas-painted textures (labels, flag, window view). Painted locally: no font or image downloads.
// AI-assisted: written with Claude Code.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

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

// ---- room surfaces (painted once, tiled) ----
function rng(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647 } }
function tiled(c: HTMLCanvasElement, rx: number, ry: number) {
  const t = tex(c); t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8
  return t
}
function grain(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: () => number, dark: string, n: number, alongX = true) {
  g.strokeStyle = dark
  for (let i = 0; i < n; i++) {
    g.globalAlpha = 0.05 + r() * 0.13; g.lineWidth = 0.6 + r() * 1.4
    g.beginPath()
    if (alongX) { const yy = y + r() * h; g.moveTo(x, yy); g.bezierCurveTo(x + w * 0.3, yy + (r() - 0.5) * 5, x + w * 0.7, yy + (r() - 0.5) * 5, x + w, yy + (r() - 0.5) * 3) }
    else { const xx = x + r() * w; g.moveTo(xx, y); g.bezierCurveTo(xx + (r() - 0.5) * 5, y + h * 0.3, xx + (r() - 0.5) * 5, y + h * 0.7, xx + (r() - 0.5) * 3, y + h) }
    g.stroke()
  }
  g.globalAlpha = 1
}

/** Teak floorboards: long planks in slightly different tones, with grain and dark seams. */
export function plankTexture() {
  const [c, g] = canvas(512, 512), r = rng(11)
  const tones = ['#6f4526', '#7b4e2b', '#68401f', '#845530', '#74492a']
  for (let row = 0; row < 8; row++) {
    let x = -r() * 200
    while (x < 512) {
      const w = 180 + r() * 160
      g.fillStyle = tones[Math.floor(r() * tones.length)]; g.fillRect(x, row * 64, w, 64)
      grain(g, x, row * 64, w, 64, r, '#2a1608', 16)
      g.fillStyle = 'rgba(20,10,4,.75)'; g.fillRect(x + w - 1.5, row * 64, 1.5, 64)
      x += w
    }
    g.fillStyle = 'rgba(20,10,4,.8)'; g.fillRect(0, row * 64, 512, 1.5)
  }
  return tiled(c, 3, 2.4)
}

/** Polished teak for furniture. */
export function woodTexture(base = '#8a5a2b', seed = 5) {
  const [c, g] = canvas(256, 256), r = rng(seed)
  g.fillStyle = base; g.fillRect(0, 0, 256, 256)
  grain(g, 0, 0, 256, 256, r, '#2e1808', 70)
  grain(g, 0, 0, 256, 256, r, '#f0c080', 20)
  return tiled(c, 1, 1)
}

/** Wall panelling: teak boards with raised battens. */
export function panelTexture() {
  const [c, g] = canvas(256, 256), r = rng(23)
  g.fillStyle = '#5c3a20'; g.fillRect(0, 0, 256, 256)
  grain(g, 0, 0, 256, 256, r, '#1e0f05', 60, false)
  for (let x = 0; x < 256; x += 64) {
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x, 0, 3, 256)
    g.fillStyle = 'rgba(255,210,150,.12)'; g.fillRect(x + 3, 0, 2, 256)
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(x + 12, 26, 40, 204)
    g.strokeStyle = 'rgba(255,210,150,.10)'; g.strokeRect(x + 14, 28, 40, 204)
  }
  return tiled(c, 5, 1)
}

/** Painted plaster with a little unevenness, so large walls do not look flat. */
export function plasterTexture(base = '#3d5c4b') {
  const [c, g] = canvas(256, 256), r = rng(41)
  g.fillStyle = base; g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 900; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,.012)' : 'rgba(0,0,0,.016)'
    g.beginPath(); g.arc(r() * 256, r() * 256, 6 + r() * 22, 0, Math.PI * 2); g.fill()
  }
  return tiled(c, 4, 2)
}

/** A woven rug in the colours of Sarawak weaving: maroon, black and cream diamonds and hooks. */
export function rugTexture() {
  const [c, g] = canvas(768, 512), r = rng(3)
  g.fillStyle = '#6e1f1a'; g.fillRect(0, 0, 768, 512)
  const band = (y: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(0, y, 768, h); g.fillRect(0, 512 - y - h, 768, h) }
  band(0, 26, '#1a1210'); band(26, 8, '#e8d9b5'); band(40, 16, '#a8431f'); band(60, 5, '#e8d9b5')
  g.fillStyle = '#1a1210'; g.fillRect(0, 0, 22, 512); g.fillRect(746, 0, 22, 512)
  g.fillStyle = '#e8d9b5'; g.fillRect(22, 0, 6, 512); g.fillRect(740, 0, 6, 512)
  const diamond = (cx: number, cy: number, w: number, h: number, col: string, lw = 0) => {
    g.beginPath(); g.moveTo(cx, cy - h); g.lineTo(cx + w, cy); g.lineTo(cx, cy + h); g.lineTo(cx - w, cy); g.closePath()
    if (lw) { g.strokeStyle = col; g.lineWidth = lw; g.stroke() } else { g.fillStyle = col; g.fill() }
  }
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
    const cx = 96 + i * 115, cy = 128 + j * 128
    diamond(cx, cy, 52, 58, '#1a1210'); diamond(cx, cy, 40, 46, '#e8d9b5', 4); diamond(cx, cy, 26, 30, '#a8431f'); diamond(cx, cy, 10, 12, '#e8d9b5')
    g.strokeStyle = '#e8d9b5'; g.lineWidth = 3                       // hooks between the diamonds
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 56, cy - 64); g.lineTo(cx + s * 56, cy - 40); g.lineTo(cx + s * 44, cy - 40); g.stroke() }
  }
  for (let i = 0; i < 5000; i++) { g.fillStyle = r() > 0.5 ? 'rgba(255,240,210,.06)' : 'rgba(0,0,0,.09)'; g.fillRect(r() * 768, r() * 512, 2, 1) }   // weave
  return tex(c)
}

/** A soft beam of light: bright at the window, fading to nothing. */
export function shaftTexture() {
  const [c, g] = canvas(64, 256)
  const gr = g.createLinearGradient(0, 0, 0, 256)
  gr.addColorStop(0, 'rgba(255,200,130,.9)'); gr.addColorStop(0.5, 'rgba(255,190,120,.35)'); gr.addColorStop(1, 'rgba(255,180,110,0)')
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256)
  return tex(c)
}

/** The agency crest: a hornbill on forest green inside a brass ring. */
export function crestTexture() {
  const [c, g] = canvas(256, 256)
  g.fillStyle = '#1f3a2c'; g.beginPath(); g.arc(128, 128, 122, 0, Math.PI * 2); g.fill()
  g.strokeStyle = '#d2a94e'; g.lineWidth = 9; g.beginPath(); g.arc(128, 128, 116, 0, Math.PI * 2); g.stroke()
  g.lineWidth = 2; g.beginPath(); g.arc(128, 128, 100, 0, Math.PI * 2); g.stroke()
  g.fillStyle = '#111'; g.beginPath(); g.ellipse(118, 150, 34, 48, -0.35, 0, Math.PI * 2); g.fill()     // body
  g.beginPath(); g.arc(140, 96, 24, 0, Math.PI * 2); g.fill()                                            // head
  g.fillStyle = '#f4ead8'; g.beginPath(); g.moveTo(96, 180); g.lineTo(70, 226); g.lineTo(112, 204); g.closePath(); g.fill()   // tail
  g.fillStyle = '#f6c700'; g.beginPath(); g.moveTo(156, 92); g.quadraticCurveTo(206, 96, 214, 128); g.quadraticCurveTo(184, 112, 154, 112); g.closePath(); g.fill()  // beak
  g.fillStyle = '#e8641b'; g.beginPath(); g.moveTo(150, 80); g.quadraticCurveTo(186, 56, 200, 84); g.quadraticCurveTo(176, 80, 156, 92); g.closePath(); g.fill()     // casque
  g.fillStyle = '#fff'; g.beginPath(); g.arc(146, 92, 5, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#111'; g.beginPath(); g.arc(147, 92, 2.2, 0, Math.PI * 2); g.fill()
  return tex(c)
}

/** The wire board on the wall above the teleprinter. */
export function wireTexture() {
  const [c, g] = canvas(512, 256)
  g.fillStyle = '#17241c'; g.fillRect(0, 0, 512, 256)
  g.strokeStyle = '#d2a94e'; g.lineWidth = 6; g.strokeRect(6, 6, 500, 244)
  g.fillStyle = '#f4ead8'; g.font = '700 40px Georgia, serif'; g.textAlign = 'center'; g.fillText('THE WIRE', 256, 62)
  g.font = '19px "Courier New", monospace'; g.fillStyle = '#d2a94e'
  ;['SCOUT', 'CHECK', 'BUILD', 'EDITOR', 'HINTS'].forEach((t, i) => g.fillText(t, 64 + i * 96, 214))
  g.strokeStyle = '#d2a94e'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 150); g.lineTo(448, 150); g.stroke()
  return tex(c)
}
