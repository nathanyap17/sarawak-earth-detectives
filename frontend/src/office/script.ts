// The guide script: what Kenyalang (the hornbill Partner) says at each moment, which object to
// go to next, and a small vetted glossary. This is plain, human-written text, so it never
// contains a number or a result for the case. AI replies come only from the backend Partner.
// AI-assisted: written with Claude Code.
import type { AnalysisResult, CaseType } from '../api/types'
import { sceneLayer } from '../beats/scenekit'
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
  agency:    { name: 'Wire desk', todo: 'See the agents at work' },
}

export interface GuideState {
  hasCase: boolean; beat: Beat; win: SpotId | null; pins: number; chosen: number
  opened: number; stamped: number; herring: boolean; graded: boolean; sentBack: boolean; inboxSeen: boolean
  /** the kind of case: the scene's words follow it (fires, rain, or the plain map) */
  caseType?: CaseType
}

/** The object the student should go to now. */
export function target(s: GuideState): SpotId {
  if (!s.hasCase) return s.inboxSeen ? 'call' : 'inbox'
  return s.beat
}

/** What Kenyalang says, and which words it offers to explain. */
export function say(s: GuideState): { text: string; words: string[] } {
  const t = target(s)
  if (s.win !== t && s.win !== null && s.win !== 'inbox' && s.win !== 'agency') {
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
    case 'scene': return sceneLine(s)
    case 'locker': return s.herring
      ? { text: "Hmm. One of those cards made me tilt my head. What does it have to do with the question? Change it, or keep it if you're sure.", words: ['red herring', 'evidence card'] }
      : { text: `Pick three to five records that could answer the question (${s.chosen} picked). Careful: not every card belongs to this case.`, words: ['evidence card', 'red herring', 'record'] }
    case 'board': return { text: `Flip each card to see how it changed over the years (${s.opened} flipped). Look for bumps, dips and odd years before you test anything.`, words: ['record', 'trend', 'wobble', 'mission', 'NASA POWER', 'MERRA-2'] }
    case 'lab': return { text: `Now test each record. Go left to right along the bench: look, filter, measure, weigh, then check for El Niño. With the Ruler you lay your own line first! Every record needs a stamp (${s.stamped} stamped so far).`, words: ['regression', 'trend line', 'range', 'p-value', 't-test', 'Mann-Kendall', 'shuffle test', 'significant', 'El Niño', 'per decade'] }
    case 'deduction': return { text: 'Write what you found, in your own words. Your verdict must follow your stamps. Saying the record can\'t settle it yet is allowed, if that is what the evidence shows.', words: ['verdict', 'significant', 'hypothesis', 'confidence'] }
    case 'agency': return { text: 'This is the wire desk. Every line is something the agency did: the Scout reading the news, the Case Builder drafting a case, the code doing the maths, a person approving it. Look for who did each step: AI, code or a human.', words: ['agent', 'guard', 'answer key', 'editor'] }
    case 'closed': return s.sentBack
      ? { text: "The Chief sent it back. That happens to good detectives. Read the notes, then go back to the typewriter for one more try.", words: [] }
      : { text: "Case closed! Read the Chief's notes. Your case is filed under Learnt cases in the inbox.", words: [] }
  }
  return { text: '', words: [] }
}

/** The map table's words depend on the kind of case: a flood case never says "watch the fires". */
function sceneLine(s: GuideState): { text: string; words: string[] } {
  const layer = sceneLayer(s.caseType)
  if (layer === 'fires') return s.pins < 1
    ? { text: 'This is Sarawak from space. Press Play to watch the fires through the season. Then click the map where something puzzles you to drop a clue pin. Each pin tells you what the satellite saw there.', words: ['satellite', 'fire detection', 'clue pin'] }
    : { text: `${s.pins} of 3 pins placed. Read each clue report: how many fires, on how many days? Compare a busy place with a quiet one, then head to the Evidence Locker.`, words: ['fire detection', 'peat', 'VIIRS'] }
  if (layer === 'rain') return s.pins < 1
    ? { text: 'This is Sarawak from space. Press Play to walk through the days of rain over the yellow box: the cloud darkens and the water rises with it. Then click the map to drop a clue pin: try low ground by a river, the coast and the hills.', words: ['satellite', 'clue pin'] }
    : { text: `${s.pins} of 3 pins placed. Which place would water reach first, and why? One wet spell is weather; your records will test the years. Then head to the Evidence Locker.`, words: ['clue pin', 'record', 'trend'] }
  return s.pins < 1
    ? { text: 'This is Sarawak from space, with its real hills and valleys. The yellow box is the region this case is about. Click the map to drop up to three clue pins: inside the box, outside it, and on high ground.', words: ['satellite', 'clue pin'] }
    : { text: `${s.pins} of 3 pins placed. Compare the places: coast or hills, inside the box or outside? Then head to the Evidence Locker.`, words: ['clue pin', 'record'] }
}

/** The map table's "What is this?" line for the kind of case. */
export function stationFor(win: SpotId, type?: CaseType) {
  const st = STATION[win]
  if (win !== 'scene') return st
  const layer = sceneLayer(type)
  return { ...st, what: layer === 'fires' ? st.what
    : layer === 'rain' ? 'A model of Sarawak made from satellite pictures. You can watch the rain over the case region day by day.'
    : 'A model of Sarawak made from satellite pictures, with its real hills and valleys.' }
}

