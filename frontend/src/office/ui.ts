// Office UI state: which window is open, what the pointer is over, whether the student is idle.
// AI-assisted: written with Claude Code.
import { create } from 'zustand'
import type { Beat } from '../state/session'

export type SpotId = Beat | 'inbox' | 'agency'

interface UI {
  win: SpotId | null
  hover: SpotId | null
  idle: boolean
  /** the camera is gliding to or from a station: floating labels hide until it settles */
  moving: boolean
  setMoving: (m: boolean) => void
  inboxSeen: boolean
  setWin: (w: SpotId | null) => void
  setHover: (h: SpotId | null) => void
  setIdle: (i: boolean) => void
}

export const useUI = create<UI>((set) => ({
  win: null, hover: null, idle: false, inboxSeen: false, moving: false,
  setMoving: (moving) => set({ moving }),
  setWin: (win) => set((s) => ({ win, hover: null, inboxSeen: s.inboxSeen || win === 'inbox' })),
  setHover: (hover) => set({ hover }),
  setIdle: (idle) => set({ idle }),
}))
