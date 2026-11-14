// Investigation state (Zustand). Shared by lite mode and, later, the 3D office.
// AI-assisted: written with Claude Code.
import { create } from 'zustand'
import type { AnalysisResult, CasePublic, Grade, Series, Verdict } from '../api/types'

export type Draft = Omit<Verdict, 'session_id'>

export const BEATS = ['call', 'scene', 'locker', 'board', 'lab', 'deduction', 'closed'] as const
export type Beat = (typeof BEATS)[number]
export const BEAT_LABEL: Record<Beat, string> = {
  call: 'The Call', scene: 'The Scene', locker: 'Evidence Locker', board: 'The Board',
  lab: 'The Lab', deduction: 'The Deduction', closed: 'Case Closed',
}

interface State {
  nickname: string
  activeCase: CasePublic | null
  sessionId: string | null
  beat: Beat
  cluePins: [number, number][]
  chosen: string[]
  herringWarning: boolean
  series: Record<string, Series>
  opened: string[]
  results: Record<string, Partial<Record<AnalysisResult['tool'], AnalysisResult>>>
  grade: Grade | null
  draft: Draft | null
  setDraft: (d: Draft) => void
  setNickname: (n: string) => void
  begin: (c: CasePublic, sessionId: string) => void
  setBeat: (b: Beat) => void
  addPin: (p: [number, number]) => void
  setChosen: (ids: string[], herring: boolean) => void
  putSeries: (s: Series) => void
  markOpened: (id: string) => void
  putResult: (r: AnalysisResult) => void
  setGrade: (g: Grade) => void
  reset: () => void
}

const fresh = {
  activeCase: null, sessionId: null, beat: 'call' as Beat, cluePins: [], chosen: [],
  herringWarning: false, series: {}, opened: [], results: {}, grade: null, draft: null as Draft | null,
}

export const useSession = create<State>((set) => ({
  nickname: `Detective-${Math.floor(1000 + Math.random() * 9000)}`,
  ...fresh,
  setNickname: (nickname) => set({ nickname }),
  begin: (activeCase, sessionId) => set({ ...fresh, activeCase, sessionId, beat: 'scene' }),
  setBeat: (beat) => set({ beat }),
  addPin: (p) => set((s) => (s.cluePins.length >= 3 ? s : { cluePins: [...s.cluePins, p] })),
  setChosen: (chosen, herringWarning) => set({ chosen, herringWarning }),
  putSeries: (x) => set((s) => ({ series: { ...s.series, [x.card_id]: x } })),
  markOpened: (id) => set((s) => (s.opened.includes(id) ? s : { opened: [...s.opened, id] })),
  putResult: (r) => set((s) => ({
    results: { ...s.results, [r.card_id]: { ...s.results[r.card_id], [r.tool]: r } },
  })),
  setGrade: (grade) => set({ grade }),
  setDraft: (draft) => set({ draft }),
  reset: () => set({ ...fresh }),
}))
