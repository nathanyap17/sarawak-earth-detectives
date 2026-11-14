// Solved cases, kept in this browser only (no account, no personal data: rule 5).
// AI-assisted: written with Claude Code.
export interface Learnt {
  id: string; title: string; ending: string; score: number; date: string
  variables: string[]; tools: string[]; verdict: string
}

const KEY = 'sed-learnt'

export function loadLearnt(): Learnt[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Learnt[] } catch { return [] }
}

export function saveLearnt(l: Learnt) {
  try {
    const all = loadLearnt().filter((x) => x.id !== l.id)
    localStorage.setItem(KEY, JSON.stringify([l, ...all].slice(0, 30)))
  } catch { /* private mode: the shelf just stays empty */ }
}
