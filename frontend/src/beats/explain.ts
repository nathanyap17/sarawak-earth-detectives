// Plain-word explanations for the lab, written for a ten-year-old. Every number quoted here is
// passed in from a backend result (rule 1); this file only chooses the words around it.
// AI-assisted: written with Claude Code.
import type { AnalysisResult, MyLineResult, ShuffleResult, Tool } from '../api/types'
import { fmt, pText } from './shared'

export interface ToolInfo { id: Tool; name: string; icon: string; what: string; like: string; when: string }

/** What each desk tool is, what it is like in real life, and when to use it. */
export const TOOL_INFO: ToolInfo[] = [
  { id: 'magnifier', name: 'Magnifier', icon: '🔍', what: 'Zoom in on any years you like.',
    like: 'Like a magnifying glass on a long ribbon of numbers.', when: 'Use it first, just to look.' },
  { id: 'season', name: 'Season filter', icon: '🟠', what: 'Takes away the wet-season and dry-season wiggle that happens every year.',
    like: 'Like tinted glasses that hide the pattern you already expect.', when: 'Use it before you measure anything.' },
  { id: 'ruler', name: 'Ruler', icon: '📏', what: 'Lays one straight line through the dots and reads how fast it tilts.',
    like: 'Like laying a ruler across a row of scattered marbles.', when: 'Use it to answer "how much is it changing?"' },
  { id: 'scales', name: 'Scales', icon: '⚖️', what: 'Weighs the tilt against the wobble, with two different tests.',
    like: 'Like kitchen scales: is the change heavier than the noise?', when: 'Use it to answer "is the change real, or luck?"' },
  { id: 'elnino', name: 'El Niño lamp', icon: '💡', what: 'Switches off the part caused by El Niño years, then weighs again.',
    like: 'Like turning off one lamp to see which shadow it was making.', when: 'Use it after the Scales, to check for a hidden cause.' },
  { id: 'twin', name: 'Twin map', icon: '🗺️', what: 'Runs the same test on a second place.',
    like: 'Like checking whether your neighbour\'s garden is drying too.', when: 'Use it to ask "is it only here?"' },
]

const STAMP_MEANS: Record<string, string> = {
  significant: 'Both tests agree the tilt is very unlikely to be luck. Scientists call that "significant". It tells you a change is probably real. It does not tell you why.',
  not_significant: 'The tilt is tiny compared with the wobble, and even the biggest tilt that fits the dots is too small to matter. So: no real change here.',
  needs_more_years: 'There might be a tilt, but the wobble is too big to be sure yet. More years of measurements would settle it. Saying "we can\'t tell yet" is honest science.',
  record_too_short: 'There are not enough years to test. A trend needs at least 20 years of dots.',
}

const dir = (rate: number | null) => (rate == null ? 'tilts' : rate > 0 ? 'tilts up' : rate < 0 ? 'tilts down' : 'stays level')

