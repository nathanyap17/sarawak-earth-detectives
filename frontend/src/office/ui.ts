// Office UI state: which window is open, what the pointer is over, whether the student is idle.
// AI-assisted: written with Claude Code.
import { create } from 'zustand'
import type { Beat } from '../state/session'

export type SpotId = Beat | 'inbox'

interface UI {
  win: SpotId | null
  hover: SpotId | null
  idle: boolean
  inboxSeen: boolean
  setWin: (w: SpotId | null) => void
  setHover: (h: SpotId | null) => void
  setIdle: (i: boolean) => void
}

export const useUI = create<UI>((set) => ({
  win: null, hover: null, idle: false, inboxSeen: false,
  setWin: (win) => set((s) => ({ win, hover: null, inboxSeen: s.inboxSeen || win === 'inbox' })),
  setHover: (hover) => set({ hover }),
  setIdle: (idle) => set({ idle }),
}))