const WORDS: Partial<Record<SpotId, string[]>> = {
  scene: ['satellite', 'clue pin'], locker: ['evidence card', 'red herring', 'peat'], board: ['record', 'trend', 'wobble'],
  lab: ['regression', 'p-value', 'Mann-Kendall', 'significant', 'El Niño'], deduction: ['verdict', 'significant', 'hypothesis'],
}

/** Vetted, case-free explanations, written for a ten-year-old. */
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
  'clue pin': 'A marker you drop on the map to ask: what did the satellite see right here? Each pin gives you a clue report about that place.',
  'trend line': 'One straight line drawn through the middle of all the dots. If it tilts up, the thing is growing. If it tilts down, it is shrinking.',
  regression: 'A way of finding the best straight line through scattered dots. The computer tries lines until the gaps between the line and the dots are as small as they can be.',
  wobble: 'The random ups and downs from one year to the next. Scientists call it noise. A real change has to be bigger than the wobble to count.',
  range: 'No measurement is perfect, so the ruler gives two numbers. The true answer is probably somewhere between them. If zero sits inside the range, there may be no change at all.',
  'p-value': 'The chance that plain luck would make a pattern this strong. Written as p. Small p (under 0.05, which is 5 in 100) means luck is an unlikely explanation.',
  't-test': 'Test number one on the Scales. It compares how steep the line is with how much the dots wobble. A steep line with little wobble passes.',
  'Mann-Kendall': 'Test number two on the Scales, named after two scientists. It uses no line. It compares every year with every later year and counts ups and downs. Mostly ups, or mostly downs, means a real trend. One freak year cannot fool it.',
  'shuffle test': 'Mix up the order of the years, like shuffling cards, and see if the mixed-up record tilts as much as the real one. If shuffling often matches it, the tilt could just be luck.',
  average: 'Add up all the values and share them out equally. It gives one number that stands for the whole group.',
  normal: 'What usually happens. Here it means the average for that month over 30 years (1991 to 2020).',
  peat: 'Soil made of dead plants that piled up in swamps for thousands of years. When it is wet it is safe. When it dries out it can burn underground for days.',
  'soil wetness': 'How much water is in the ground where roots grow. 0 means bone dry, 1 means soaked.',
  humidity: 'How much water vapour is in the air. Dry air pulls water out of plants and soil, so things burn more easily.',
  VIIRS: 'A camera on NASA satellites that can see heat. It spots fires day and night from about 830 km up.',
  'NASA POWER': 'A free NASA service that gives weather and soil measurements for any place on Earth, going back to 1981.',
  'MERRA-2': "NASA's computer rebuild of the world's weather, hour by hour since 1980. It blends satellite and ground measurements into one complete picture.",
  agent: 'A computer helper with one job. Ours are the Scout (finds events), the Case Builder (drafts a case), the Partner (gives hints) and the Chief (writes feedback).',
  guard: 'A piece of plain code that checks what the AI wrote. If the AI writes a number the code did not work out, or gives away an answer, the guard throws the reply away.',
  'answer key': 'The correct stamps for a case, worked out by code from the NASA record. It stays locked on the server. No AI and no browser ever sees it.',
  editor: 'A real person who reads every case the agents draft and decides whether students may see it.',
  heatmap: 'A chart made of coloured squares. Here each row is a month and each column is a year. Red squares were above normal, blue squares below.',
  'climate stripes': 'One coloured stripe for every year, in order. If the colours drift from one end to the other, something is changing.',
  verdict: 'Your final answer to the case, in your own words: what changed, where, how much, and whether the change is real.',
}

/** What each place in the office is for, in words for a ten-year-old. Shown at the top of its window. */
export const STATION: Record<SpotId, { icon: string; what: string; why: string }> = {
  inbox: { icon: '✉️', what: 'Your mail tray. New cases arrive here, and solved ones are kept here.', why: 'Every case starts with something that really happened in Sarawak.' },
  call: { icon: '📁', what: 'The case folder. Inside is a letter from the client, asking one question.', why: 'A detective needs a clear question before looking for clues.' },
  scene: { icon: '🗺️', what: 'A model of Sarawak made from satellite pictures. You can watch the fires day by day.', why: 'Seeing where and when things happened tells you which clues to look for.' },
  locker: { icon: '🗄️', what: 'A cabinet of evidence cards. Each card is one thing NASA measures about Earth, year after year.', why: 'Choosing the right measurements is the first skill of a scientist. Some cards are traps!' },
  board: { icon: '📌', what: 'A corkboard where each card becomes a chart: one dot for every year since 1981.', why: 'A chart lets you see change over time with your own eyes, before any test.' },
  lab: { icon: '🔬', what: 'A bench of six tools. Each tool answers one small question about a record.', why: 'Eyes can be fooled. Tools check whether a change is real or just luck.' },
  deduction: { icon: '⌨️', what: 'The typewriter, where you write your answer in your own words.', why: 'Science is not finished until someone explains what the evidence shows, and what it does not.' },
  agency: { icon: '📠', what: 'The wire desk. A ticker of everything the agency\'s helpers have been doing.', why: 'You should always know who did what: the AI, the code, or a person.' },
  closed: { icon: '🏅', what: 'The case shelf. The Chief stamps your case and tells you how you did.', why: 'Good detectives learn from every case, even the ones that get sent back.' },
}

export function stampedCount(results: Record<string, Partial<Record<AnalysisResult['tool'], AnalysisResult>>>, chosen: string[]) {
  return chosen.filter((id) => results[id]?.scales?.stamp || results[id]?.elnino?.stamp).length
}

export const beatIndex = (b: Beat) => BEATS.indexOf(b)
