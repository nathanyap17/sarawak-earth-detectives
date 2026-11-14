// Investigation state (Zustand). Shared by lite mode and, later, the 3D office.
// AI-assisted: written with Claude Code.
import { create } from 'zustand'
import type { AnalysisResult, CasePublic, Grade, Series, Verdict } from '../api/types'

export type Draft = Omit<Verdict, 'session_id'>
export interface ChatLine { q: string; a: string; source: 'ai' | 'ladder'; beat: string }

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
  reached: number
  sceneDay: number
  setSceneDay: (d: number) => void
  cluePins: [number, number][]
  chosen: string[]
  herringWarning: boolean
  series: Record<string, Series>
  opened: string[]
  results: Record<string, Partial<Record<AnalysisResult['tool'], AnalysisResult>>>
  grade: Grade | null
  hintRung: Record<string, number>
  chat: ChatLine[]
  addChat: (c: ChatLine, group: string, rung: number) => void
  draft: Draft | null
  setDraft: (d: Draft) => void
  setSessionId: (id: string) => void
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
  activeCase: null, sessionId: null, beat: 'call' as Beat, reached: 0, sceneDay: 0, cluePins: [], chosen: [],
  herringWarning: false, series: {}, opened: [], results: {}, grade: null, draft: null as Draft | null,
  hintRung: {} as Record<string, number>, chat: [] as ChatLine[],
}

export const useSession = create<State>((set) => ({
  nickname: `Detective-${Math.floor(1000 + Math.random() * 9000)}`,
  ...fresh,
  setNickname: (nickname) => set({ nickname }),
  begin: (activeCase, sessionId) => set({ ...fresh, activeCase, sessionId, beat: 'scene', reached: 1 }),
  setBeat: (beat) => set((s) => ({ beat, reached: Math.max(s.reached, BEATS.indexOf(beat)) })),
  setSceneDay: (sceneDay) => set({ sceneDay }),
  addPin: (p) => set((s) => (s.cluePins.length >= 3 ? s : { cluePins: [...s.cluePins, p] })),
  setChosen: (chosen, herringWarning) => set({ chosen, herringWarning }),
  putSeries: (x) => set((s) => ({ series: { ...s.series, [x.card_id]: x } })),
  markOpened: (id) => set((s) => (s.opened.includes(id) ? s : { opened: [...s.opened, id] })),
  putResult: (r) => set((s) => ({
    results: { ...s.results, [r.card_id]: { ...s.results[r.card_id], [r.tool]: r } },
  })),
  setGrade: (grade) => set({ grade }),
  setDraft: (draft) => set({ draft }),
  setSessionId: (sessionId) => set({ sessionId }),
  addChat: (c, group, rung) => set((s) => ({ chat: [...s.chat, c].slice(-8), hintRung: { ...s.hintRung, [group]: Math.max(s.hintRung[group] ?? 0, rung) } })),
  reset: () => set({ ...fresh }),
}))
