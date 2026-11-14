// Camera stations: one per beat, no free roaming (PLAN Phase 3.5).
// AI-assisted: written with Claude Code.
import type { Beat } from '../state/session'

export type V3 = [number, number, number]
export interface Station { pos: V3; look: V3; object: string }

export const STATIONS: Record<Beat, Station> = {
  call:      { pos: [0.1, 1.75, -0.3],  look: [0.2, 1.0, -3.0],  object: 'the case folder on the desk' },
  scene:     { pos: [0, 3.55, 1.95],   look: [0, 0.9, 0.2],     object: 'the map table' },
  locker:    { pos: [2.0, 1.55, -0.6], look: [4.4, 0.95, -0.6],  object: 'the evidence cabinet' },
  board:     { pos: [-2.4, 1.65, -1.7], look: [-2.4, 1.6, -3.95], object: 'the corkboard' },
  lab:       { pos: [-2.0, 1.6, 0.4],  look: [-4.3, 0.95, 0.4],  object: 'the lab bench' },
  deduction: { pos: [-0.75, 1.35, -1.75], look: [-0.75, 0.82, -2.75], object: 'the typewriter' },
  closed:    { pos: [2.4, 1.55, 1.9],  look: [4.6, 1.15, 1.9],   object: 'the case shelf' },
}
