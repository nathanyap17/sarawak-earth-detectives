// Sound for the agency: a slow detective-noir loop (walking upright bass, brushes, a muted bell
// motif) under a space pad with sonar pings, plus short effects for buttons and stations.
// Everything is synthesised live with the Web Audio API: no audio files are downloaded, so there
// is nothing to license and nothing extra to load on a school connection.
// Browsers only allow sound after a tap or key press, so nothing plays until the first one.
// Settings are kept per browser (localStorage). AI-assisted: written with Claude Code.

export interface SoundPrefs { music: boolean; musicVol: number; sfx: boolean; sfxVol: number }
export type Sfx = 'click' | 'confirm' | 'open' | 'pin' | 'stamp' | 'success'

const KEY = 'sed.sound.v1'
const DEFAULTS: SoundPrefs = { music: true, musicVol: 0.45, sfx: true, sfxVol: 0.6 }

function load(): SoundPrefs {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return DEFAULTS }
}

let prefs = load()
const subs = new Set<() => void>()
export const getPrefs = () => prefs
export function subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f) } }
export function setPrefs(p: Partial<SoundPrefs>) {
  prefs = { ...prefs, ...p }
  try { localStorage.setItem(KEY, JSON.stringify(prefs)) } catch { /* private mode: keep in memory */ }
  applyLevels()
  if (prefs.music) startMusic(); else stopMusic()
  subs.forEach((f) => f())
}

// ---------------------------------------------------------------- the audio graph
let ctx: AudioContext | null = null
let musicBus: GainNode, duckBus: GainNode, sfxBus: GainNode, verbIn: GainNode, delayIn: GainNode
let wantMusic = false       // the app screen wants music (the landing and review pages do not)
let ducked = false          // the microphone is open: music steps aside so it isn't transcribed

function graph(): AudioContext | null {
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  const out = ctx.createDynamicsCompressor()
  out.threshold.value = -14; out.ratio.value = 3
  out.connect(ctx.destination)
  musicBus = ctx.createGain(); duckBus = ctx.createGain(); sfxBus = ctx.createGain()
  musicBus.connect(duckBus).connect(out); sfxBus.connect(out)
  // Space: a long, dark reverb (decaying noise) and a slow echo, both on the music only.
  const verb = ctx.createConvolver(); verb.buffer = impulse(ctx, 3.2)
  verbIn = ctx.createGain(); verbIn.gain.value = 0.55
  verbIn.connect(verb).connect(musicBus)
  const delay = ctx.createDelay(2); delay.delayTime.value = 0.56
  const fb = ctx.createGain(); fb.gain.value = 0.38
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2200
  delayIn = ctx.createGain(); delayIn.gain.value = 0.5
  delayIn.connect(delay).connect(tone).connect(fb).connect(delay)
  tone.connect(musicBus); tone.connect(verbIn)
  applyLevels()
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) void ctx.suspend()
    else ctx.resume().then(() => { if (wantMusic && prefs.music) startMusic() }, () => {})
  })
  return ctx
}

function impulse(c: AudioContext, secs: number): AudioBuffer {
  const n = Math.floor(c.sampleRate * secs)
  const b = c.createBuffer(2, n, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch)
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2)
  }
  return b
}

function applyLevels() {
  if (!ctx) return
  const t = ctx.currentTime
  musicBus.gain.setTargetAtTime(prefs.music ? prefs.musicVol * 0.5 : 0, t, 0.3)
  duckBus.gain.setTargetAtTime(ducked ? 0 : 1, t, ducked ? 0.05 : 0.6)
  sfxBus.gain.setTargetAtTime(prefs.sfx ? prefs.sfxVol * 0.7 : 0, t, 0.02)
}

/** Call on the first tap or key press: browsers keep audio locked until then. */
export function unlock() {
  const c = graph()
  if (!c) return
  const go = () => { if (wantMusic && prefs.music) startMusic() }
  if (c.state === 'running') go()
  else if (!document.hidden) c.resume().then(go, () => {})   // resume is async: start the loop once it runs
}