/** Step-by-step explanation of one tool result. */
export function explain(r: AnalysisResult, before?: AnalysisResult): string[] {
  switch (r.tool) {
    case 'magnifier': return [
      'Each dot is one year of real satellite-era measurements for this region.',
      'Drag the grey bar under the chart to zoom. Look for three things: does it climb or fall, does it jump around a lot, and are there freak years that stick out?',
      'Looking is not proof. Our eyes love to see patterns that aren\'t there. The next tools check what your eyes think they see.',
    ]
    case 'season': return [
      'Sarawak has wetter months and drier months every single year. That yearly up-and-down is not a change in the climate. It is just the calendar.',
      'The filter takes each month and subtracts what is normal for that month (the 1991 to 2020 average). What is left is how unusual each month was.',
      'Above the zero line means more than normal. Below it means less than normal. If the line drifts away from zero over many years, something may be changing.',
      'Now the seasons can\'t fool your ruler.',
    ]
    case 'ruler': {
      if (r.rate_per_decade == null || !r.range) return [STAMP_MEANS.record_too_short]
      const zeroIn = r.range[0] <= 0 && r.range[1] >= 0
      return [
        `The red dashed line is the straight line that sits closest to all the dots. It ${dir(r.rate_per_decade)} by ${fmt(r.rate_per_decade)} ${r.unit}. "Per decade" means "every ten years".`,
        `No line is perfect, because the dots wobble. So the ruler also gives a range: the true tilt is probably between ${fmt(r.range[0])} and ${fmt(r.range[1])}.`,
        zeroIn
          ? 'Zero is inside that range. That means "no tilt at all" is still possible. Be careful before you call this a change.'
          : 'Zero is outside that range. That is a good sign the tilt is not nothing. The Scales will test it properly.',
      ]
    }
    case 'scales':
    case 'elnino':
    case 'twin': {
      const out: string[] = []
      if (r.tool === 'elnino') {
        out.push('El Niño is a warming of the Pacific Ocean that comes back every few years. In El Niño years Borneo usually gets less rain, so the land dries out, with or without any long-term change.')
        if (r.elnino_r != null) out.push(`This record moves with El Niño by r = ${fmt(r.elnino_r, 2)}. r near 0 means "hardly at all". r near 1 or −1 means "very strongly".`)
        out.push('The lamp removes the El Niño part from every year (the blue line), then puts the record back on the Scales.')
        if (before?.stamp && r.stamp) {
          out.push(before.stamp === r.stamp
            ? `Before the lamp the stamp was "${before.stamp.replace(/_/g, ' ')}", and it still is. El Niño was not the main reason for this result.`
            : `Before the lamp the stamp was "${before.stamp.replace(/_/g, ' ')}". Now it is "${r.stamp.replace(/_/g, ' ')}". So El Niño years were doing a lot of the work. That matters for your verdict.`)
        }
      }
      if (r.tool === 'twin') out.push('A change that shows up in two different places is more convincing than one that shows up in only one.')
      if (r.rate_per_decade != null && r.t_test_p != null && r.mann_kendall_p != null) {
        out.push(`The line ${dir(r.rate_per_decade)} by ${fmt(r.rate_per_decade)} ${r.unit}. Is that tilt real, or could luck have drawn it?`)
        out.push(`Test 1 (the t-test) compares the tilt with the wobble. Its p is ${pText(r.t_test_p)}. p is the chance that luck alone would make a tilt this big. Under 0.05 (5 in 100) passes.`)
        out.push(`Test 2 (Mann-Kendall) uses no line at all. It compares every year with every later year and counts: more ups, or more downs? One freak year can't fool it. Its p is ${pText(r.mann_kendall_p)}.`)
        out.push('A detective wants two witnesses. Both tests must pass, and both must point the same way.')
      }
      if (r.stamp) out.push(STAMP_MEANS[r.stamp])
      return out
    }
  }
}

export function explainMyLine(m: MyLineResult): string[] {
  const verdict = m.score >= 90 ? 'That is nearly as close as any straight line can get. Sharp eyes, Detective!'
    : m.score >= 60 ? 'Close! Nudge the tilt or the height a little and check again.'
    : m.same_direction ? 'Your line leans the right way, but it sits far from many dots. Try again, or see the best line.'
    : 'Your line leans the opposite way to most of the dots. Look at where the early years and the late years sit.'
  return [
    `Your score is ${m.score} out of 100. It measures how close your line lies to the best possible straight line.`,
    verdict,
    `Your line misses the dots by ${fmt(m.your_miss)} on average. The best line misses by ${fmt(m.best_miss)}. Even the best line can't touch every dot, because the dots wobble. When those two numbers are close, the wobble is big compared with the tilt, and that is a clue in itself.`,
    'This is all that "regression" means: try every possible straight line and keep the one with the smallest misses. The computer just does it faster than you can drag a slider.',
  ]
}

export function explainShuffle(s: ShuffleResult): string[] {
  const few = s.as_steep <= s.n * 0.05
  return [
    `Here is a trick to picture "luck". We took the same yearly values and shuffled the years, like a deck of cards, ${s.n} times. Shuffling destroys any real change over time.`,
    `Each grey bar counts shuffles by how much they tilted. The red marker is the real record's tilt (${fmt(s.real_rate_per_decade)} ${s.unit}).`,
    `${s.as_steep} of the ${s.n} shuffles tilted at least as much as the real record.`,
    few
      ? 'That is rare. Luck hardly ever makes a tilt this big, so the order of the years seems to matter. Something may really be changing. (The Scales are stricter than this simple check, so trust their stamp.)'
      : 'That is common. Luck makes a tilt this big quite easily, so this tilt alone is not proof of a change.',
  ]
}
