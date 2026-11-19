// The settings gear at the right end of the top bar: music and sound-effect switches with
// volume, and the teachers' shortcut to the review desk (/#/review).
// AI-assisted: written with Claude Code.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getPrefs, setPrefs, subscribe } from './audio'

export function useSoundPrefs() { return useSyncExternalStore(subscribe, getPrefs) }

export function SettingsMenu() {
  const p = useSoundPrefs()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  return (
    <div className="settings" ref={box}>
      <button className="mode gear" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog"
        aria-label="Settings" title="Settings">⚙</button>
      {open && (
        <div className="settings-pop" role="dialog" aria-label="Settings">
          <p className="settings-h">Sound</p>
          <div className="settings-row">
            <label><input type="checkbox" checked={p.music} onChange={(e) => setPrefs({ music: e.target.checked })} /> 🎵 Music</label>
            <input type="range" min={0} max={1} step={0.05} value={p.musicVol} disabled={!p.music}
              aria-label="Music volume" onChange={(e) => setPrefs({ musicVol: Number(e.target.value) })} />
          </div>
          <div className="settings-row">
            <label><input type="checkbox" checked={p.sfx} onChange={(e) => setPrefs({ sfx: e.target.checked })} /> 🔊 Sound effects</label>
            <input type="range" min={0} max={1} step={0.05} value={p.sfxVol} disabled={!p.sfx}
              aria-label="Sound effects volume" onChange={(e) => setPrefs({ sfxVol: Number(e.target.value) })} />
          </div>
          <p className="settings-note">Music and sounds are made live in your browser. They pause while you hold the mic.</p>
          <p className="settings-h">For teachers</p>
          <a className="settings-link" href="#/review" onClick={() => setOpen(false)}>📋 Teacher's desk: review and approve cases</a>
          <p className="settings-note">Needs the editor's key from your school's administrator.</p>
        </div>
      )}
    </div>
  )
}