/** The app screen turns music on; the landing and review pages turn it off. */
export function setScene(music: boolean) {
  wantMusic = music
  if (music && prefs.music) startMusic(); else stopMusic()
}

/** For checks and debugging: is the audio unlocked, is the music loop running, is it ducked? */
export const soundState = () => ({ audio: ctx?.state ?? 'not started', music: !!timer, ducked })
if (import.meta.env.DEV) (window as unknown as { __sound: unknown }).__sound = { soundState, duck, setPrefs }

/** Hold-to-talk opens the microphone: silence the music so it doesn't leak into the recording. */
export function duck(on: boolean) { ducked = on; applyLevels() }

// ---------------------------------------------------------------- music
const BPM = 76
const EIGHTH = 60 / BPM / 2
const SWING = EIGHTH * 0.18
// A minor, four bars: Am7 | Fmaj7 | Dm9 | E7(b9). MIDI note numbers.
const CHORDS = [
  { bass: [45, 48, 52, 55], pad: [57, 60, 64, 67], bell: [76, 72, 69, 71] },
  { bass: [41, 45, 48, 52], pad: [53, 57, 60, 64], bell: [72, 69, 67, 69] },
  { bass: [38, 41, 45, 48], pad: [50, 53, 57, 64], bell: [69, 65, 64, 62] },
  { bass: [40, 44, 47, 50], pad: [52, 56, 59, 62], bell: [68, 71, 74, 76] },
]
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

let timer = 0
let step = 0
let nextAt = 0

function startMusic() {
  if (!wantMusic || !prefs.music || timer) return
  const c = graph()
  if (!c || c.state !== 'running') return
  step = 0
  nextAt = c.currentTime + 0.12
  timer = window.setInterval(tick, 40)
}

function stopMusic() {
  if (timer) { clearInterval(timer); timer = 0 }
}

function tick() {
  const c = ctx
  if (!c) return
  while (nextAt < c.currentTime + 0.25) {
    play(step, nextAt + (step % 2 ? SWING : 0))
    nextAt += EIGHTH
    step++
  }
}

function play(s: number, t: number) {
  const bar = Math.floor(s / 8) % 16
  const chord = CHORDS[bar % 4]
  const inBar = s % 8
  if (inBar % 2 === 0) bass(hz(chord.bass[inBar / 2]), t)
  if (inBar === 0) pad(chord.pad, t, EIGHTH * 8)
  if (inBar === 2 || inBar === 6) brush(t, 0.05)        // ride on 2 and 4
  if (inBar % 2 === 1) brush(t, 0.022)                  // swung brushes
  if (inBar === 4 && bar % 2 === 1) ping(hz(chord.pad[3] + 24), t)   // sonar
  if (bar >= 8 && bar < 12 && (inBar === 0 || inBar === 3 || inBar === 5)) {
    bell(hz(chord.bell[[0, 3, 5].indexOf(inBar)]), t)  // the motif: half the loop only
  }
}

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}

function bass(f: number, t: number) {
  const c = ctx!
  const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f
  const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f / 2
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(220, t + 0.35)
  const g = c.createGain(); env(g, t, 0.34, 0.012, 0.62)
  o.connect(lp); o2.connect(lp); lp.connect(g).connect(musicBus)
  o.start(t); o2.start(t); o.stop(t + 0.7); o2.stop(t + 0.7)
}

function pad(notes: number[], t: number, len: number) {
  const c = ctx!
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2
  lp.frequency.setValueAtTime(380, t); lp.frequency.linearRampToValueAtTime(1100, t + len * 0.6); lp.frequency.linearRampToValueAtTime(420, t + len)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 1.4); g.gain.linearRampToValueAtTime(0.0001, t + len + 0.8)
  lp.connect(g); g.connect(musicBus); g.connect(verbIn)
  for (const n of notes) for (const det of [-7, 6]) {
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = det
    o.connect(lp); o.start(t); o.stop(t + len + 1)
  }
}

