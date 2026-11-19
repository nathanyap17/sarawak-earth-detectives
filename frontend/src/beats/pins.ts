// Clue pins: place, move and remove. A student can change their mind about where to look, so a
// pin is never final. Every change is sent to the backend as the whole set (kind "pins").
// AI-assisted: written with Claude Code.
import { logQuiet } from '../api/client'
import type { SceneManifest } from '../api/types'
import { useSession } from '../state/session'
import { sfx } from '../sound/audio'

export const MAX_PINS = 3

function sync() {
  const s = useSession.getState()
  logQuiet(s.sessionId, { kind: 'pins', pins: s.cluePins })
}

/** A click on the map: moves the pin being moved, or adds a new one if there is room. */
export function placePin(p: [number, number]) {
  const s = useSession.getState()
  if (s.movingPin != null) { s.movePin(s.movingPin, p); sync(); sfx('pin'); return }
  if (s.cluePins.length >= MAX_PINS) return
  s.addPin(p)
  sfx('pin')
  logQuiet(s.sessionId, { kind: 'clue', lonlat: p })
}

export function removePin(i: number) { useSession.getState().removePin(i); sync() }

/** The case's own scene files, or the shared Sarawak base map when it has none. */
export async function loadManifest(caseId: string): Promise<{ dir: string; m: SceneManifest }> {
  for (const dir of [`/scenes/${caseId}`, '/scenes/base']) {
    try {
      const r = await fetch(`${dir}/manifest.json`)
      if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) return { dir, m: await r.json() }
    } catch { /* try the next one */ }
  }
  throw new Error('no scene')
}
