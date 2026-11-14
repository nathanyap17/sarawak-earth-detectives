// Session state (Zustand). AI-assisted: scaffolded with Claude Code.
import { create } from 'zustand'

export type Beat = 'call' | 'scene' | 'locker' | 'board' | 'lab' | 'deduction' | 'closed'

interface SessionState {
  caseId: string | null; sessionId: string | null; beat: Beat
  chosenCards: string[]; cluePins: [number, number][]
  setBeat: (b: Beat) => void
}

export const useSession = create<SessionState>((set) => ({
  caseId: null, sessionId: null, beat: 'call', chosenCards: [], cluePins: [],
  setBeat: (beat) => set({ beat }),
}))