function brush(t: number, level: number) {
  const c = ctx!
  const len = 0.09
  const b = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const src = c.createBufferSource(); src.buffer = b
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6500
  const g = c.createGain(); env(g, t, level, 0.004, len)
  src.connect(hp).connect(g).connect(musicBus)
  src.start(t)
}

function ping(f: number, t: number) {
  const c = ctx!
  const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.985, t + 1)
  const g = c.createGain(); env(g, t, 0.06, 0.005, 1.1)
  o.connect(g); g.connect(delayIn); g.connect(verbIn)
  o.start(t); o.stop(t + 1.2)
}

function bell(f: number, t: number) {
  // A soft FM bell, like a vibraphone behind a closed door.
  const c = ctx!
  const car = c.createOscillator(); car.frequency.value = f
  const mod = c.createOscillator(); mod.frequency.value = f * 3.5
  const mg = c.createGain(); mg.gain.setValueAtTime(f * 1.2, t); mg.gain.exponentialRampToValueAtTime(1, t + 0.9)
  mod.connect(mg).connect(car.frequency)
  const g = c.createGain(); env(g, t, 0.07, 0.01, 1.4)
  car.connect(g); g.connect(musicBus); g.connect(delayIn)
  car.start(t); mod.start(t); car.stop(t + 1.5); mod.stop(t + 1.5)
}

// ---------------------------------------------------------------- effects
function blip(f0: number, f1: number, t: number, len: number, level: number, type: OscillatorType = 'sine') {
  const c = ctx!
  const o = c.createOscillator(); o.type = type
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len)
  const g = c.createGain(); env(g, t, level, 0.003, len)
  o.connect(g).connect(sfxBus)
  o.start(t); o.stop(t + len + 0.05)
}

export function sfx(kind: Sfx) {
  if (!prefs.sfx) return
  const c = graph()
  if (!c) return
  if (c.state !== 'running') { c.resume().then(() => sfx(kind), () => {}); return }
  const t = c.currentTime + 0.005
  switch (kind) {
    case 'click': blip(1900, 1100, t, 0.045, 0.16); blip(3800, 2600, t, 0.02, 0.04); break
    case 'confirm': blip(880, 880, t, 0.06, 0.14, 'triangle'); blip(1320, 1320, t + 0.06, 0.1, 0.13, 'triangle'); break
    case 'open': blip(520, 780, t, 0.12, 0.12, 'triangle'); blip(1560, 1560, t + 0.08, 0.18, 0.04); break
    case 'pin': blip(1400, 700, t, 0.08, 0.14); blip(2100, 2100, t + 0.05, 0.25, 0.04); break
    case 'stamp': blip(150, 55, t, 0.22, 0.4, 'triangle'); blip(900, 300, t, 0.05, 0.08, 'square'); break
    case 'success': [523, 659, 784, 1047].forEach((f, i) => blip(f, f, t + i * 0.09, 0.22, 0.11, 'triangle')); break
  }
}

// ---------------------------------------------------------------- one listener for every button
const CLICKABLE = 'button, a[href], [role="button"], [role="tab"], [role="menuitem"], summary, select, input[type="checkbox"], input[type="radio"], input[type="range"]'
let wired = false

/** Wire the whole page once: every button, link and control clicks; the first press unlocks audio. */
export function wireClicks() {
  if (wired) return
  wired = true
  document.addEventListener('pointerdown', (e) => {
    unlock()
    const el = (e.target as Element | null)?.closest?.(CLICKABLE) as HTMLElement | null
    if (!el || el.matches(':disabled, [aria-disabled="true"]') || el.dataset.sound === 'off') return
    sfx(el.classList.contains('primary') ? 'confirm' : 'click')
  }, true)
  document.addEventListener('keydown', (e) => {
    unlock()
    if (e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return
    const el = (e.target as Element | null)?.closest?.(CLICKABLE) as HTMLElement | null
    if (el && !el.matches(':disabled') && el.dataset.sound !== 'off') sfx(el.classList.contains('primary') ? 'confirm' : 'click')
  }, true)
}
