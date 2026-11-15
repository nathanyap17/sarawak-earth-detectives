// Hold to talk: press and hold the mic, speak, let go, and the question is asked. Uses the
// browser's own speech recognition (Chrome, Edge, Safari); the button hides where there is none.
// Nothing is recorded or stored by us; the browser's speech service turns the voice into text.
// Keyboard: hold Space or Enter on the focused button.
// AI-assisted: written with Claude Code.
import { useEffect, useRef, useState } from 'react'

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

export const canTalk = () => typeof window !== 'undefined' && ctor() !== null

export function HoldToTalk({ onText, onDone, disabled }: { onText: (t: string) => void; onDone: (t: string) => void; disabled?: boolean }) {
  const rec = useRef<Rec | null>(null)
  const said = useRef('')
  const [on, setOn] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => () => rec.current?.abort(), [])
  if (!canTalk()) return null

  function start() {
    if (disabled || rec.current) return
    const C = ctor()!
    const r = new C()
    r.lang = navigator.language?.startsWith('en') ? navigator.language : 'en-GB'
    r.interimResults = true; r.continuous = true; r.maxAlternatives = 1
    said.current = ''; setErr('')
    r.onresult = (e) => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      said.current = t.trim().slice(0, 300)
      onText(said.current)
    }
    r.onerror = (e) => {
      setErr(e.error === 'not-allowed' ? 'Allow the microphone to talk to Kenyalang.' : e.error === 'no-speech' ? "I didn't hear anything." : '')
    }
    r.onend = () => {
      rec.current = null; setOn(false)
      if (said.current) onDone(said.current)
    }
    rec.current = r
    try { r.start(); setOn(true) } catch { rec.current = null }
  }
  const stop = () => rec.current?.stop()

  return (
    <>
      <button type="button" className={`talk ${on ? 'on' : ''}`} disabled={disabled}
        aria-label="Hold to talk" aria-pressed={on} title="Hold to talk, let go to ask"
        onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); start() }}
        onPointerUp={stop} onPointerCancel={stop} onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start() } }}
        onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); stop() } }}>
        {on ? '● Listening…' : '🎙 Hold to talk'}
      </button>
      {err && <small className="talk-err" role="status">{err}</small>}
    </>
  )
}
