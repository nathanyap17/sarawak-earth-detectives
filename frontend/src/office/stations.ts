// Camera stations: an overview of the whole office, and one close-up per object. No free roaming.
// AI-assisted: written with Claude Code.
import type { SpotId } from './ui'

export type V3 = [number, number, number]
export interface Station { pos: V3; look: V3 }

/** The whole office, seen through the missing fourth wall. */
export const OVERVIEW: Station = { pos: [0, 3.05, 7.0], look: [0, 1.45, -1.6] }

export const STATIONS: Record<SpotId, Station> = {
  inbox:     { pos: [1.5, 1.6, 3.1],     look: [2.7, 0.9, 1.5] },
  call:      { pos: [0.1, 1.75, -0.3],   look: [0.2, 1.0, -3.0] },
  scene:     { pos: [0, 3.55, 1.95],     look: [0, 0.9, 0.2] },
  locker:    { pos: [2.0, 1.55, -1.2],   look: [4.4, 0.95, -1.2] },
  board:     { pos: [-2.4, 1.8, -1.6],   look: [-2.4, 1.85, -3.95] },
  lab:       { pos: [-1.75, 1.8, -1.0], look: [-4.4, 1.15, -1.0] },
  deduction: { pos: [-0.75, 1.35, -1.75], look: [-0.75, 0.82, -2.75] },
  agency:    { pos: [-2.3, 1.75, 1.25],  look: [-4.6, 1.45, 1.25] },
  closed:    { pos: [3.9, 1.7, -0.9],    look: [3.9, 1.35, -3.75] },
}
