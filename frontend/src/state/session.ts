// Investigation state (Zustand). Shared by lite mode and the 3D office. The case in progress is kept
// in this tab's sessionStorage, so a refresh does not lose it (state/recover.ts replays the work if the
// backend forgot the session). Nothing personal: a made-up nickname and the student's own steps.
// AI-assisted: written with Claude Code.
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { AnalysisResult, CasePublic, Grade, Series, Verdict } from '../api/types'

export type Draft = Omit<Verdict, 'session_id'>
export interface ChatLine { q: string; a: string; source: 'ai' | 'ladder'; beat: string; note?: string }

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
  removePin: (i: number) => void
  movePin: (i: number, p: [number, number]) => void
  /** which pin the next map click moves (null: the click adds a new pin) */
  movingPin: number | null
  setMovingPin: (i: number | null) => void
  setChosen: (ids: string[], herring: boolean) => void
  putSeries: (s: Series) => void
  markOpened: (id: string) => void
  putResult: (r: AnalysisResult) => void
  setGrade: (g: Grade) => void
  reset: () => void
}

/** Index of the step the student should do now. After a verdict is sent back with a retry left,
 *  that is the typewriter again, even though the case shelf was reached. */
export function frontier(s: { reached: number; grade: Grade | null }): number {
  return s.grade?.can_retry ? BEATS.indexOf('deduction') : s.reached
}
/** The verdict is final: no more submissions. */
export const caseFiled = (g: Grade | null) => !!g && !g.can_retry

const fresh = {
  activeCase: null, sessionId: null, beat: 'call' as Beat, reached: 0, sceneDay: 0, cluePins: [], movingPin: null as number | null, chosen: [],
  herringWarning: false, series: {}, opened: [], results: {}, grade: null, draft: null as Draft | null,
  hintRung: {} as Record<string, number>, chat: [] as ChatLine[],
}

export const useSession = create<State>()(persist((set) => ({
  nickname: `Detective-${Math.floor(1000 + Math.random() * 9000)}`,
  ...fresh,
  setNickname: (nickname) => set({ nickname }),
  begin: (activeCase, sessionId) => set({ ...fresh, activeCase, sessionId, beat: 'scene', reached: 1 }),
  setBeat: (beat) => set((s) => ({ beat, reached: Math.max(s.reached, BEATS.indexOf(beat)) })),
  setSceneDay: (sceneDay) => set({ sceneDay }),
  addPin: (p) => set((s) => (s.cluePins.length >= 3 ? s : { cluePins: [...s.cluePins, p] })),
  removePin: (i) => set((s) => ({ cluePins: s.cluePins.filter((_, k) => k !== i), movingPin: null })),
  movePin: (i, p) => set((s) => ({ cluePins: s.cluePins.map((q, k) => (k === i ? p : q)), movingPin: null })),
  setMovingPin: (movingPin) => set({ movingPin }),
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
}), {
  name: 'sed-case', version: 1,
  storage: createJSONStorage(() => sessionStorage),
  // everything but the pin being moved (a half-finished gesture)
  partialize: ({ movingPin: _m, ...rest }) => Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as Partial<State>,
}))
