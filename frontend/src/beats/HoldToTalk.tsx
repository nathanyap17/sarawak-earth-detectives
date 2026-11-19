// Hold to talk: press and hold the mic, speak, let go, and the question is asked.
// Two ways to hear, chosen automatically:
//  1. the browser's own speech recognition (Chrome, Edge, Safari): words appear while you speak;
//  2. otherwise (Firefox, in-app browsers, or when 1 fails): a short recording is sent to our
//     server, Gemini writes down the words, and the audio is dropped.
// The button is always shown; it is greyed out until there is a case to ask about.
// Keyboard: hold Space or Enter on the focused button.
// AI-assisted: written with Claude Code.
import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { useSession } from '../state/session'
import { duck } from '../sound/audio'

type Rec = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number
  start(): void; stop(): void; abort(): void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}
type RecCtor = new () => Rec

function ctor(): RecCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}
const canRecord = () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
/** Once the browser's speech service fails (no service, blocked, offline), use the recorder for the rest of the visit. */
let browserSpeechBroken = false
const MAX_MS = 20_000

export const canTalk = () => typeof window !== 'undefined' && (ctor() !== null || canRecord())

export function HoldToTalk({ onText, onDone, disabled }: { onText: (t: string) => void; onDone: (t: string) => void; disabled?: boolean }) {
  const sid = useSession((s) => s.sessionId)
  const rec = useRef<Rec | null>(null)
  const media = useRef<MediaRecorder | null>(null)
  const held = useRef(false)
  const said = useRef('')
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => () => { rec.current?.abort(); media.current?.stream.getTracks().forEach((t) => t.stop()); duck(false) }, [])
  if (!canTalk()) return null
  const off = disabled || !sid || busy

  function viaBrowser() {
    const r = new (ctor()!)()
    r.lang = navigator.language?.startsWith('en') ? navigator.language : 'en-GB'
    r.interimResults = true; r.continuous = true; r.maxAlternatives = 1
    said.current = ''
    r.onresult = (e) => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      said.current = t.trim().slice(0, 300)
      onText(said.current)
    }
    r.onerror = (e) => {
      if (['network', 'service-not-allowed', 'language-not-supported'].includes(e.error) && canRecord()) {
        browserSpeechBroken = true
        setMsg('Switched to the recorder. Hold the button again and speak.')
      } else {
        setMsg(e.error === 'not-allowed' ? 'Allow the microphone to talk to Kenyalang.' : e.error === 'no-speech' ? "I didn't hear anything. Hold, speak, then let go." : '')
      }
    }
    r.onend = () => {
      rec.current = null; setOn(false)
      if (said.current) onDone(said.current)
    }
    rec.current = r
    try { r.start(); setOn(true) } catch { rec.current = null }
  }

  async function viaRecorder() {
    let stream: MediaStream
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }) } catch {
      setMsg('Allow the microphone to talk to Kenyalang.'); return
    }
    if (!held.current) { stream.getTracks().forEach((t) => t.stop()); return }   // let go before the mic was ready
    const type = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported?.(t))
    const m = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
    const parts: Blob[] = []
    const t0 = Date.now()
    m.ondataavailable = (e) => { if (e.data.size) parts.push(e.data) }
    m.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      media.current = null; setOn(false)
      if (Date.now() - t0 < 500) { setMsg('Hold the button while you speak.'); return }
      setBusy(true); setMsg('Writing down what you said…')
      try {
        const text = (await api.transcribe(sid!, new Blob(parts, { type: m.mimeType || type || 'audio/webm' }))).slice(0, 300)
        setMsg(text ? '' : "I didn't catch that. Try again, a little closer.")
        if (text) { onText(text); onDone(text) }
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "I couldn't hear that. Try typing instead.")
      } finally { setBusy(false) }
    }
    media.current = m
    m.start(); setOn(true)
    setTimeout(() => { if (media.current === m && m.state === 'recording') m.stop() }, MAX_MS)
  }

  function start() {
    if (off || rec.current || media.current) return
    held.current = true; setMsg('')
    duck(true)               // the music steps aside so the microphone hears only the student
    if (ctor() && !browserSpeechBroken) viaBrowser()
    else void viaRecorder()
  }
  function stop() {
    held.current = false
    setTimeout(() => duck(false), 400)
    rec.current?.stop()
    if (media.current?.state === 'recording') media.current.stop()
  }

  return (
    <>
      <button type="button" className={`talk ${on ? 'on' : ''}`} disabled={off}
        aria-label="Hold to talk" aria-pressed={on}
        title={sid ? 'Hold to talk, let go to ask' : 'Open a case first, then hold to ask Kenyalang out loud'}
        onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); start() }}
        onPointerUp={stop} onPointerCancel={stop} onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start() } }}
        onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); stop() } }}>
        {on ? '● Listening… let go to ask' : busy ? '✍ Writing it down…' : '🎙 Hold to talk'}
      </button>
      {msg && <small className="talk-err" role="status">{msg}</small>}
    </>
  )
}
