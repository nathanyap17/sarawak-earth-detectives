// Solved cases, kept in this browser only (no account, no personal data: rule 5).
// The shelf and the inbox both read them, so saving one updates both at once.
// AI-assisted: written with Claude Code.
import { useSyncExternalStore } from 'react'
import type { Badge, Ending } from '../api/types'
import { tierOf, type Tier } from '../beats/medal'

export interface Learnt {
  id: string; title: string; ending: string; score: number; date: string
  variables: string[]; tools: string[]; verdict: string
  /** added 2026-11-19; older entries are filled in on load */
  tier?: Tier; badges?: Badge[]; kind?: Exclude<Ending, 'sent_back'>
}

const KEY = 'sed-learnt'
const subs = new Set<() => void>()
let cache: { raw: string | null; list: Learnt[] } = { raw: null, list: [] }

function fill(l: Learnt): Learnt {
  return { ...l, tier: l.tier ?? tierOf(l.score), badges: l.badges ?? [],
           kind: l.kind ?? (l.ending.includes('not enough') ? 'solved_not_enough' : 'solved') }
}

export function loadLearnt(): Learnt[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw !== cache.raw) cache = { raw, list: (JSON.parse(raw ?? '[]') as Learnt[]).map(fill) }
    return cache.list
  } catch { return cache.list }
}

export function saveLearnt(l: Learnt) {
  try {
    const all = loadLearnt().filter((x) => x.id !== l.id)
    localStorage.setItem(KEY, JSON.stringify([fill(l), ...all].slice(0, 30)))
  } catch { /* private mode: the shelf just stays empty */ }
  subs.forEach((f) => f())
}

/** The learnt cases, re-rendering whenever one is filed. */
export function useLearnt(): Learnt[] {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, loadLearnt)
}
