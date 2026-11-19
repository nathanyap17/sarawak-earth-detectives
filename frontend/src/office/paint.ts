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

/** A medal face: a metal disc with a raised rim, the agency's nine-pointed star and the score. */
export function medalTexture(score: number, metal: string, shine: string) {
  const [c, g] = canvas(128, 128)
  const grad = g.createRadialGradient(46, 40, 6, 64, 64, 64)
  grad.addColorStop(0, shine); grad.addColorStop(0.55, metal); grad.addColorStop(1, '#3a2a10')
  g.fillStyle = grad; g.beginPath(); g.arc(64, 64, 63, 0, Math.PI * 2); g.fill()
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 4; g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.stroke()
  g.fillStyle = 'rgba(60,40,10,.35)'; g.beginPath()
  for (let i = 0; i < 18; i++) {
    const r = i % 2 ? 18 : 40, a = -Math.PI / 2 + (i * Math.PI) / 9
    g.lineTo(64 + r * Math.cos(a), 58 + r * Math.sin(a))
  }
  g.closePath(); g.fill()
  g.fillStyle = '#2a1a05'; g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'center'
  g.fillText(String(Math.round(score)), 64, 108)
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
  for (let y = 0; y < 200; y += 2) { g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, y, 300, 1) }     // weave
  for (let x = 0; x < 300; x += 2) { g.fillStyle = 'rgba(255,255,255,.03)'; g.fillRect(x, 0, 1, 200) }
  const fold = g.createLinearGradient(0, 0, 300, 0)
  for (let i = 0; i <= 6; i++) fold.addColorStop(i / 6, i % 2 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.06)')
  g.fillStyle = fold; g.fillRect(0, 0, 300, 200)
  return tex(c)
}

