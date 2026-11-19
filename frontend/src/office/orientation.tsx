// Phones and tablets: the 3D office is used sideways (landscape), the 2D mode upright (portrait).
// Held the other way, a card asks the student to turn the device, or to switch to the mode that
// fits how they hold it. Choosing 3D also asks the browser to go full screen and lock landscape
// (Android Chrome allows it; iPhone Safari does not, so there the card does the work).
// Computers (a mouse or trackpad that can hover) are never asked.
// AI-assisted: written with Claude Code.
import { useSyncExternalStore } from 'react'
import type { Mode } from './capability'

const HANDHELD = '(hover: none) and (pointer: coarse)'
const PORTRAIT = '(orientation: portrait)'

function useMedia(q: string): boolean {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(q); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
    () => window.matchMedia(q).matches,
  )
}

export const isHandheld = () => window.matchMedia(HANDHELD).matches

type Lockable = ScreenOrientation & { lock?: (o: 'landscape') => Promise<void>; unlock?: () => void }

/** Call from the tap that picks a mode (browsers allow full screen only from a tap). */
export async function fitOrientation(m: Mode) {
  if (!isHandheld()) return
  const so = screen.orientation as Lockable | undefined
  try {
    if (m === '3d') {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      await so?.lock?.('landscape')
    } else {
      so?.unlock?.()
      if (document.fullscreenElement) await document.exitFullscreen()
    }
  } catch { /* not supported here (iPhone, desktop browsers): the card below asks instead */ }
}

/** Shown over the app while a phone or tablet is held the wrong way for the current mode. */
export function RotateGate({ mode, onSwitch, canSwitch }: { mode: Mode; onSwitch: (m: Mode) => void; canSwitch: boolean }) {
  const handheld = useMedia(HANDHELD)
  const portrait = useMedia(PORTRAIT)
  const want3d = mode === '3d'
  if (!handheld || want3d !== portrait) return null
  const other: Mode = want3d ? 'lite' : '3d'
  return (
    <div className="rotate-gate" role="dialog" aria-modal="true" aria-labelledby="rotate-h">
      <div className={`rotate-phone ${want3d ? 'to-land' : 'to-port'}`} aria-hidden="true"><span /></div>
      <h2 id="rotate-h">{want3d ? 'Turn your device sideways' : 'Turn your device upright'}</h2>
      <p>{want3d
        ? 'The 3D office is built for a wide screen. Hold your phone or tablet sideways to walk in.'
        : 'The 2D office reads best held upright, like a case folder.'}</p>
      {canSwitch && (
        <button className="primary" onClick={() => { onSwitch(other); void fitOrientation(other) }}>
          {want3d ? 'Use the 2D office instead' : 'Open the 3D office instead'}
        </button>
      )}
      <small>Your case is kept either way.</small>
    </div>
  )
}
