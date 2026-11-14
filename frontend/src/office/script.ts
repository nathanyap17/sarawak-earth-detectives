// The guide script: what Kenyalang (the hornbill Partner) says at each moment, which object to
// go to next, and a small vetted glossary. This is plain, human-written text, so it never
// contains a number or a result for the case. AI replies come only from the backend Partner.
// AI-assisted: written with Claude Code.
import type { AnalysisResult } from '../api/types'
import { BEATS, type Beat } from '../state/session'
import type { SpotId } from './ui'

export const SPOT: Record<SpotId, { name: string; todo: string }> = {
  inbox:     { name: 'Inbox', todo: 'Check your inbox' },
  call:      { name: 'Case folder', todo: 'Open the case folder' },
  scene:     { name: 'Map table', todo: 'Visit the scene' },
  locker:    { name: 'Evidence cabinet', todo: 'Choose your evidence' },
  board:     { name: 'Corkboard', todo: 'See the records over time' },
  lab:       { name: 'Lab bench', todo: 'Test the records' },
  deduction: { name: 'Typewriter', todo: 'Write your verdict' },
  closed:    { name: 'Case shelf', todo: "Read the Chief's stamp" },
}

export interface GuideState {
  hasCase: boolean; beat: Beat; win: SpotId | null; pins: number; chosen: number
  opened: number; stamped: number; herring: boolean; graded: boolean; sentBack: boolean; inboxSeen: boolean
}

/** The object the student should go to now. */
export function target(s: GuideState): SpotId {
  if (!s.hasCase) return s.inboxSeen ? 'call' : 'inbox'
  return s.beat
}

/** What Kenyalang says, and which words it offers to explain. */
export function say(s: GuideState): { text: string; words: string[] } {
  const t = target(s)
  if (s.win !== t && s.win !== null && s.win !== 'inbox') {
    return { text: `You're back at the ${SPOT[s.win].name.toLowerCase()}. When you're ready, the next step is: ${SPOT[t].todo.toLowerCase()}.`, words: [] }
  }
  if (s.win === null) {
    if (t === 'inbox') return { text: "Welcome to the agency, Detective! I'm Kenyalang, your partner. Something just arrived. Click the glowing inbox to see what's happening in Sarawak.", words: ['detective work'] }
    if (t === 'call') return { text: 'A client is waiting. Click the case folder on the desk to read the brief and sign it.', words: [] }
    return { text: `Next: ${SPOT[t].todo.toLowerCase()}. Click the glowing ${SPOT[t].name.toLowerCase()}.`, words: WORDS[t] ?? [] }
  }
  switch (s.win) {
    case 'inbox': return { text: 'Happenings are real events in Sarawak that we can investigate with NASA data. Solved cases move to Learnt cases. Pick a happening and open its folder.', words: ['happening', 'NASA data'] }
    case 'call': return { text: "Read the client's brief. Every case asks the same thing: is this getting worse, or was it one bad year? Type a detective name (not your real one) and sign.", words: ['trend'] }
    case 'scene': return s.pins < 1
      ? { text: 'This is Sarawak from space. Press Play to watch the fires through the season. Then click the map where something catches your eye to drop a clue pin.', words: ['satellite', 'fire detection'] }
      : { text: `${s.pins} of 3 pins placed. Add more if you like, then head to the Evidence Locker.`, words: ['satellite'] }
    case 'locker': return s.herring
      ? { text: "Hmm. One of those cards made me tilt my head. What does it have to do with the question? Change it, or keep it if you're sure.", words: ['red herring', 'evidence card'] }
      : { text: `Pick three to five records that could answer the question (${s.chosen} picked). Careful: not every card belongs to this case.`, words: ['evidence card', 'red herring', 'record'] }
    case 'board': return { text: `Flip each card to see how it changed over the years (${s.opened} flipped). Look for bumps, dips and odd years before you test anything.`, words: ['record', 'trend', 'mission'] }
    case 'lab': return { text: `Now test each record. A good order: Season filter, then Scales, then the El Niño lamp. Every record needs a stamp (${s.stamped} stamped so far).`, words: ['season filter', 'scales', 'significant', 'El Niño', 'per decade', 'twin region'] }
    case 'deduction': return { text: 'Write what you found, in your own words. Your verdict must follow your stamps. Saying the record can\'t settle it yet is allowed, if that is what the evidence shows.', words: ['significant', 'hypothesis', 'confidence'] }
    case 'closed': return s.sentBack
      ? { text: "The Chief sent it back. That happens to good detectives. Read the notes, then go back to the typewriter for one more try.", words: [] }
      : { text: "Case closed! Read the Chief's notes. Your case is filed under Learnt cases in the inbox.", words: [] }
  }
  return { text: '', words: [] }
}

const WORDS: Partial<Record<SpotId, string[]>> = {
  scene: ['satellite'], locker: ['evidence card', 'red herring'], board: ['record', 'trend'],
  lab: ['season filter', 'scales', 'significant', 'El Niño'], deduction: ['significant', 'hypothesis'],
}

/** Vetted, case-free explanations (reading age about 13). */
export const GLOSSARY: Record<string, string> = {
  'detective work': 'You choose the evidence, test it and write the verdict. I only give hints. The computer does the maths, never me.',
  happening: 'A real event in Sarawak, like a fire, haze or flood, that left a trace in satellite data we can investigate.',
  'NASA data': 'Measurements of Earth from satellites and from computer models that blend millions of observations. They are free for anyone to use.',
  trend: 'A steady change over many years: up, down, or flat. One strange year is not a trend.',
  satellite: 'A spacecraft that circles Earth and measures it from above, the same way every day, for years.',
  'fire detection': "A spot where a satellite's heat sensor saw something much hotter than the ground around it. It marks a fire, not how big it is.",
  'evidence card': 'One measurement of Earth, such as rain or soil wetness, kept as a record over many years.',
  'red herring': 'A clue that looks useful but has nothing to do with the question. Detectives leave it out.',
  record: 'The same measurement taken again and again over time, so you can see how it changed.',
  mission: 'The satellite or science project that produced the measurement. Every number here shows its mission and the date of its newest data.',
  'season filter': "It removes the usual yearly cycle. Each month is compared with what is normal for that month, so a wet season can't hide or fake a trend.",
  scales: 'Two different tests weigh the trend against the random ups and downs. Only if both agree does the record get a "significant" stamp.',
  significant: 'Scientists call a change significant when it is too large to be explained by chance alone. It does not mean "big" or "important".',
  'El Niño': 'A warming of the Pacific Ocean that comes every few years and brings drier weather to Borneo. It can make a few bad years look like a trend.',
  'per decade': 'How much something changes in ten years. It lets you compare slow changes fairly.',
  'twin region': 'A second part of Sarawak tested the same way. If both show the same change, the evidence is stronger.',
  hypothesis: 'Your best explanation for why something is happening. Use careful words like "may" or "could", because data shows what changed, not always why.',
  confidence: 'How sure you are. Good detectives are less sure when the tests disagree or the record is short.',
}

export function stampedCount(results: Record<string, Partial<Record<AnalysisResult['tool'], AnalysisResult>>>, chosen: string[]) {
  return chosen.filter((id) => results[id]?.scales?.stamp || results[id]?.elnino?.stamp).length
}

export const beatIndex = (b: Beat) => BEATS.indexOf(b)