/** Rainforest at dusk seen through the window: layered ridges in mist, a low sun, cloud bands. */
export function windowViewTexture() {
  const [c, g] = canvas(1024, 512), r = rng(7)
  const sky = g.createLinearGradient(0, 0, 0, 512)
  sky.addColorStop(0, '#1d2c52'); sky.addColorStop(0.35, '#5a4a6e'); sky.addColorStop(0.6, '#e2834a'); sky.addColorStop(0.78, '#f7c47c'); sky.addColorStop(1, '#f2b06a')
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 512)
  const sun = g.createRadialGradient(640, 330, 4, 640, 330, 260)
  sun.addColorStop(0, 'rgba(255,246,214,1)'); sun.addColorStop(0.08, 'rgba(255,224,160,.9)'); sun.addColorStop(0.4, 'rgba(255,170,90,.25)'); sun.addColorStop(1, 'rgba(255,150,80,0)')
  g.fillStyle = sun; g.fillRect(0, 0, 1024, 512)
  for (let i = 0; i < 14; i++) {                      // thin cloud bands lit from below
    const y = 90 + r() * 200, x = r() * 1024, w = 200 + r() * 420
    g.fillStyle = y > 200 ? 'rgba(255,190,130,.3)' : 'rgba(150,110,140,.3)'
    g.beginPath(); g.ellipse(x, y, w / 2, 4 + r() * 6, 0, 0, Math.PI * 2); g.fill()
  }
  const ridge = (y: number, col: string, amp: number, f: number, mist: number) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, 512)
    for (let x = 0; x <= 1024; x += 6) g.lineTo(x, y + Math.sin(x * f) * amp + Math.sin(x * f * 2.7 + 1) * amp * 0.45 + Math.sin(x * f * 7.1) * amp * 0.12)
    g.lineTo(1024, 512); g.closePath(); g.fill()
    const m = g.createLinearGradient(0, y - amp, 0, y + 60)   // mist settling in the valley
    m.addColorStop(0, 'rgba(250,190,130,0)'); m.addColorStop(1, `rgba(250,190,130,${mist})`)
    g.fillStyle = m; g.fillRect(0, y - amp, 1024, 80)
  }
  ridge(300, '#7a6a72', 22, 0.006, 0.35); ridge(335, '#56505a', 18, 0.009, 0.3); ridge(370, '#38403a', 16, 0.013, 0.22); ridge(405, '#26332a', 12, 0.02, 0.12)
  for (let x = -10; x < 1034; x += 9) {              // canopy crowns, with a lit rim on the sun side
    const h = 54 + ((x * 37) % 41), rad = 12 + ((x * 13) % 11)
    g.fillStyle = '#121c15'; g.fillRect(x - 2, 512 - h, 4, h)
    g.beginPath(); g.arc(x, 512 - h, rad, 0, Math.PI * 2); g.fill()
    g.fillStyle = 'rgba(255,170,90,.18)'; g.beginPath(); g.arc(x + 3, 512 - h - 3, rad * 0.7, Math.PI * 1.1, Math.PI * 1.9); g.fill()
  }
  for (const [x, h] of [[170, 260], [880, 230]]) {   // two tall emergent trees
    g.fillStyle = '#0e1610'; g.fillRect(x - 4, 512 - h, 8, h)
    for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x + (k - 2) * 22, 512 - h - (k % 2) * 10, 30, 14, 0, 0, Math.PI * 2); g.fill() }
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
    g.globalAlpha = 0.04 + r() * 0.12; g.lineWidth = 0.4 + r() * 1.3
    g.beginPath()
    if (alongX) { const yy = y + r() * h; g.moveTo(x, yy); g.bezierCurveTo(x + w * 0.3, yy + (r() - 0.5) * 5, x + w * 0.7, yy + (r() - 0.5) * 5, x + w, yy + (r() - 0.5) * 3) }
    else { const xx = x + r() * w; g.moveTo(xx, y); g.bezierCurveTo(xx + (r() - 0.5) * 5, y + h * 0.3, xx + (r() - 0.5) * 5, y + h * 0.7, xx + (r() - 0.5) * 3, y + h) }
    g.stroke()
  }
  g.globalAlpha = 1
}
/** Teak character: a knot with grain swirling round it. */
function knot(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  for (let k = 6; k > 0; k--) {
    g.strokeStyle = `rgba(40,18,6,${0.08 + 0.05 * k})`; g.lineWidth = 0.8
    g.beginPath(); g.ellipse(x, y, s * k * 1.7, s * k * 0.55, 0, 0, Math.PI * 2); g.stroke()
  }
  g.fillStyle = 'rgba(30,12,4,.7)'; g.beginPath(); g.ellipse(x, y, s * 1.2, s * 0.5, 0, 0, Math.PI * 2); g.fill()
}
/** Fine dark pores, the texture you see on real teak up close. */
function pores(g: CanvasRenderingContext2D, w: number, h: number, r: () => number, n: number) {
  for (let i = 0; i < n; i++) { g.fillStyle = `rgba(25,10,3,${0.12 + r() * 0.2})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 0.8) }
}
/** Varnish: a soft sheen band so polished wood catches the light. */
function sheen(g: CanvasRenderingContext2D, w: number, h: number) {
  const s = g.createLinearGradient(0, 0, w, h)
  s.addColorStop(0, 'rgba(255,220,170,0)'); s.addColorStop(0.5, 'rgba(255,220,170,.06)'); s.addColorStop(1, 'rgba(255,220,170,0)')
  g.fillStyle = s; g.fillRect(0, 0, w, h)
}

/** Teak floorboards: planks in different tones, grain, knots, worn centres, dark seams and nails. */
export function plankTexture() {
  const [c, g] = canvas(1024, 1024), r = rng(11)
  const tones = ['#6f4526', '#7b4e2b', '#68401f', '#845530', '#74492a', '#5f3a1e']
  for (let row = 0; row < 8; row++) {
    let x = -r() * 400
    const y = row * 128
    while (x < 1024) {
      const w = 360 + r() * 320
      g.fillStyle = tones[Math.floor(r() * tones.length)]; g.fillRect(x, y, w, 128)
      g.fillStyle = 'rgba(255,210,160,.05)'; g.fillRect(x, y + 30, w, 60)          // worn, lighter middle
      grain(g, x, y, w, 128, r, '#2a1608', 46)
      grain(g, x, y, w, 128, r, '#d8a070', 10)
      if (r() > 0.55) knot(g, x + 60 + r() * (w - 120), y + 30 + r() * 68, 2 + r() * 2.5)
      g.fillStyle = 'rgba(20,10,4,.85)'; g.fillRect(x + w - 2.5, y, 2.5, 128)
      g.fillStyle = 'rgba(15,8,3,.8)'
      for (const ny of [22, 106]) { g.beginPath(); g.arc(x + 14, y + ny, 2.2, 0, 7); g.fill(); g.beginPath(); g.arc(x + w - 16, y + ny, 2.2, 0, 7); g.fill() }
      x += w
    }
    g.fillStyle = 'rgba(20,10,4,.9)'; g.fillRect(0, y, 1024, 2.5)
    g.fillStyle = 'rgba(255,220,180,.08)'; g.fillRect(0, y + 2.5, 1024, 1.5)
  }
  pores(g, 1024, 1024, r, 9000)
  return tiled(c, 3, 2.4)
}

/** Polished teak for furniture. */
export function woodTexture(base = '#8a5a2b', seed = 5) {
  const [c, g] = canvas(512, 512), r = rng(seed)
  g.fillStyle = base; g.fillRect(0, 0, 512, 512)
  for (let b = 0; b < 9; b++) { g.fillStyle = r() > 0.5 ? `rgba(40,20,6,${0.04 + r() * 0.05})` : `rgba(230,170,110,${0.04 + r() * 0.05})`; g.fillRect(0, r() * 512, 512, 10 + r() * 50) }   // growth bands
  grain(g, 0, 0, 512, 512, r, '#2e1808', 150)
  grain(g, 0, 0, 512, 512, r, '#f0c080', 40)
  if (seed % 2) knot(g, 140 + r() * 240, 120 + r() * 260, 3)
  pores(g, 512, 512, r, 2500)
  sheen(g, 512, 512)
  return tiled(c, 1, 1)
}

/** Wall panelling: teak boards with raised, bevelled fields and shadowed edges. */
export function panelTexture() {
  const [c, g] = canvas(512, 512), r = rng(23)
  g.fillStyle = '#5c3a20'; g.fillRect(0, 0, 512, 512)
  grain(g, 0, 0, 512, 512, r, '#1e0f05', 140, false)
  grain(g, 0, 0, 512, 512, r, '#e2a46a', 20, false)
  pores(g, 512, 512, r, 1800)
  for (let x = 0; x < 512; x += 128) {
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x, 0, 5, 512)
    g.fillStyle = 'rgba(255,210,150,.14)'; g.fillRect(x + 5, 0, 3, 512)
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 24, 52, 84, 410)
    g.fillStyle = '#5a3920'; g.fillRect(x + 28, 56, 76, 402)
    grain(g, x + 28, 56, 76, 402, r, '#1e0f05', 30, false)
    g.strokeStyle = 'rgba(255,215,160,.22)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 26, 460); g.lineTo(x + 26, 54); g.lineTo(x + 106, 54); g.stroke()
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.moveTo(x + 106, 54); g.lineTo(x + 106, 460); g.lineTo(x + 26, 460); g.stroke()
  }
  sheen(g, 512, 512)
  return tiled(c, 5, 1)
}

/** Limewashed plaster: brush clouds at several sizes, sand in the paint, hairline cracks. */
export function plasterTexture(base = '#3d5c4b') {
  const [c, g] = canvas(512, 512), r = rng(41)
  g.fillStyle = base; g.fillRect(0, 0, 512, 512)
  const layers: [number, number, number][] = [[260, 40, 90], [900, 10, 34], [2600, 2, 8]]
  for (const [n, a, b] of layers) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = r() > 0.5 ? `rgba(255,250,235,${0.004 + r() * 0.008})` : `rgba(0,0,0,${0.005 + r() * 0.009})`
      g.beginPath(); g.arc(r() * 512, r() * 512, a + r() * (b - a), 0, Math.PI * 2); g.fill()
    }
  }
  for (let i = 0; i < 26000; i++) { g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.05)'; g.fillRect(r() * 512, r() * 512, 1, 1) }
  g.strokeStyle = 'rgba(0,0,0,.13)'; g.lineWidth = 0.7
  for (let k = 0; k < 4; k++) {
    let x = r() * 512, y = r() * 512
    g.beginPath(); g.moveTo(x, y)
    for (let s = 0; s < 12; s++) { x += (r() - 0.4) * 18; y += (r() - 0.5) * 14; g.lineTo(x, y) }
    g.stroke()
  }
  return tiled(c, 4, 2)
}

/** Cork for the pinboard: warm crumb with old pin holes. */
export function corkTexture() {
  const [c, g] = canvas(512, 512), r = rng(57)
  g.fillStyle = '#b07f4e'; g.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 16000; i++) {
    const t = r()
    g.fillStyle = t > 0.66 ? 'rgba(90,52,24,.35)' : t > 0.33 ? 'rgba(220,170,110,.3)' : 'rgba(140,90,46,.4)'
    g.beginPath(); g.arc(r() * 512, r() * 512, 0.6 + r() * 2.4, 0, Math.PI * 2); g.fill()
  }
  for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(40,20,8,.55)'; g.beginPath(); g.arc(r() * 512, r() * 512, 1.3, 0, 7); g.fill() }
  return tiled(c, 2, 1.3)
}

/** Aged leather: dark oxblood with creases and a worn, lighter seat. */
export function leatherTexture() {
  const [c, g] = canvas(256, 256), r = rng(61)
  g.fillStyle = '#3b1f17'; g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 6000; i++) { g.fillStyle = r() > 0.5 ? 'rgba(255,200,170,.04)' : 'rgba(0,0,0,.12)'; g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1) }
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.8
  for (let i = 0; i < 40; i++) {
    const x = r() * 256, y = r() * 256
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 20, x + (r() - 0.5) * 60, y + (r() - 0.5) * 30); g.stroke()
  }
  const wear = g.createRadialGradient(128, 110, 10, 128, 128, 140)
  wear.addColorStop(0, 'rgba(160,90,60,.22)'); wear.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = wear; g.fillRect(0, 0, 256, 256)
  return tiled(c, 1, 1)
}

/** Ceiling: dark-stained boards between the beams. */
export function ceilingTexture() {
  const [c, g] = canvas(512, 512), r = rng(71)
  g.fillStyle = '#2a1b12'; g.fillRect(0, 0, 512, 512)
  for (let x = 0; x < 512; x += 64) { grain(g, x, 0, 64, 512, r, '#0f0805', 14, false); g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x, 0, 2, 512) }
  return tiled(c, 6, 4)
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
